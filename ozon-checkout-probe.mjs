/**
 * Перебор параметров /v1/order/checkout: находит, что именно не принимает Ozon.
 *
 * Запуск:
 *   node ozon-checkout-probe.mjs <id пункта> <id метода доставки> <телефон на Ozon>
 *
 * Пример:
 *   node ozon-checkout-probe.mjs 88522 1020005033430360 79000000000
 *
 * Токен берётся из .env.local или из переменных окружения.
 * Деньги не списываются, заказы не создаются — только расчёт.
 */

import { readFileSync, existsSync } from "node:fs";

if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split(/\r?\n/)) {
    const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/.exec(line);
    if (!match) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
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

const [pointArg, methodArg, phoneArg] = process.argv.slice(2);
if (!pointArg || !methodArg || !phoneArg) {
  console.error("Нужны аргументы: <id пункта> <id метода доставки> <телефон на Ozon>");
  process.exit(1);
}

function toOzonPhone(phone) {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : digits;
  if (national.length !== 10) throw new Error("Телефон должен быть российским: 10 цифр после +7.");
  return `+7${national}`;
}

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
    cookies.split(/;\s*/).filter(Boolean).map((item) => [item.slice(0, item.indexOf("=")), item])
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

// --- токен ---
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

function records(value, depth = 0) {
  if (depth > 8) return [];
  if (Array.isArray(value)) return value.flatMap((item) => records(item, depth + 1));
  if (!value || typeof value !== "object") return [];
  return [value, ...Object.values(value).flatMap((item) => records(item, depth + 1))];
}

/** Один расчёт. Возвращает { ok, cost, error }. */
async function probe({ declaredRubles, weightGrams, heightMm, lengthMm = 327, widthMm = 240 }) {
  const requestId = Math.floor(Math.random() * 2_000_000_000) + 1;
  const response = await post(`${API_URL}/v1/order/checkout`, {
    recipient: { phone_number: toOzonPhone(phoneArg) },
    postings: [{
      request_id: requestId,
      shipment_method_id: Number(methodArg),
      declared_value: { amount: declaredRubles.toFixed(2), currency_code: "RUB" },
      dimensions: { weight_g: weightGrams, length_mm: lengthMm, width_mm: widthMm, height_mm: heightMm },
    }],
    delivery: { delivery_point: { delivery_point_id: Number(pointArg) } },
  }, { Authorization: `Bearer ${tokenBody.access_token}` });

  const text = await response.text();
  let body = null;
  try { body = JSON.parse(text); } catch { /* не JSON */ }

  if (!body) return { ok: false, error: `HTTP ${response.status}, ответ не JSON` };

  const priced = records(body).find((record) => "estimated_delivery_cost" in record);
  if (priced) {
    const amount = priced.estimated_delivery_cost?.amount ?? "?";
    return { ok: true, cost: `${amount} ₽` };
  }
  const failure = records(body).find((record) => record.error && typeof record.error === "object");
  if (failure) {
    const code = failure.error.code ?? "?";
    const message = failure.error.message ?? "";
    return { ok: false, error: `${code}: ${message}` };
  }
  return { ok: false, error: `HTTP ${response.status}: ${JSON.stringify(body).slice(0, 200)}` };
}

const php = (value) => (value ? "OK  " : "FAIL");
const label = (item) => `стоимость ${String(item.declaredRubles).padStart(5)} ₽ · вес ${String(item.weightGrams).padStart(4)} г · высота ${String(item.heightMm).padStart(3)} мм`;

console.log(`Пункт: ${pointArg}, метод доставки: ${methodArg}, телефон: ${toOzonPhone(phoneArg)}`);
console.log("Габариты: 240 × 327 мм, меняем стоимость, вес и высоту.\n");

// Базовый случай — ровно то, что отправляет приложение для мелкого заказа.
const base = { declaredRubles: 90, weightGrams: 55, heightMm: 11 };
const baseline = await probe(base);
console.log(`Базовый случай (как в приложении): ${php(baseline.ok)} ${baseline.ok ? baseline.cost : baseline.error}\n`);

if (baseline.ok) {
  console.log("Базовый расчёт работает. Значит проблема не в габаритах и не в цене,");
  console.log("а в параметрах конкретного заказа (пункт, телефон или метод доставки).");
  process.exit(0);
}

// --- перебор по одному параметру ---
const sweeps = [
  { title: "Только стоимость (вес 55 г, высота 11 мм)", values: [90, 200, 300, 500, 1000, 3000, 10000].map((v) => ({ ...base, declaredRubles: v })) },
  { title: "Только вес (стоимость 90 ₽, высота 11 мм)", values: [55, 100, 150, 200, 300, 500, 1000, 5000].map((v) => ({ ...base, weightGrams: v })) },
  { title: "Только высота (стоимость 90 ₽, вес 55 г)", values: [11, 15, 20, 30, 50, 100, 200].map((v) => ({ ...base, heightMm: v })) },
];

const working = [];
for (const sweep of sweeps) {
  console.log(`--- ${sweep.title} ---`);
  for (const item of sweep.values) {
    const result = await probe(item);
    if (result.ok) working.push({ ...item, result });
    console.log(`  ${php(result.ok)} ${label(item)}  ->  ${result.ok ? result.cost : result.error}`);
  }
  console.log();
}

// --- вывод ---
console.log("=== ИТОГ ===");
if (!working.length) {
  console.log("Ни одна комбинация не прошла. Причина не в габаритах и не в стоимости:");
  console.log("  • пункт не принимает отправления вообще (попробуйте другой ПВЗ);");
  console.log("  • метод доставки не совпадает с пунктом;");
  console.log("  • телефон не зарегистрирован на Ozon.");
  console.log("Для проверки запустите тот же скрипт с другим пунктом выдачи.");
  process.exit(3);
}

const min = (key) => Math.min(...working.map((item) => item[key]));
const max = (key) => Math.max(...working.map((item) => item[key]));

console.log(`Прошло вариантов: ${working.length}`);
const values = {
  "стоимость, ₽": [min("declaredRubles"), max("declaredRubles")],
  "вес, г": [min("weightGrams"), max("weightGrams")],
  "высота, мм": [min("heightMm"), max("heightMm")],
};
for (const [name, [low, high]] of Object.entries(values)) {
  if (low !== high) console.log(`  рабочий диапазон ${name}: ${low} … ${high}`);
}

const baseFailed = !baseline.ok;
if (baseFailed && min("weightGrams") > base.weightGrams) {
  console.log(`\nПричина: вес ${base.weightGrams} г меньше минимального. Ozon принимает от ${min("weightGrams")} г.`);
  console.log("Печатная продукция на 1–2 листах весит около 55 г — такие заказы этот пункт не берёт.");
}
if (baseFailed && min("declaredRubles") > base.declaredRubles) {
  console.log(`\nПричина: стоимость ${base.declaredRubles} ₽ меньше минимальной. Ozon принимает от ${min("declaredRubles")} ₽.`);
}
if (baseFailed && min("heightMm") > base.heightMm) {
  console.log(`\nПричина: высота ${base.heightMm} мм меньше минимальной. Ozon принимает от ${min("heightMm")} мм.`);
  console.log("В lib/order-parcel.ts высота считается как 10 мм упаковки + толщина бумаги.");
}
