import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getGuestOrder, hashGuestToken, ORDER_GUEST_COOKIE } from "@/lib/order-checkout";
import { checkRateLimit, getRequestId, logAppError } from "@/lib/security";
import { getTbankPaymentState, getTbankTerminalKey } from "@/lib/tbank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId();
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }
  try {
    const limit = await checkRateLimit(request, "tbank-payment-status", { shortWindowMinutes: 1, shortWindowLimit: 10, dailyLimit: 100 });
    if (!limit.allowed) return NextResponse.json({ error: "Попробуйте через минуту." }, { status: 429 });

    const { id } = await context.params;
    const token = (await cookies()).get(ORDER_GUEST_COOKIE)?.value;
    const order = await getGuestOrder(id, token);
    if (!order || !token) return NextResponse.json({ error: "Заказ не найден." }, { status: 404 });

    const db = getDb();
    const payment = await db.query<{
      payment_id: string | null; payment_order_id: string | null; payment_amount: number | null;
    }>(`SELECT payment_id, payment_order_id, payment_amount
        FROM orders WHERE id = $1 AND guest_token_hash = $2 AND payment_provider = 'tbank'`,
      [id, hashGuestToken(token)]);
    const saved = payment.rows[0];
    if (!saved?.payment_id || !saved.payment_order_id || saved.payment_amount == null) {
      return NextResponse.json({ error: "Для заказа нет созданного платежа." }, { status: 409 });
    }

    const state = await getTbankPaymentState(saved.payment_id);
    const validState = state.Success
      && state.TerminalKey === getTbankTerminalKey()
      && state.PaymentId === saved.payment_id
      && state.OrderId === saved.payment_order_id
      && Number(state.Amount) === Number(saved.payment_amount);
    if (!validState) {
      await logAppError({
        request, requestId, scope: "tbank-payment-status-mismatch",
        error: new Error("Payment state did not match order"), details: { paymentId: saved.payment_id },
      });
      return NextResponse.json({ error: "Не удалось подтвердить платёж." }, { status: 409 });
    }

    const confirmed = state.Status === "CONFIRMED";
    await db.query(`UPDATE orders SET payment_status = $1,
        status = CASE WHEN $2 THEN 'paid' ELSE status END, updated_at = NOW()
      WHERE id = $3 AND guest_token_hash = $4 AND payment_id = $5`,
      [state.Status || "UNKNOWN", confirmed, id, hashGuestToken(token), saved.payment_id]);
    const updated = await getGuestOrder(id, token);
    return NextResponse.json({ order: updated }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await logAppError({ request, requestId, scope: "tbank-payment-status", error });
    return NextResponse.json({ error: "Не удалось проверить статус оплаты. Попробуйте ещё раз." }, { status: 502 });
  }
}
