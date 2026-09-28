import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureOrderCheckoutSchema } from "@/lib/order-checkout";
import { getRequestId, logAppError } from "@/lib/security";
import { createYandexDeliveryForPaidOrder } from "@/lib/yandex-order-sync";

export const runtime = "nodejs";

// Retry through the same atomic claim used by payment notifications.
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const requestId = getRequestId();
  const fetchSite = request.headers.get("sec-fetch-site");
  // Browsers supply trustworthy fetch metadata even when a proxy changes request.url.
  if (fetchSite === "cross-site"
    || (fetchSite !== "same-origin" && request.headers.get("origin") && request.headers.get("origin") !== new URL(request.url).origin)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }
  const { id } = await context.params;
  if (!/^[1-9][0-9]{0,17}$/.test(id)) {
    return NextResponse.json({ error: "Некорректный идентификатор заказа." }, { status: 400 });
  }
  try {
    await ensureOrderCheckoutSchema();
    await createYandexDeliveryForPaidOrder(id);
    const result = await getDb().query<{ yandex_delivery_request_id: string | null }>(
      "SELECT yandex_delivery_request_id FROM orders WHERE id = $1", [id]
    );
    const order = result.rows[0];
    if (!order) return NextResponse.json({ error: "Заказ не найден." }, { status: 404 });
    if (!order.yandex_delivery_request_id) {
      return NextResponse.json({ error: "Заявка уже создаётся либо заказ не имеет статуса «Оплачен» с доставкой Яндекс." }, { status: 409 });
    }
    return NextResponse.json({ deliveryRequestId: order.yandex_delivery_request_id }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await logAppError({ request, requestId, scope: "admin-yandex-delivery-retry", error });
    return NextResponse.json({
      error: error instanceof Error ? error.message : "Не удалось создать заявку на доставку.",
      requestId,
    }, { status: 502 });
  }
}
