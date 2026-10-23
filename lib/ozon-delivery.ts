const TOKEN_ENDPOINT = "https://xapi.ozon.ru/oauth/token";
const DELIVERY_API_ORIGIN = "https://api-delivery.ozon.ru";
const MAX_REDIRECTS = 3;

// Ozon's testcookie protection can answer a POST with 302/307 plus Set-Cookie.
// Keep this process-local: it is only a short-lived transport cookie, never sent
// to a browser or persisted in PostgreSQL.
let ozonCookies = "";

const DEFAULT_SCOPES = [
  "delivery-api.delivery",
  "delivery-api.delivery-point",
  "delivery-api.dropoff-point",
  "delivery-api.order",
  "delivery-api.posting",
  "delivery-api.return",
  "delivery-api.return-point",
  "delivery-api.shipment-method",
];

type TokenResponse = {
  access_token?: unknown;
  expires_in?: unknown;
  message?: unknown;
  error?: unknown;
  error_description?: unknown;
};

type CachedToken = { value: string; expiresAt: number } | null;
let cachedToken: CachedToken = null;
let tokenRequestInFlight: Promise<string> | null = null;

function requiredEnv(name: "OZON_DELIVERY_CLIENT_ID" | "OZON_DELIVERY_CLIENT_SECRET") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} не задана в Environment Variables ONREZA.`);
  return value;
}

function scopes() {
  const fromEnvironment = process.env.OZON_DELIVERY_SCOPES?.split(",")
    .map((scope) => scope.trim())
    .filter(Boolean);
  return fromEnvironment?.length ? fromEnvironment : DEFAULT_SCOPES;
}

function errorText(body: TokenResponse | null, status: number) {
  const message = body?.error_description ?? body?.message ?? body?.error;
  if (typeof message === "string" && message.trim()) return message.trim().slice(0, 500);
  return `Ozon вернул HTTP ${status} при получении токена Delivery API.`;
}

function isTrustedOzonUrl(value: string) {
  const url = new URL(value);
  return url.protocol === "https:" && ["xapi.ozon.ru", "api-delivery.ozon.ru"].includes(url.hostname);
}

function updateCookies(headers: Headers) {
  // Node exposes getSetCookie(); other fetch implementations may expose one
  // combined header. We need only name=value pairs for Ozon's testcookie.
  const nodeHeaders = headers as Headers & { getSetCookie?: () => string[] };
  const values = typeof nodeHeaders.getSetCookie === "function"
    ? nodeHeaders.getSetCookie()
    : headers.get("set-cookie") ? [headers.get("set-cookie")!] : [];
  const next = new Map(ozonCookies.split(/;\s*/).filter(Boolean).map((item) => {
    const index = item.indexOf("=");
    return [item.slice(0, index), item];
  }));
  for (const value of values) {
    const pair = value.split(";", 1)[0]?.trim();
    const index = pair?.indexOf("=") ?? -1;
    if (pair && index > 0) next.set(pair.slice(0, index), pair);
  }
  ozonCookies = [...next.values()].join("; ");
}

type OzonTrace = { statuses: number[] };

async function postToOzon(url: string, body: unknown, authorization?: string, trace?: OzonTrace, extraHeaders?: Record<string, string>) {
  let target = url;
  const requestBody = JSON.stringify(body);
  for (let attempt = 0; attempt <= MAX_REDIRECTS; attempt += 1) {
    if (!isTrustedOzonUrl(target)) throw new Error("Ozon вернул небезопасный адрес перенаправления API.");
    const headers: Record<string, string> = {
      "Content-Type": "application/json", Accept: "application/json",
      ...(authorization ? { Authorization: authorization } : {}),
      ...(ozonCookies ? { Cookie: ozonCookies } : {}),
      ...extraHeaders,
    };
    const response = await fetch(target, {
      method: "POST", headers, body: requestBody, cache: "no-store", redirect: "manual",
    });
    trace?.statuses.push(response.status);
    updateCookies(response.headers);
    if (![302, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location || attempt === MAX_REDIRECTS) {
      throw new Error("Ozon Delivery API запросил слишком много перенаправлений.");
    }
    target = new URL(location, target).toString();
  }
  throw new Error("Не удалось выполнить запрос к Ozon Delivery API.");
}

async function requestAccessToken() {
  const response = await postToOzon(TOKEN_ENDPOINT, {
    client_id: requiredEnv("OZON_DELIVERY_CLIENT_ID"),
    client_secret: requiredEnv("OZON_DELIVERY_CLIENT_SECRET"),
    grant_type: "client_credentials",
    scope: scopes(),
  });
  const body = await response.json().catch(() => null) as TokenResponse | null;
  if (!response.ok || !body || typeof body.access_token !== "string" || !body.access_token) {
    throw new Error(errorText(body, response.status));
  }

  // Refresh one minute before expiry. Ozon normally supplies expires_in; use a
  // conservative five-minute lifetime if it is absent or malformed.
  const expiresIn = typeof body.expires_in === "number" && Number.isFinite(body.expires_in)
    ? Math.max(60, body.expires_in)
    : 5 * 60;
  cachedToken = { value: body.access_token, expiresAt: Date.now() + (expiresIn - 60) * 1000 };
  return body.access_token;
}

/**
 * Server-only token for the separate Ozon Delivery application.
 * This app uses client_credentials: no redirect URI, callback, refresh token,
 * database persistence, or token exposure to a browser is involved.
 */
export async function getOzonDeliveryAccessToken() {
  if (cachedToken && cachedToken.expiresAt > Date.now()) return cachedToken.value;
  if (!tokenRequestInFlight) {
    tokenRequestInFlight = requestAccessToken().finally(() => { tokenRequestInFlight = null; });
  }
  return tokenRequestInFlight;
}

// Diagnostic text is rendered as text by the admin UI, never as HTML.
function safeDiagnosticText(text: string, accessToken: string) {
  const secrets = [
    accessToken, process.env.OZON_DELIVERY_CLIENT_SECRET,
    process.env.OZON_DELIVERY_CLIENT_ID,
    ...ozonCookies.split(/;\s*/).map((pair) => pair.slice(pair.indexOf("=") + 1)),
  ].filter((value): value is string => Boolean(value));
  let safe = text;
  for (const secret of secrets) safe = safe.split(secret).join("[REDACTED]");
  return safe
    .replace(/Bearer\s+[^\s"<>]+/gi, "Bearer [REDACTED]")
    .replace(/((?:access_token|refresh_token|client_secret|authorization|set-cookie|cookie)\s*["']?\s*[:=]\s*)(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s,;}]+)/gi, "$1[REDACTED]")
    .replace(/[\u0000-\u001f\u007f]/g, " ")
    .slice(0, 2000);
}

function diagnosticBody(value: unknown, depth = 0): unknown {
  if (depth > 5) return "[nested]";
  if (typeof value === "string") return value.slice(0, 2000);
  if (value === null || typeof value === "number" || typeof value === "boolean") return value;
  if (Array.isArray(value)) return value.slice(0, 10).map((item) => diagnosticBody(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).slice(0, 40).map(([key, item]) => [
      key, /token|secret|cookie|authorization|password|headers|request|body/i.test(key)
        ? "[REDACTED]" : diagnosticBody(item, depth + 1),
    ]));
  }
  return null;
}

/** Server-only POST wrapper for documented Ozon Delivery API endpoints. */
export async function postOzonDeliveryApi(path: string, body: unknown, extraHeaders?: Record<string, string>) {
  if (!/^\/v1\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(path)) {
    throw new Error("Некорректный путь Ozon Delivery API.");
  }
  const accessToken = await getOzonDeliveryAccessToken();
  const trace: OzonTrace = { statuses: [] };
  const response = await postToOzon(`${DELIVERY_API_ORIGIN}${path}`, body, `Bearer ${accessToken}`, trace, extraHeaders);
  const text = await response.text();
  let result: unknown = null;
  try { result = JSON.parse(text); } catch { /* Non-JSON protection response. */ }
  if (!response.ok) {
    const format = result !== null ? "JSON" : /<html|<!doctype/i.test(text) ? "HTML" : "text/empty";
    const summary = `Ozon ${path}: HTTP ${response.status}; format=${format}; HTTP chain=${trace.statuses.join(" -> ")}.`;
    // Never expose raw HTML: it can contain challenge cookies and scripts.
    // Only the admin point-search endpoints receive detailed diagnostics.
    // JSON error bodies from Ozon describe what was wrong with the request
    // (validation messages, error codes). They are passed through with secrets
    // and request/headers keys redacted. HTML and non-JSON bodies stay withheld.
    const detail = result !== null
      ? safeDiagnosticText(JSON.stringify(diagnosticBody(result)), accessToken)
      : "Response body withheld (non-JSON).";
    throw new Error(`${summary} ${detail}`);
  }
  if (!result || typeof result !== "object") throw new Error("Ozon Delivery API вернул некорректный ответ.");
  return result as Record<string, unknown>;
}

export type OzonRawResponse = {
  status: number;
  contentType: string;
  bytes: Uint8Array;
  /** Разобранный JSON, если ответ — JSON; иначе null. */
  json: unknown;
};

/**
 * Как postOzonDeliveryApi, но ответ читается байтами, а не текстом.
 * Нужен для этикеток: PDF, прочитанный через response.text(), необратимо
 * портится, поэтому общий вызов для бинарных ответов не подходит.
 */
export async function postOzonDeliveryApiRaw(
  path: string,
  body: unknown,
  extraHeaders?: Record<string, string>,
): Promise<OzonRawResponse> {
  if (!/^\/v1\/[a-z0-9-]+(?:\/[a-z0-9-]+)*$/.test(path)) {
    throw new Error("Некорректный путь Ozon Delivery API.");
  }
  const accessToken = await getOzonDeliveryAccessToken();
  const trace: OzonTrace = { statuses: [] };
  const response = await postToOzon(
    `${DELIVERY_API_ORIGIN}${path}`, body, `Bearer ${accessToken}`, trace, extraHeaders,
  );
  const bytes = new Uint8Array(await response.arrayBuffer());
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();
  let json: unknown = null;
  // JSON определяем и по заголовку, и по первому символу: Ozon не всегда его ставит.
  if (contentType.includes("json") || bytes[0] === 0x7b || bytes[0] === 0x5b) {
    try { json = JSON.parse(new TextDecoder().decode(bytes)); } catch { json = null; }
  }
  if (!response.ok) {
    const summary = `Ozon ${path}: HTTP ${response.status}; content-type=${contentType || "нет"}; HTTP chain=${trace.statuses.join(" -> ")}.`;
    const detail = json !== null
      ? safeDiagnosticText(JSON.stringify(diagnosticBody(json)), accessToken)
      : "Response body withheld (non-JSON).";
    throw new Error(`${summary} ${detail}`);
  }
  return { status: response.status, contentType, bytes, json };
}

export function getOzonDeliveryConfiguration() {
  return {
    configured: Boolean(process.env.OZON_DELIVERY_CLIENT_ID?.trim() && process.env.OZON_DELIVERY_CLIENT_SECRET?.trim()),
    scopes: scopes(),
  };
}
