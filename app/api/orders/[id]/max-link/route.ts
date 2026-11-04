import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getGuestOrder, ORDER_GUEST_COOKIE } from "@/lib/order-checkout";
import { getMaxBotDeepLink } from "@/lib/max-bot";
import { createMaxLinkToken } from "@/lib/max-notifications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Переводит покупателя в бота MAX, выпуская одноразовый токен привязки.
 *
 * Токен создаётся только для владельца заказа: getGuestOrder сверяет
 * гостевой cookie. Номер заказа в ссылку не попадает, поэтому подобрать
 * чужой заказ по ссылке нельзя.
 */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const token = (await cookies()).get(ORDER_GUEST_COOKIE)?.value;
  const order = await getGuestOrder(id, token);

  if (!order) {
    return NextResponse.json({ error: "Заказ не найден." }, { status: 404 });
  }

  if (order.status === "awaiting_checkout") {
    return NextResponse.json(
      { error: "Сначала завершите оформление заказа." },
      { status: 409 }
    );
  }

  const linkToken = await createMaxLinkToken(order.id);
  const deepLink = linkToken ? getMaxBotDeepLink(linkToken) : null;

  if (!deepLink) {
    return NextResponse.json(
      { error: "Уведомления в MAX пока не настроены." },
      { status: 503 }
    );
  }

  return NextResponse.redirect(deepLink, {
    status: 302,
    headers: { "Cache-Control": "no-store" },
  });
}
