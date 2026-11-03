/*
 * Настройки сайта в одном месте.
 *
 * Домен и название раньше были вписаны в девять файлов: метаданные, robots,
 * sitemap, структурированные данные, юридические страницы. При смене домена
 * что-то обязательно оставалось старым, и поисковики получали ссылки на
 * прежний адрес. Теперь правится только здесь.
 *
 * Домен в punycode: «начать-печать.рф» → xn----7sbaby8brwe7bf0dg.xn--p1ai.
 * Кириллицу в URL писать нельзя — metadataBase и sitemap ждут ASCII-домен.
 */

/* Адрес сайта без слэша на конце. */
export const SITE_URL = "https://xn----7sbaby8brwe7bf0dg.xn--p1ai";

/* Название для метаданных, структурированных данных и писем. */
export const SITE_NAME = "Начать-печать";

/* Домен для юридических текстов — как его видит покупатель. */
export const SITE_DOMAIN = "начать-печать.рф";

/* Название магазина: под ним работают печать и доставка. */
export const COMPANY_NAME = "Типография Copyleft";

/*
 * Доставка Ozon временно отключена: интеграция ещё не готова принимать заказы.
 *
 * Флаг один на клиент и сервер, поэтому состояние нельзя рассинхронизировать:
 * в оформлении вариант виден, но выбрать его нельзя, а серверная часть
 * отклонит такой заказ, даже если запрос отправят в обход интерфейса.
 *
 * Вся логика Ozon — расчёт стоимости, выбор пункта, создание отправления —
 * остаётся в коде. Когда интеграция заработает, достаточно поставить true.
 */
export const OZON_DELIVERY_ENABLED = true;

/*
 * Сайт может работать за обратным прокси: TLS завершается на нём, а до
 * приложения запрос доходит по http. В этом случае request.url содержит
 * внутренний адрес, и любые ссылки из него увели бы покупателя не туда.
 *
 * Поэтому origin собираем так:
 *   1. APP_URL из окружения — главный источник истины;
 *   2. заголовки прокси x-forwarded-host и x-forwarded-proto;
 *   3. адрес запроса, если header'ов нет (локальная разработка).
 */
export function getRequestOrigin(request: Request) {
  const configured = process.env.APP_URL?.trim().replace(/\/$/, "");
  if (configured && /^https?:\/\//.test(configured)) return configured;

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host")?.trim();

  if (host) {
    const forwardedProto = request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim();
    /* Если протокол не сообщён, считаем https: в продакшене это верно почти всегда. */
    const proto = forwardedProto === "http" || forwardedProto === "https"
      ? forwardedProto
      : process.env.NODE_ENV === "production"
        ? "https"
        : new URL(request.url).protocol.replace(":", "");

    return `${proto}://${host}`;
  }

  return new URL(request.url).origin;
}

/*
 * Нужен ли флаг Secure для cookie.
 *
 * Cookie с Secure браузер не сохранит на http, а без него запросы на /order
 * выглядят как «заказ не найден»: страница оформления отдаёт 404, потому что
 * не может прочитать гостевой токен. Поэтому решаем по фактическому протоколу,
 * а не только по NODE_ENV.
 */
export function isSecureRequest(request: Request) {
  return getRequestOrigin(request).startsWith("https://");
}
