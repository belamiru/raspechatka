import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { ensureOrderCheckoutSchema, hashGuestToken, ORDER_GUEST_COOKIE } from "@/lib/order-checkout";
import { calculateYandexPickupDelivery } from "@/lib/yandex-delivery";
import { checkRateLimit, getRequestId, logAppError } from "@/lib/security";
import { applyFreeDelivery } from "@/lib/delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId();
  if (request.headers.get("sec-fetch-site") === "cross-site") return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  try {
    const limit = await checkRateLimit(request, "yandex-delivery-quote", { shortWindowMinutes: 1, shortWindowLimit: 10, dailyLimit: 100 });
    if (!limit.allowed) return NextResponse.json({ error: "Попробуйте через минуту." }, { status: 429 });
    const { id } = await context.params;
    const token = (await cookies()).get(ORDER_GUEST_COOKIE)?.value;
    const data: unknown = await request.json().catch(() => null);
    const point = data && typeof data === "object" && !Array.isArray(data) ? data as Record<string, unknown> : null;
    const pickupPointId = typeof point?.pickupPointId === "string" ? point.pickupPointId.trim() : "";
    if (!token || !pickupPointId) return NextResponse.json({ error: "Выберите пункт выдачи." }, { status: 400 });
    await ensureOrderCheckoutSchema();
    const order = await getDb().query<{
      print_price: number; package_weight_grams: number; package_width_mm: number;
      package_length_mm: number; package_height_mm: number;
      package_places: { weightGrams: number; widthMm: number; lengthMm: number; heightMm: number }[] | null;
    }>(`
      SELECT print_price, package_weight_grams, package_width_mm, package_length_mm, package_height_mm,
             package_places
      FROM orders WHERE id = $1 AND guest_token_hash = $2 AND status = 'awaiting_checkout'
    `, [id, hashGuestToken(token)]);
    const saved = order.rows[0];
    if (!saved) return NextResponse.json({ error: "Заказ недоступен для расчёта." }, { status: 409 });
    const quote = await calculateYandexPickupDelivery({
      pickupPointId, printPriceRubles: Number(saved.print_price),
      package: { weightGrams: Number(saved.package_weight_grams), widthMm: Number(saved.package_width_mm), lengthMm: Number(saved.package_length_mm), heightMm: Number(saved.package_height_mm) },
      /* Все грузоместа: заказ может уехать стопкой и тубусом. */
      ...(Array.isArray(saved.package_places) && saved.package_places.length > 0
        ? { places: saved.package_places }
        : {}),
    });
    /* Порог бесплатной доставки применяем и здесь: эту цену видит покупатель. */
    return NextResponse.json(
      { ...quote, priceRubles: applyFreeDelivery(quote.priceRubles, Number(saved.print_price)) },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    await logAppError({ request, requestId, scope: "yandex_delivery_quote", error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось рассчитать доставку." }, { status: 502 });
  }
}
