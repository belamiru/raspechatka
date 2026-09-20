import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getGuestOrder, hashGuestToken, ORDER_GUEST_COOKIE } from "@/lib/order-checkout";
import { checkRateLimit, getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId();
  // Browser POSTs must originate from this site, including behind a reverse proxy.
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return NextResponse.json({ error: "Ожидается JSON." }, { status: 415 });
  }
  try {
  const limit = await checkRateLimit(request, "order-checkout", { shortWindowMinutes: 1, shortWindowLimit: 30, dailyLimit: 300 });
  if (!limit.allowed) return NextResponse.json({ error: "Попробуйте через минуту." }, { status: 429 });
    const { id } = await context.params;
    const token = (await cookies()).get(ORDER_GUEST_COOKIE)?.value;
    const order = await getGuestOrder(id, token);
    if (!order || !token) return NextResponse.json({ error: "Заказ не найден." }, { status: 404 });
    const body: unknown = await request.json().catch(() => null);
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректные данные." }, { status: 400 });
    }
    const data = body as Record<string, unknown>;
    const name = typeof data.customerName === "string" ? data.customerName.trim() : "";
    const phone = typeof data.customerPhone === "string" ? data.customerPhone.trim() : "";
    const comment = typeof data.customerComment === "string" ? data.customerComment.trim() : "";
    if (name.length < 2 || name.length > 120 || phone.length > 40 ||
        !/^[+\d ()-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g, "")) || comment.length > 2000) {
      return NextResponse.json({ error: "Проверьте имя, телефон (10–15 цифр) и комментарий (до 2000 символов)." }, { status: 400 });
    }
    if (data.fulfillmentMethod !== "pickup" || data.paymentMethod !== "on_receipt") {
      return NextResponse.json({ error: "Выберите самовывоз и оплату при получении." }, { status: 400 });
    }
    if (order.status === "cancelled") return NextResponse.json({ error: "Заказ отменён." }, { status: 409 });
    // The conditional update also makes retries and concurrent submissions harmless.
    await getDb().query(`
      UPDATE orders SET customer_name = $1, customer_phone = $2, customer_comment = $3,
        fulfillment_method = 'pickup', payment_method = 'on_receipt',
        status = 'new', updated_at = NOW()
      WHERE id = $4 AND guest_token_hash = $5 AND status = 'awaiting_checkout'
    `, [name, phone, comment || null, id, hashGuestToken(token)]);
    const saved = await getGuestOrder(id, token);
    if (!saved || saved.status === "cancelled") {
      return NextResponse.json({ error: "Заказ недоступен для оформления." }, { status: 409 });
    }
    return NextResponse.json({ success: true, order: saved }, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await logAppError({ request, requestId, scope: "order_checkout_failed", error });
    return NextResponse.json({ error: "Не удалось подтвердить заказ. Попробуйте снова.", requestId }, { status: 500 });
  }
}
