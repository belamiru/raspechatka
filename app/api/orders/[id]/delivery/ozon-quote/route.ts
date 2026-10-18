import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureOrderCheckoutSchema, hashGuestToken, ORDER_GUEST_COOKIE } from "@/lib/order-checkout";
import { quoteOzonPickupDelivery } from "@/lib/ozon-order";
import { checkRateLimit, getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId();
  if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  try {
    const limit = await checkRateLimit(request, "ozon-delivery-quote", { shortWindowMinutes: 1, shortWindowLimit: 10, dailyLimit: 100 });
    if (!limit.allowed) return NextResponse.json({ error: "Попробуйте через минуту." }, { status: 429 });
    const { id } = await context.params;
    const token = (await cookies()).get(ORDER_GUEST_COOKIE)?.value;
    const data: unknown = await request.json().catch(() => null);
    const body = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    const pointId = typeof body?.pickupPointId === "string" ? body.pickupPointId.trim() : "";
    const phone = typeof body?.customerPhone === "string" ? body.customerPhone.trim() : "";
    if (!token || !/^\d+$/.test(pointId)) return NextResponse.json({ error: "Выберите пункт выдачи Ozon." }, { status: 400 });
    if (!/^\d{10,15}$/.test(phone.replace(/\D/g, ""))) {
      return NextResponse.json({ error: "Укажите телефон, зарегистрированный на Ozon." }, { status: 400 });
    }
    await ensureOrderCheckoutSchema();
    const order = await getDb().query<{
      print_price: number; package_weight_grams: number; package_width_mm: number;
      package_length_mm: number; package_height_mm: number;
    }>(`
      SELECT COALESCE(print_price, total_price) AS print_price,
             package_weight_grams, package_width_mm, package_length_mm, package_height_mm
      FROM orders WHERE id = $1 AND guest_token_hash = $2 AND status = 'awaiting_checkout'
    `, [id, hashGuestToken(token)]);
    const saved = order.rows[0];
    if (!saved) return NextResponse.json({ error: "Заказ недоступен для расчёта." }, { status: 409 });
    const quote = await quoteOzonPickupDelivery({
      orderId: id, pointId, phone, printPriceRubles: Number(saved.print_price),
      parcel: {
        weightGrams: Number(saved.package_weight_grams), widthMm: Number(saved.package_width_mm),
        lengthMm: Number(saved.package_length_mm), heightMm: Number(saved.package_height_mm),
      },
    });
    return NextResponse.json(quote, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await logAppError({ request, requestId, scope: "ozon_delivery_quote", error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось рассчитать доставку Ozon." }, { status: 502 });
  }
}
