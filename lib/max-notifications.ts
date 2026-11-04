import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { getDb } from "@/lib/db";
import { sendMaxText } from "@/lib/max-bot";

/*
 * Привязка диалога в MAX к заказу.
 *
 * По номеру заказа привязывать нельзя: номер короткий и его легко подобрать,
 * а значит посторонний смог бы получать статусы чужого заказа. Поэтому
 * из страницы заказа генерируется одноразовый токен (его знает только тот,
 * у кого есть гостевой cookie заказа), а бот обменивает этот токен на подписку.
 */

const LINK_TOKEN_TTL_MINUTES = 60 * 24 * 7;
const LINK_TOKEN_BYTES = 24;

let schemaReady: Promise<void> | null = null;

export function ensureMaxNotificationsSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = getDb()
      .query(`
        CREATE TABLE IF NOT EXISTS max_link_tokens (
          token_hash TEXT PRIMARY KEY,
          order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          expires_at TIMESTAMPTZ NOT NULL,
          consumed_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_max_link_tokens_order ON max_link_tokens(order_id);

        CREATE TABLE IF NOT EXISTS max_subscriptions (
          order_id BIGINT PRIMARY KEY REFERENCES orders(id) ON DELETE CASCADE,
          max_user_id TEXT NOT NULL,
          max_chat_id TEXT NOT NULL,
          subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_max_subscriptions_user ON max_subscriptions(max_user_id);

        CREATE TABLE IF NOT EXISTS max_outbox (
          order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          status VARCHAR(30) NOT NULL,
          message TEXT NOT NULL,
          attempts INTEGER NOT NULL DEFAULT 0,
          sent_at TIMESTAMPTZ,
          error TEXT,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          PRIMARY KEY (order_id, status)
        );
      `)
      .then(() => undefined)
      .catch((error) => {
        // Не кешируем неудачу: следующий вызов попробует создать схему снова.
        schemaReady = null;
        throw error;
      });
  }
  return schemaReady;
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/*
 * Выпускает одноразовый токен привязки для заказа.
 * В базу попадает только хеш: по содержимому таблицы нельзя восстановить ссылку.
 */
export async function createMaxLinkToken(orderId: string): Promise<string | null> {
  await ensureMaxNotificationsSchema();
  const token = randomBytes(LINK_TOKEN_BYTES).toString("hex");

  await getDb().query(
    `INSERT INTO max_link_tokens (token_hash, order_id, expires_at)
     VALUES ($1, $2, NOW() + ($3 || ' minutes')::interval)`,
    [hashToken(token), orderId, String(LINK_TOKEN_TTL_MINUTES)]
  );

  // Попутно убираем просроченные токены этого заказа, чтобы таблица не росла.
  await getDb()
    .query(`DELETE FROM max_link_tokens WHERE order_id = $1 AND expires_at <= NOW()`, [orderId])
    .catch(() => undefined);

  return token;
}

/*
 * Обменивает токен на order_id. Токен гасится одним атомарным UPDATE,
 * поэтому повторный переход по той же ссылке уже ничего не привяжет.
 */
export async function consumeMaxLinkToken(token: string): Promise<string | null> {
  if (!/^[a-f0-9]{16,64}$/.test(token)) return null;
  await ensureMaxNotificationsSchema();

  const result = await getDb().query<{ order_id: string }>(
    `UPDATE max_link_tokens
        SET consumed_at = NOW()
      WHERE token_hash = $1 AND consumed_at IS NULL AND expires_at > NOW()
      RETURNING order_id`,
    [hashToken(token)]
  );

  return result.rows[0]?.order_id ?? null;
}

export async function subscribeOrderToMax(
  orderId: string,
  maxUserId: string,
  maxChatId: string
): Promise<void> {
  await ensureMaxNotificationsSchema();
  await getDb().query(
    `INSERT INTO max_subscriptions (order_id, max_user_id, max_chat_id)
     VALUES ($1, $2, $3)
     ON CONFLICT (order_id) DO UPDATE
       SET max_user_id = EXCLUDED.max_user_id,
           max_chat_id = EXCLUDED.max_chat_id,
           updated_at = NOW()`,
    [orderId, maxUserId, maxChatId]
  );
}

/*
 * Пользователь остановил бота или удалил диалог — подписки больше не нужны.
 * Иначе мы продолжим отправлять сообщения в недоступный диалог.
 */
export async function dropMaxSubscriptionsForUser(maxUserId: string): Promise<void> {
  await ensureMaxNotificationsSchema();
  await getDb()
    .query(`DELETE FROM max_subscriptions WHERE max_user_id = $1`, [maxUserId])
    .catch(() => undefined);
}

export async function getMaxSubscriptionChatId(orderId: string): Promise<string | null> {
  await ensureMaxNotificationsSchema();
  const result = await getDb().query<{ max_chat_id: string }>(
    `SELECT max_chat_id FROM max_subscriptions WHERE order_id = $1`,
    [orderId]
  );
  return result.rows[0]?.max_chat_id ?? null;
}

/*
 * Уведомление об оплате намеренно отсутствует: первое сообщение о ходе
 * заказа — «взят в работу», как договорились с заказчиком.
 */
const STATUS_MESSAGES: Record<string, (orderNumber: string) => string> = {
  in_progress: (number) =>
    `Заказ № ${number} взят в работу.\n\nМы начали печать. Напишем, когда заказ будет готов.`,
  ready: (number) =>
    `Заказ № ${number} готов.\n\nМожно забирать. Если заказ с доставкой, передадим его в службу доставки.`,
  cancelled: (number) =>
    `Заказ № ${number} отменён.\n\nЕсли это ошибка или нужны подробности — ответьте на это сообщение или напишите нам на zakaz@listovok.ru.`,
};

export function hasMaxStatusMessage(status: string): boolean {
  return Object.hasOwn(STATUS_MESSAGES, status);
}

/*
 * Отправляет уведомление о смене статуса заказа.
 *
 * Функция не выбрасывает исключения: сбой мессенджера не должен ломать
 * смену статуса в админке или обработку платежа. Повторное уведомление
 * о том же статусе не отправляется — за это отвечает первичный ключ outbox.
 */
export async function notifyOrderStatus(orderId: string, status: string): Promise<void> {
  try {
    const buildMessage = STATUS_MESSAGES[status];
    if (!buildMessage) return;

    const chatId = await getMaxSubscriptionChatId(orderId);
    if (!chatId) return;

    const db = getDb();
    const order = await db.query<{ order_number: string }>(
      `SELECT order_number FROM orders WHERE id = $1`,
      [orderId]
    );
    const orderNumber = order.rows[0]?.order_number;
    if (!orderNumber) return;

    const message = buildMessage(orderNumber);

    await db.query(
      `INSERT INTO max_outbox (order_id, status, message)
       VALUES ($1, $2, $3)
       ON CONFLICT (order_id, status) DO NOTHING`,
      [orderId, status, message]
    );

    const queued = await db.query<{ sent_at: Date | null }>(
      `SELECT sent_at FROM max_outbox WHERE order_id = $1 AND status = $2`,
      [orderId, status]
    );
    if (!queued.rows[0] || queued.rows[0].sent_at) return;

    const result = await sendMaxText(chatId, message);

    if (result.ok) {
      await db.query(
        `UPDATE max_outbox SET sent_at = NOW(), error = NULL, attempts = attempts + 1
          WHERE order_id = $1 AND status = $2`,
        [orderId, status]
      );
    } else {
      await db.query(
        `UPDATE max_outbox SET error = $3, attempts = attempts + 1
          WHERE order_id = $1 AND status = $2`,
        [orderId, status, result.error.slice(0, 1000)]
      );
    }
  } catch {
    // Уведомление — вспомогательная операция, её сбой не должен всплывать наружу.
  }
}

/*
 * Сравнение секрета вебхука без утечки длины через время ответа.
 */
export function isValidWebhookSecret(provided: string | null, expected: string): boolean {
  if (!provided) return false;
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
