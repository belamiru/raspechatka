import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureOrderCheckoutSchema } from "@/lib/order-checkout";
import { getTbankPaymentState, getTbankTerminalKey, isValidTbankToken } from "@/lib/tbank";
import { getRequestId, logAppError } from "@/lib/security";
import { createYandexDeliveryForPaidOrder } from "@/lib/yandex-order-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId();
  try {
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) return NextResponse.json({ error: "Некорректное уведомление." }, { status: 400 });
    const notice = body as Record<string, unknown>;
    if (!isValidTbankToken(notice) || notice.TerminalKey !== getTbankTerminalKey()) {
      return NextResponse.json({ error: "Некорректная подпись." }, { status: 403 });
    }
    const paymentId = typeof notice.PaymentId === "string" ? notice.PaymentId : "";
    if (!paymentId) return NextResponse.json({ error: "Не указан PaymentId." }, { status: 400 });

    await ensureOrderCheckoutSchema();
    const db = getDb();
    const found = await db.query<{
      id: string; payment_order_id: string | null; payment_amount: number | null;
    }>(`SELECT id, payment_order_id, payment_amount FROM orders WHERE payment_provider = 'tbank' AND payment_id = $1`, [paymentId]);
    const order = found.rows[0];
    if (!order) return NextResponse.json({ error: "Платёж не найден." }, { status: 404 });

    // Do not trust the notification alone: confirm its current state with T-Bank API.
    const state = await getTbankPaymentState(paymentId);
    const validState = state.Success && state.TerminalKey === getTbankTerminalKey()
      && state.PaymentId === paymentId && state.OrderId === order.payment_order_id
      && state.Amount === order.payment_amount;
    if (!validState) {
      await logAppError({
        request,
        requestId,
        scope: "tbank-webhook-state-mismatch",
        error: new Error("Payment state did not match order"),
        details: { paymentId },
      });
      return NextResponse.json({ error: "Не удалось подтвердить платёж." }, { status: 409 });
    }
    const confirmed = state.Status === "CONFIRMED";
    const cancelled = ["CANCELED", "CANCELLED"].includes(state.Status ?? "");
    await db.query(`
      UPDATE orders SET payment_status = $1,
        status = CASE
          WHEN $2 THEN 'paid'
          WHEN $3 AND status IN ('awaiting_payment', 'paid') THEN 'cancelled'
          ELSE status
        END,
        updated_at = NOW()
      WHERE id = $4 AND payment_id = $5
    `, [state.Status || "UNKNOWN", confirmed, cancelled, order.id, paymentId]);
    if (confirmed) await createYandexDeliveryForPaidOrder(order.id);
    // T-Bank treats only a 200 response with the exact text OK as delivered.
    return new Response("OK", { status: 200, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  } catch (error) {
    await logAppError({
      request,
      requestId,
      scope: "tbank-webhook",
      error,
    });
    return NextResponse.json({ error: "Временная ошибка обработки уведомления." }, { status: 500 });
  }
}
