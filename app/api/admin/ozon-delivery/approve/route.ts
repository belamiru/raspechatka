import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { approveOzonDeliveryForPaidOrder } from "@/lib/ozon-order";
import { getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Ручное подтверждение отправления к отгрузке.
 *
 * Нужно, когда автоматический шаг не прошёл: пополнили баланс Ozon после
 * NotEnoughBalance или разобрались с ошибкой валидации. Роут идемпотентен —
 * повторный вызов для уже подтверждённого заказа просто вернёт false.
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
    const approved = await approveOzonDeliveryForPaidOrder(orderId);
    return NextResponse.json({ approved }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    // Текст ошибки нужен администратору: он объясняет, что делать дальше.
    await logAppError({ request, requestId, scope: "ozon-delivery-approve-manual", error: cause });
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Не удалось подтвердить отправление." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
