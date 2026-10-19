/**
 * Показывает сырой ответ Ozon /v1/delivery-point/list и объясняет,
 * какой именно фильтр отбросил каждую запись.
 *
 * Запуск:  node dump-ozon-raw.mjs
 * Нужны только OZON_DELIVERY_CLIENT_ID / OZON_DELIVERY_CLIENT_SECRET.
 */

import { readFileSync, existsSync } from "node:fs";

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
  console.error("Нет OZON_DELIVERY_CLIENT_ID или OZON_DELIVERY_CLIENT_SECRET.");
  process.exit(1);
}

let cookies = "";
function rememberCookies(headers) {
  const raw = headers.getSetCookie?.() ?? [];
  if (!raw.length) return;
  const jar = new Map(
    cookies.split(/;\s*/).filter(Boolean).map((i) => [i.slice(0, i.indexOf("=")), i])
  );
  for (const entry of raw) {
    const pair = entry.split(";", 1)[0]?.trim();
    const eq = pair?.indexOf("=") ?? -1;
    if (pair && eq > 0) jar.set(pair.slice(0, eq), pair);
  }
  cookies = [...jar.values()].join("; ");
}

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
  throw new Error("Слишком много редиректов.");
}

const tokenResponse = await post(TOKEN_URL, {
  client_id: clientId,
  client_secret: clientSecret,
  grant_type: "client_credentials",
  scope: SCOPES,
});
const tokenBody = await tokenResponse.json().catch(() => null);
if (!tokenResponse.ok || typeof tokenBody?.access_token !== "string") {
  console.error("Токен не получен:", tokenResponse.status, tokenBody);
  process.exit(2);
}
console.log("Токен получен.\n");

const response = await post(
  `${API_URL}/v1/delivery-point/list`,
  { pagination: { limit: 100 } },
  { Authorization: `Bearer ${tokenBody.access_token}` }
);
const text = await response.text();
let body = null;
try {
  body = JSON.parse(text);
} catch {
  console.error(`Ответ не JSON, HTTP ${response.status}`);
  console.error(text.slice(0, 600));
  process.exit(3);
}

console.log(`HTTP ${response.status}`);
console.log(`Верхний уровень ответа: ${Object.keys(body).join(", ")}`);
console.log(`pagination: ${JSON.stringify(body.pagination ?? null)}`);

const items = Array.isArray(body.delivery_points) ? body.delivery_points : [];
console.log(`delivery_points: ${items.length} записей\n`);

if (!items.length) {
  console.log("Полный ответ:");
  console.log(JSON.stringify(body, null, 2).slice(0, 3000));
  process.exit(0);
}

console.log("=== Первые 2 записи целиком ===");
console.log(JSON.stringify(items.slice(0, 2), null, 2).slice(0, 2500));
console.log();

// --- разбор фильтров из lib/ozon-order.ts ---
const stats = {
  noId: 0,
  idNotDigits: 0,
  idExponential: 0,
  noAddress: 0,
  inactive: 0,
  wrongType: 0,
  passed: 0,
};
const typeCounts = new Map();
const fieldNames = new Map();

for (const item of items) {
  for (const key of Object.keys(item ?? {})) {
    fieldNames.set(key, (fieldNames.get(key) ?? 0) + 1);
  }

  const rawId = item?.delivery_point_id;
  const idText = String(rawId ?? "");
  const address = item?.full_address ?? item?.address ?? "";
  const type = String(item?.type ?? "").toLowerCase();
  typeCounts.set(type || "(пусто)", (typeCounts.get(type || "(пусто)") ?? 0) + 1);

  if (!idText) stats.noId += 1;
  else if (/e\+|\./.test(idText)) stats.idExponential += 1;
  else if (!/^\d+$/.test(idText)) stats.idNotDigits += 1;

  if (!address) stats.noAddress += 1;
  if (item?.is_active === false) stats.inactive += 1;
  if (type !== "pvz" && type !== "postamat") stats.wrongType += 1;

  const ok =
    /^\d+$/.test(idText) &&
    address &&
    item?.is_active !== false &&
    (type === "pvz" || type === "postamat");
  if (ok) stats.passed += 1;
}

console.log("=== Поля, которые реально пришли ===");
for (const [name, count] of [...fieldNames].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${name.padEnd(28)} ${count}/${items.length}`);
}

console.log("\n=== Значения type ===");
for (const [type, count] of [...typeCounts].sort((a, b) => b[1] - a[1])) {
  console.log(`  "${type}" — ${count}`);
}

console.log("\n=== Почему отброшено (счётчики могут пересекаться) ===");
console.log(`  нет delivery_point_id        ${stats.noId}`);
console.log(`  id в экспоненте (потеря)     ${stats.idExponential}   <-- int64 больше 2^53`);
console.log(`  id не из цифр                ${stats.idNotDigits}`);
console.log(`  нет адреса                   ${stats.noAddress}`);
console.log(`  is_active === false          ${stats.inactive}`);
console.log(`  type не pvz/postamat         ${stats.wrongType}`);
console.log(`  ПРОШЛО ФИЛЬТР                ${stats.passed}`);

if (stats.idExponential > 0) {
  console.log(
    "\nНайдена причина: delivery_point_id больше 2^53, JSON.parse теряет точность,\n" +
      "и String() даёт \"1.2345678901234568e+18\" вместо цифр."
  );
}
if (stats.wrongType === items.length) {
  console.log(
    "\nВсе записи одного типа, отличного от pvz/postamat — см. блок «Значения type»."
  );
}
