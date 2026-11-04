import { NextResponse } from "next/server";
import { sendMaxText, getMaxWebhookSecret } from "@/lib/max-bot";
import {
  consumeMaxLinkToken,
  dropMaxSubscriptionsForUser,
  ensureMaxNotificationsSchema,
  getMaxSubscriptionChatId,
  isValidWebhookSecret,
  notifyOrderStatus,
  subscribeOrderToMax,
} from "@/lib/max-notifications";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * Событие MAX Bot API. Для bot_started и bot_stopped значимые поля — chat_id,
 * user.user_id и payload (payload есть только у bot_started).
 * Документация: https://dev.max.ru/docs-api/objects/Update
 */
type MaxUpdate = {
  update_type?: string;
  chat_id?: number;
  user?: { user_id?: number };
  payload?: string;
};

const HELP_TEXT =
  "Чтобы получать уведомления о заказе, откройте страницу своего заказа на сайте начать-печать.рф " +
  "и нажмите кнопку «Получать уведомления в MAX».";

export async function POST(request: Request) {
  const secret = getMaxWebhookSecret();
  if (!secret) {
    // Секрет не задан или не соответствует требованиям MAX — принимать события нечем.
    return NextResponse.json({ error: "Вебхук не настроен." }, { status: 503 });
  }

  if (!isValidWebhookSecret(request.headers.get("X-Max-Bot-Api-Secret"), secret)) {
    return NextResponse.json({ error: "Неверный секрет." }, { status: 403 });
  }

  let update: MaxUpdate;
  try {
    const body: unknown = await request.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) {
      return NextResponse.json({ error: "Некорректное событие." }, { status: 400 });
    }
    update = body as MaxUpdate;
  } catch {
    return NextResponse.json({ error: "Некорректный JSON." }, { status: 400 });
  }

  try {
    await ensureMaxNotificationsSchema();

    switch (update.update_type) {
      case "bot_started":
        await handleBotStarted(update);
        break;
      case "bot_stopped":
      case "dialog_removed":
        await handleBotStopped(update);
        break;
      default:
        // Сообщения и прочие события не обрабатываем: ответ на собственные
        // сообщения бота привёл бы к бесконечному циклу переписки.
        break;
    }
  } catch {
    /*
     * Отвечаем 200 даже при внутренней ошибке: MAX повторит запрос, а повторная
     * обработка уже погашенного токена всё равно ничего не изменит. Диагностику
     * смотрим в логах приложения.
     */
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: true });
}

async function handleBotStarted(update: MaxUpdate): Promise<void> {
  const chatId = typeof update.chat_id === "number" ? String(update.chat_id) : "";
  const userId = typeof update.user?.user_id === "number" ? String(update.user.user_id) : "";
  const payload = typeof update.payload === "string" ? update.payload.trim() : "";

  if (!chatId || !userId) return;

  if (!payload) {
    await sendMaxText(chatId, HELP_TEXT);
    return;
  }

  const orderId = await consumeMaxLinkToken(payload);
  if (!orderId) {
    await sendMaxText(
      chatId,
      "Ссылка устарела или уже использована. Откройте страницу заказа на сайте и нажмите кнопку «Получать уведомления в MAX» ещё раз."
    );
    return;
  }

  await subscribeOrderToMax(orderId, userId, chatId);

  const order = await getDb().query<{ order_number: string; status: string }>(
    `SELECT order_number, status FROM orders WHERE id = $1`,
    [orderId]
  );
  const row = order.rows[0];
  if (!row) {
    await sendMaxText(chatId, "Заказ не найден. Возможно, он был удалён.");
    return;
  }

  await sendMaxText(
    chatId,
    `Готово: уведомления о заказе № ${row.order_number} включены.\n\nНапишем, когда заказ возьмут в работу и когда он будет готов.`
  );

  /*
   * Если заказ уже в работе или готов, человек не должен ждать следующей
   * смены статуса, чтобы узнать положение дел. Уведомление об оплате
   * сюда не входит — оно не отправляется по договорённости.
   */
  if (row.status === "in_progress" || row.status === "ready") {
    const chatIdAlready = await getMaxSubscriptionChatId(orderId);
    if (chatIdAlready) await notifyOrderStatus(orderId, row.status);
  }
}

async function handleBotStopped(update: MaxUpdate): Promise<void> {
  const userId = typeof update.user?.user_id === "number" ? String(update.user.user_id) : "";
  if (!userId) return;
  await dropMaxSubscriptionsForUser(userId);
}
