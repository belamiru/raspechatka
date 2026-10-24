import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getRequestId, logAppError } from "@/lib/security";
import { createYandexDeliveryForPaidOrder } from "@/lib/yandex-order-sync";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Повторное создание заявки Яндекс Доставки для оплаченного заказа.
 * Дубль невозможен: строка захватывается только пока yandex_delivery_request_id пуст.
 */
export async function POST(request: Request) {
  const requestId = getRequestId();
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }

  const body: unknown = await request.json().catch(() => null);
  const rawId = body && typeof body === "object" && !Array.isArray(body)
    ? (body as Record<string, unknown>).orderId
    : null;
  const orderId = typeof rawId === "string" || typeof rawId === "number" ? String(rawId).trim() : "";
  if (!/^\d+$/.test(orderId)) {
    return NextResponse.json({ error: "Некорректный заказ." }, { status: 400 });
  }

  try {
    const created = await createYandexDeliveryForPaidOrder(orderId);
    if (!created) {
      // Строку не удалось захватить: объясняем почему, а не молчим.
      const row = (await getDb().query<{ status: string; yandex_delivery_request_id: string | null; yandex_delivery_status: string | null }>(
        "SELECT status, yandex_delivery_request_id, yandex_delivery_status FROM orders WHERE id = $1 AND fulfillment_method = 'yandex_pickup_point'",
        [orderId],
      )).rows[0];
      const reason = !row ? "Заказ с доставкой Яндекса не найден."
        : row.yandex_delivery_request_id ? "Заявка уже создана."
        : row.yandex_delivery_status === "creating" ? "Заявка уже создаётся. Обновите страницу через минуту."
        : `Заявку можно создать только для оплаченного заказа (сейчас статус: ${row.status}).`;
      return NextResponse.json({ error: reason }, { status: 409 });
    }
    return NextResponse.json({ created: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    await logAppError({ request, requestId, scope: "yandex-delivery-retry", error: cause });
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Не удалось создать заявку Яндекс Доставки." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
