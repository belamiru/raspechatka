/*
 * Клиент MAX Bot API.
 *
 * Документация: https://dev.max.ru/docs-api/methods/POST/messages
 *
 * Особенности, важные для работы:
 *   - запросы идут на platform-api2.max.ru, а не на platform-api.max.ru;
 *   - токен передаётся в заголовке Authorization, а не в URL;
 *   - в один диалог можно отправить не более двух сообщений в секунду.
 */

const MAX_API_BASE = "https://platform-api2.max.ru";
const SECRET_PATTERN = /^[A-Za-z0-9-]{5,256}$/;

export function getMaxBotToken(): string | null {
  const token = process.env.MAX_BOT_TOKEN;
  return typeof token === "string" && token.length > 20 ? token : null;
}

/*
 * MAX принимает секрет вебхука только из символов A-Z, a-z, 0-9 и дефиса,
 * длиной от 5 до 256 символов. Hex-строка этому соответствует.
 */
export function getMaxWebhookSecret(): string | null {
  const secret = process.env.MAX_WEBHOOK_SECRET;
  return typeof secret === "string" && SECRET_PATTERN.test(secret) ? secret : null;
}

export function getMaxBotUsername(): string | null {
  const username = process.env.MAX_BOT_USERNAME;
  return typeof username === "string" && username.length > 0 ? username : null;
}

export type SendResult = { ok: true } | { ok: false; error: string };

/*
 * Отправляет текстовое сообщение в диалог с ботом.
 * Никогда не выбрасывает исключение: вызывающий код решает, что делать с ошибкой.
 */
export async function sendMaxText(chatId: string, text: string): Promise<SendResult> {
  const token = getMaxBotToken();
  if (!token) return { ok: false, error: "MAX_BOT_TOKEN не задан или слишком короткий." };
  if (!chatId) return { ok: false, error: "Не указан chat_id." };
  if (!text) return { ok: false, error: "Пустой текст сообщения." };

  try {
    const response = await fetch(
      `${MAX_API_BASE}/messages?chat_id=${encodeURIComponent(chatId)}`,
      {
        method: "POST",
        headers: { Authorization: token, "Content-Type": "application/json" },
        body: JSON.stringify({ text: text.slice(0, 4000) }),
        signal: AbortSignal.timeout(10_000),
      }
    );

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      return {
        ok: false,
        error: `MAX API ответил ${response.status}: ${detail.slice(0, 300)}`,
      };
    }

    return { ok: true };
  } catch (cause) {
    return {
      ok: false,
      error: cause instanceof Error ? `Не удалось отправить сообщение в MAX: ${cause.message}` : "Неизвестная ошибка отправки в MAX.",
    };
  }
}

/*
 * Диплинк открывает бота с параметром start, который придёт в событии bot_started.
 * Длина payload ограничена 128 символами, иначе MAX его просто не передаст.
 */
export function getMaxBotDeepLink(payload: string): string | null {
  const username = getMaxBotUsername();
  if (!username) return null;
  if (!payload || payload.length > 128) return null;
  return `https://max.ru/${encodeURIComponent(username)}?start=${encodeURIComponent(payload)}`;
}
