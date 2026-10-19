/**
 * Проверка Ozon Delivery API без Next.js и без PostgreSQL.
 *
 * Нужны только ключи интеграции Ozon Delivery.
 * Запуск:  node check-ozon-points.mjs
 *
 * Читает .env.local, если он есть, иначе берёт переменные из окружения.
 */

import { readFileSync, existsSync } from "node:fs";

// --- минимальный парсер .env.local (без зависимостей) ---
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!process.env[match[1]]) process.env[match[1]] = value;
  }
}

const TOKEN_URL = "https://xapi.ozon.ru/oauth/token";
const API_URL = "https://api-delivery.ozon.ru";

const SCOPES = [
  "delivery-api.delivery",
  "delivery-api.delivery-point",
  "delivery-api.dropoff-point",
  "delivery-api.order",
  "delivery-api.posting",
  "delivery-api.return",
  "delivery-api.return-point",
  "delivery-api.shipment-method",
];

const clientId = process.env.OZON_DELIVERY_CLIENT_ID?.trim();
const clientSecret = process.env.OZON_DELIVERY_CLIENT_SECRET?.trim();

if (!clientId || !clientSecret) {
  console.error(
    "Нет OZON_DELIVERY_CLIENT_ID или OZON_DELIVERY_CLIENT_SECRET.\n" +
      "Добавьте их в .env.local или задайте в сессии PowerShell."
  );
  process.exit(1);
}

let cookies = "";

function rememberCookies(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  if (!raw.length) return;
  const jar = new Map(
    cookies
      .split(/;\s*/)
      .filter(Boolean)
      .map((item) => [item.slice(0, item.indexOf("=")), item])
  );
  for (const entry of raw) {
    const pair = entry.split(";", 1)[0]?.trim();
    const eq = pair?.indexOf("=") ?? -1;
    if (pair && eq > 0) jar.set(pair.slice(0, eq), pair);
  }
  cookies = [...jar.values()].join("; ");
}

/** Ozon отвечает 302/307 + Set-Cookie на первом запросе — нужно пройти редирект вручную. */
async function post(url, body, extraHeaders = {}) {
  let target = url;
  for (let attempt = 0; attempt <= 3; attempt += 1) {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(cookies ? { Cookie: cookies } : {}),
        ...extraHeaders,
      },
      body: JSON.stringify(body),
      redirect: "manual",
    });
    rememberCookies(response.headers);
    if (![302, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) return response;
    target = new URL(location, target).toString();
  }
  throw new Error("Слишком много редиректов от Ozon.");
}

async function getToken() {
  const response = await post(TOKEN_URL, {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "client_credentials",
    scope: SCOPES,
  });
  const text = await response.text();
  let body = null;
  try {
    body = JSON.parse(text);
  } catch {
    /* не JSON */
  }
  if (!response.ok || typeof body?.access_token !== "string") {
    console.error(`\nТОКЕН НЕ ПОЛУЧЕН — HTTP ${response.status}`);
    if (body) {
      console.error(JSON.stringify(body, null, 2));
    } else {
      console.error(
        `Ответ не JSON (${text.length} байт). Первые 300 символов:\n` +
          text.slice(0, 300)
      );
    }
    console.error(
      "\nПроверьте: client_id/client_secret относятся к приложению Ozon Delivery,\n" +
        "приложению выданы scopes delivery-api.*, IP не заблокирован."
    );
    process.exit(2);
  }
  return body.access_token;
}

function pointCoordinates(record) {
  const coords = record.coordinates;
  if (!coords || typeof coords !== "object" || Array.isArray(coords)) {
    return null;
  }
  const lat = Number(coords.latitude ?? coords.lat);
  const lon = Number(coords.longitude ?? coords.lon ?? coords.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || (lat === 0 && lon === 0)) {
    return null;
  }
  return { lat, lon };
}

/** То же, что делает lib/ozon-order.ts: обход всех страниц по курсору. */
async function listPoints(token) {
  const auth = { Authorization: `Bearer ${token}` };
  const unique = new Map();
  const seenCursors = new Set();
  let cursor = "";
  let pages = 0;
  let rawTotal = 0;
  let withCoords = 0;

  while (pages < 50) {
    pages += 1;
    const payload = cursor
      ? { pagination: { limit: 100, cursor } }
      : { pagination: { limit: 100 } };

    const response = await post(
      `${API_URL}/v1/delivery-point/list`,
      payload,
      auth
    );
    const text = await response.text();
    let body = null;
    try {
      body = JSON.parse(text);
    } catch {
      /* не JSON */
    }
    if (!response.ok) {
      console.error(`\nСПИСОК ПВЗ НЕ ПОЛУЧЕН — HTTP ${response.status}`);
      console.error(body ? JSON.stringify(body, null, 2) : text.slice(0, 400));
      process.exit(3);
    }

    const items = Array.isArray(body?.delivery_points) ? body.delivery_points : [];
    rawTotal += items.length;

    for (const item of items) {
      const id = String(item.delivery_point_id ?? "");
      const type = String(item.type ?? "").toLowerCase();
      const address = item.full_address ?? item.address ?? "";
      if (!/^\d+$/.test(id) || !address) continue;
      if (item.is_active === false) continue;
      if (type !== "pvz" && type !== "postamat") continue;
      const coords = pointCoordinates(item);
      if (coords) withCoords += 1;
      unique.set(id, {
        id,
        name: item.name || item.delivery_point_number || address,
        address,
        type,
        coords,
      });
    }

    cursor = body?.pagination?.cursor ?? body?.pagination?.next_cursor ?? "";
    if (!cursor || seenCursors.has(cursor)) break;
    seenCursors.add(cursor);
  }

  return { points: [...unique.values()], pages, rawTotal, withCoords };
}

const token = await getToken();
console.log("Токен Ozon получен.\n");

const { points, pages, rawTotal, withCoords } = await listPoints(token);

console.log(`Страниц запрошено: ${pages}`);
console.log(`Записей от Ozon:   ${rawTotal}`);
console.log(`Подходящих ПВЗ:    ${points.length}`);
console.log(`С координатами:    ${withCoords}`);

if (!points.length) {
  console.log(
    "\nПВЗ не вернулись. Это ответ Ozon, не ошибка приложения.\n" +
      "Проверьте, что договору Ozon Delivery подключены пункты выдачи."
  );
  process.exit(0);
}

console.log("\nПервые 5 пунктов:");
for (const point of points.slice(0, 5)) {
  console.log(
    `  ${point.id}  ${point.type.padEnd(8)}  ${point.address}` +
      (point.coords
        ? `  [${point.coords.lat.toFixed(5)}, ${point.coords.lon.toFixed(5)}]`
        : "  [без координат]")
  );
}

console.log("\nПоиск по слову «Воронеж»:");
const needle = "воронеж";
const matched = points.filter((point) =>
  `${point.name} ${point.address}`.toLowerCase().includes(needle)
);
console.log(`  найдено: ${matched.length}`);
for (const point of matched.slice(0, 5)) {
  console.log(`  ${point.id}  ${point.address}`);
}

console.log(
  "\nЕсли «С координатами» > 0 — карта в патче заработает.\n" +
    "Если 0 — точки есть, но без координат, и останется только список."
);
