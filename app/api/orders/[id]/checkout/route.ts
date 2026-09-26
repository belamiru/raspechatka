import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { getGuestOrder, hashGuestToken, ORDER_GUEST_COOKIE } from "@/lib/order-checkout";
import { checkRateLimit, getRequestId, logAppError } from "@/lib/security";
import { calculateYandexPickupDelivery } from "@/lib/yandex-delivery";

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
    const email = typeof data.customerEmail === "string" ? data.customerEmail.trim().toLowerCase() : "";
    const comment = typeof data.customerComment === "string" ? data.customerComment.trim() : "";
    if (name.length < 2 || name.length > 120 || phone.length > 40 ||
        !/^[+\d ()-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g, "")) ||
        email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || comment.length > 2000) {
      return NextResponse.json({ error: "Проверьте имя, телефон, email для чека и комментарий (до 2000 символов)." }, { status: 400 });
    }
    const fulfillmentMethod = data.fulfillmentMethod;
    const paymentMethod = data.paymentMethod;
    const pickupPoint = data.pickupPoint;
    let pickupPointId: string | null = null;
    let pickupPointAddress: string | null = null;
    let pickupPointType: string | null = null;
    let deliveryPrice: number | null = null;
    if (fulfillmentMethod === "pickup") {
      if (paymentMethod !== "online" && paymentMethod !== "on_receipt") {
        return NextResponse.json({ error: "Выберите способ оплаты." }, { status: 400 });
      }
    } else if (fulfillmentMethod === "yandex_pickup_point") {
      if (paymentMethod !== "online" || !pickupPoint || typeof pickupPoint !== "object" || Array.isArray(pickupPoint)) {
        return NextResponse.json({ error: "Доставка в ПВЗ доступна только с онлайн-оплатой. Выберите пункт выдачи на карте." }, { status: 400 });
      }
      const point = pickupPoint as Record<string, unknown>;
      pickupPointId = typeof point.id === "string" ? point.id.trim() : "";
      pickupPointAddress = typeof point.address === "string" ? point.address.trim() : "";
      pickupPointType = typeof point.type === "string" ? point.type.trim() : "";
      if (!pickupPointId || pickupPointId.length > 120 || !pickupPointAddress || pickupPointAddress.length > 500 || !["pickup_point", "terminal", "unknown"].includes(pickupPointType)) {
        return NextResponse.json({ error: "Не удалось прочитать данные выбранного пункта. Выберите его на карте ещё раз." }, { status: 400 });
      }
    } else {
      return NextResponse.json({ error: "Выберите способ получения." }, { status: 400 });
    }
    if (order.status === "cancelled") return NextResponse.json({ error: "Заказ отменён." }, { status: 409 });
    const db = getDb();
    const pricing = await db.query<{ print_price: number; package_weight_grams: number; package_width_mm: number; package_length_mm: number; package_height_mm: number }>(`
      SELECT COALESCE(print_price, total_price) AS print_price,
             package_weight_grams, package_width_mm, package_length_mm, package_height_mm
      FROM orders WHERE id = $1 AND guest_token_hash = $2 AND status = 'awaiting_checkout'
    `, [id, hashGuestToken(token)]);
    const orderForPricing = pricing.rows[0];
    if (!orderForPricing) return NextResponse.json({ error: "Заказ уже оформлен или недоступен." }, { status: 409 });
    if (fulfillmentMethod === "yandex_pickup_point") {
      const quote = await calculateYandexPickupDelivery({
        pickupPointId: pickupPointId!, printPriceRubles: Number(orderForPricing.print_price),
        package: {
          weightGrams: Number(orderForPricing.package_weight_grams), widthMm: Number(orderForPricing.package_width_mm),
          lengthMm: Number(orderForPricing.package_length_mm), heightMm: Number(orderForPricing.package_height_mm),
        },
      });
      deliveryPrice = quote.priceRubles;
    }
    // The conditional update also makes retries and concurrent submissions harmless.
    await db.query(`
      UPDATE orders SET customer_name = $1, customer_phone = $2, customer_email = $3, customer_comment = $4,
        fulfillment_method = $5, payment_method = $6,
        pickup_point_id = $7, pickup_point_address = $8, pickup_point_type = $9,
        delivery_price = $10,
        print_price = COALESCE(print_price, total_price),
        total_price = COALESCE(print_price, total_price) + COALESCE($10, 0),
        status = CASE WHEN $13 = 'on_receipt' THEN 'new' ELSE 'awaiting_payment' END,
        updated_at = NOW()
      WHERE id = $11 AND guest_token_hash = $12 AND status = 'awaiting_checkout'
    `, [name, phone, email, comment || null, fulfillmentMethod, paymentMethod,
      pickupPointId, pickupPointAddress, pickupPointType, deliveryPrice, id, hashGuestToken(token), paymentMethod]);
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
