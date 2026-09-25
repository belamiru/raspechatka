import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getGuestOrder, hashGuestToken, ORDER_GUEST_COOKIE } from "@/lib/order-checkout";
import { checkRateLimit, getRequestId, logAppError } from "@/lib/security";
import { getTbankPaymentState, initTbankPayment } from "@/lib/tbank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const REUSABLE_STATUSES = new Set(["NEW", "FORM_SHOWED", "AUTHORIZING", "AUTHORIZED"]);
const RETRYABLE_STATUSES = new Set(["REJECTED", "CANCELED", "DEADLINE_EXPIRED"]);

function appUrl(request: Request) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured && /^https:\/\//.test(configured)) return configured;
  return new URL(request.url).origin;
}

const TAXATION_VALUES = new Set(["osn", "usn_income", "usn_income_outcome", "esn", "patent"]);

function receiptEmail(value: string | null) {
  const email = value?.trim().toLowerCase() ?? "";
  return email.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
}

function buildReceipt(email: string | null, printAmountKopecks: number, deliveryAmountKopecks: number, orderNumber: string) {
  const taxation = process.env.TBANK_TAXATION?.trim();
  const tax = process.env.TBANK_RECEIPT_TAX?.trim() || "none";
  const normalizedEmail = receiptEmail(email);
  if (!taxation || !TAXATION_VALUES.has(taxation)) {
    throw new Error("Не задана корректная TBANK_TAXATION для фискального чека.");
  }
  if (!normalizedEmail) throw new Error("Не указан корректный email покупателя для кассового чека.");
  return {
    Email: normalizedEmail,
    Taxation: taxation,
    Items: [
      {
        Name: `Печать документов, заказ ${orderNumber}`.slice(0, 128),
        Price: printAmountKopecks,
        Quantity: 1,
        Amount: printAmountKopecks,
        PaymentMethod: "full_prepayment",
        PaymentObject: "service",
        Tax: tax,
      },
      ...(deliveryAmountKopecks > 0 ? [{
        Name: "Доставка в пункт выдачи Яндекс Доставки",
        Price: deliveryAmountKopecks,
        Quantity: 1,
        Amount: deliveryAmountKopecks,
        PaymentMethod: "full_prepayment",
        PaymentObject: "service",
        Tax: tax,
      }] : []),
    ],
  };
}

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId();
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }
  try {
    const limit = await checkRateLimit(request, "tbank-init", { shortWindowMinutes: 1, shortWindowLimit: 10, dailyLimit: 100 });
    if (!limit.allowed) return NextResponse.json({ error: "Попробуйте через минуту." }, { status: 429 });
    const { id } = await context.params;
    const token = (await cookies()).get(ORDER_GUEST_COOKIE)?.value;
    const order = await getGuestOrder(id, token);
    if (!order || !token) return NextResponse.json({ error: "Заказ не найден." }, { status: 404 });
    if (order.fulfillment_method !== "pickup") {
      return NextResponse.json({ error: "Оплата доставки будет доступна после подключения расчёта её стоимости." }, { status: 409 });
    }
    if (order.status === "paid") return NextResponse.json({ error: "Этот заказ уже оплачен." }, { status: 409 });
    if (order.status !== "awaiting_payment") {
      return NextResponse.json({ error: "Сначала заполните данные заказа." }, { status: 409 });
    }

    if (!Number.isSafeInteger(order.total_price) || order.total_price < 1) {
      return NextResponse.json({ error: "Некорректная сумма заказа." }, { status: 409 });
    }
    const db = getDb();
    const existing = await db.query<{
      payment_id: string | null; payment_status: string | null; payment_url: string | null;
    }>(`SELECT payment_id, payment_status, payment_url FROM orders WHERE id = $1 AND guest_token_hash = $2`, [id, hashGuestToken(token)]);
    const previous = existing.rows[0];
    if (previous?.payment_id && REUSABLE_STATUSES.has(previous.payment_status ?? "") && previous.payment_url) {
      return NextResponse.json({ paymentUrl: previous.payment_url });
    }
    if (previous?.payment_id && previous.payment_status && !RETRYABLE_STATUSES.has(previous.payment_status)) {
      // Do not create a second payment while the bank can still complete the first one.
      const state = await getTbankPaymentState(previous.payment_id);
      if (state.Success && state.Status === "CONFIRMED") {
        await db.query(`UPDATE orders SET status = 'paid', payment_status = 'CONFIRMED', updated_at = NOW()
          WHERE id = $1 AND guest_token_hash = $2 AND payment_id = $3`, [id, hashGuestToken(token), previous.payment_id]);
        return NextResponse.json({ error: "Этот заказ уже оплачен." }, { status: 409 });
      }
      return NextResponse.json({ error: "Предыдущий платёж ещё обрабатывается. Подождите несколько минут." }, { status: 409 });
    }

    const attemptResult = await db.query<{ payment_attempt: number }>(`
      UPDATE orders SET payment_attempt = payment_attempt + 1, updated_at = NOW()
      WHERE id = $1 AND guest_token_hash = $2 AND status = 'awaiting_payment'
      RETURNING payment_attempt
    `, [id, hashGuestToken(token)]);
    if (!attemptResult.rows[0]) return NextResponse.json({ error: "Не удалось начать оплату." }, { status: 409 });
    const paymentOrderId = `${order.order_number}-${attemptResult.rows[0].payment_attempt}`.slice(0, 50);
    const baseUrl = appUrl(request);
    const response = await initTbankPayment({
      amountKopecks: order.total_price * 100,
      orderId: paymentOrderId,
      description: `Печать документов, заказ ${order.order_number}`.slice(0, 140),
      notificationUrl: `${baseUrl}/api/payments/tbank/webhook`,
      successUrl: `${baseUrl}/orders/${order.id}/checkout?payment=success`,
      failUrl: `${baseUrl}/orders/${order.id}/checkout?payment=fail`,
      receipt: buildReceipt(order.customer_email, order.print_price * 100, (order.delivery_price ?? 0) * 100, order.order_number),
    });
    if (!response.Success || !response.PaymentId || !response.PaymentURL) {
      throw new Error(response.Message || response.Details || "Т‑Банк не создал платёж.");
    }
    await db.query(`
      UPDATE orders SET payment_provider = 'tbank', payment_id = $1, payment_order_id = $2,
        payment_status = $3, payment_amount = $4, payment_url = $5, updated_at = NOW()
      WHERE id = $6 AND guest_token_hash = $7 AND status = 'awaiting_payment'
    `, [response.PaymentId, paymentOrderId, response.Status || "NEW", order.total_price * 100, response.PaymentURL, id, hashGuestToken(token)]);
    return NextResponse.json({ paymentUrl: response.PaymentURL });
  } catch (error) {
    await logAppError({
  request,
  requestId,
  scope: "tbank-init",
  error,
});
    return NextResponse.json({ error: "Не удалось создать платёж. Проверьте настройки терминала и повторите попытку." }, { status: 502 });
  }
}
