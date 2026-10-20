import { randomUUID } from "node:crypto";
import { getDb } from "@/lib/db";
import { postOzonDeliveryApi } from "@/lib/ozon-delivery";
import { getOzonShipmentMethod } from "@/lib/ozon-shipment-method";

export type OzonDeliveryPoint = {
  id: string;
  name: string;
  address: string;
  type: "ozon_pvz" | "ozon_postamat";
  latitude: number | null;
  longitude: number | null;
};

export type OzonParcel = {
  weightGrams: number;
  widthMm: number;
  lengthMm: number;
  heightMm: number;
};

export type OzonDeliveryQuote = {
  deliveryPriceRubles: number;
  insurancePriceRubles: number;
  priceRubles: number;
  deliveryDays: number | null;
  cutoffAt: string | null;
};

// Раньше читались только 20 страниц по 100 — это 2000 пунктов на всю Россию,
// поэтому в Воронеже их почти не было. Теперь каталог читается целиком
// и хранится в базе, чтобы не перечитывать его при каждом перезапуске.
const POINTS_PAGE_LIMIT = 100;
const POINTS_MAX_PAGES = 3000;
const POINTS_INFO_BATCH = 100;
const POINTS_INFO_CONCURRENCY = 4;
const POINTS_FRESH_MS = 12 * 60 * 60 * 1000;
const POINTS_SEARCH_LIMIT = 2000;
const POINTS_NEARBY_LIMIT = 500;
/** Воронеж: показываем ближайшие пункты, пока покупатель ничего не ввёл. */
export const DEFAULT_POINTS_CENTER = { latitude: 51.6608, longitude: 39.2003 };
let pointsCache: { points: OzonDeliveryPoint[]; syncedAt: number } | null = null;
let pointsRefresh: Promise<number> | null = null;
let pointsSchemaReady: Promise<void> | null = null;

/** Ozon accepts only +7XXXXXXXXXX for customer phone numbers. */
export function toOzonPhoneNumber(phone: string) {
  const digits = phone.replace(/\D/g, "");
  const national = digits.length === 11 && /^[78]/.test(digits) ? digits.slice(1) : digits;
  if (national.length !== 10) {
    throw new Error("Для доставки Ozon укажите российский номер телефона, например +7 900 000-00-00.");
  }
  return `+7${national}`;
}

function records(value: unknown, depth = 0): Record<string, unknown>[] {
  if (depth > 8) return [];
  if (Array.isArray(value)) return value.flatMap((item) => records(item, depth + 1));
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap((item) => records(item, depth + 1))];
}

function text(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = record[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  return "";
}

function coordinate(value: unknown, min: number, max: number) {
  const raw = typeof value === "number" ? value : typeof value === "string" ? Number(value.trim()) : NaN;
  return Number.isFinite(raw) && raw >= min && raw <= max && raw !== 0 ? raw : null;
}

function integer(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return Math.trunc(value);
  if (typeof value === "string" && /^\d+$/.test(value.trim())) return Number(value.trim());
  return null;
}

/** Ozon sends money as a decimal string, e.g. "1250.50". Keep it exact in kopecks. */
function kopecks(value: unknown): number {
  const source = typeof value === "object" && value !== null
    ? (value as Record<string, unknown>).amount
    : value;
  const raw = typeof source === "number" ? String(source) : typeof source === "string" ? source.trim() : "";
  const match = /^(\d+)(?:[.,](\d{1,2}))?$/.exec(raw);
  if (!match) return 0;
  return Number(match[1]) * 100 + Number((match[2] ?? "0").padEnd(2, "0"));
}

function rublesUp(valueInKopecks: number) {
  return Math.ceil(valueInKopecks / 100);
}

function declaredValue(printPriceRubles: number) {
  if (!Number.isFinite(printPriceRubles) || printPriceRubles <= 0) {
    throw new Error("Не удалось определить стоимость заказа для доставки Ozon.");
  }
  return { amount: printPriceRubles.toFixed(2), currency_code: "RUB" };
}

/**
 * Int32 request_id that is unique for every call. Ozon remembers the quote per
 * request_id and returns the stored one for a repeat, so a stale id would bring
 * back an expired cutoff_at.
 */
export function freshRequestId() {
  return Math.floor(Math.random() * 2_000_000_000) + 1;
}

/** Ozon rejects cutoff_at in the past, so only a future value is worth sending. */
function futureCutoff(value: string | null) {
  if (!value) return null;
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return null;
  // Оставляем небольшой запас: пока запрос дойдёт, время не должно успеть истечь.
  return parsed > Date.now() + 60_000 ? value : null;
}

type OzonResultError = { code: string; message: string };

/** Первый объект error из results — Ozon кладёт туда отказ при HTTP 200. */
function ozonResultError(response: unknown): OzonResultError | null {
  for (const record of records(response)) {
    const error = record.error;
    if (error && typeof error === "object" && !Array.isArray(error)) {
      const details = error as Record<string, unknown>;
      return { code: text(details, ["code"]) || "OtherError", message: text(details, ["message"]) };
    }
  }
  return null;
}

const OZON_ERROR_TEXT: Record<string, string> = {
  DeliveryPointRestrictionsError: "Этот пункт выдачи не принимает отправление с такими параметрами (вес, размер или стоимость). Выберите другой пункт.",
  DeliveryCalculationError: "Ozon не смог рассчитать стоимость доставки или страховки для этого заказа.",
  DeliveryAvailabilityError: "Ozon не доставляет в выбранный пункт выдачи. Выберите другой пункт.",
  DeliveryPointNotFound: "Ozon не нашёл выбранный пункт выдачи. Выберите другой пункт.",
  RecipientError: "Ozon не может доставить заказ этому получателю. Проверьте телефон.",
  SamePointError: "Пункт выдачи совпадает с пунктом отгрузки. Выберите другой пункт.",
};

/** Понятный текст для покупателя плюс код и исходное сообщение Ozon для диагностики. */
function describeOzonError(error: OzonResultError) {
  const human = OZON_ERROR_TEXT[error.code] ?? "Ozon не смог рассчитать доставку.";
  return `${human} [${error.code}${error.message ? `: ${error.message}` : ""}]`;
}

function dimensions(parcel: OzonParcel) {
  const values = [parcel.weightGrams, parcel.lengthMm, parcel.widthMm, parcel.heightMm];
  if (!values.every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("Для доставки Ozon не заданы вес или габариты заказа.");
  }
  return {
    weight_g: Math.ceil(parcel.weightGrams),
    length_mm: Math.ceil(parcel.lengthMm),
    width_mm: Math.ceil(parcel.widthMm),
    height_mm: Math.ceil(parcel.heightMm),
  };
}

async function activeShipmentMethodId() {
  const method = await getOzonShipmentMethod();
  if (!method) throw new Error("Метод доставки Ozon ещё не создан в админке.");
  if (!/active/i.test(method.status)) {
    throw new Error(`Метод доставки Ozon пока не активен (статус: ${method.status}). Обновите статус в админке.`);
  }
  return Number(method.id);
}

/** POST /v1/delivery/check-client — Ozon delivers only to registered customers. */
export async function checkOzonClient(phone: string) {
  const response = await postOzonDeliveryApi("/v1/delivery/check-client", {
    phone_number: toOzonPhoneNumber(phone),
  });
  return records(response).some((record) => record.can_be_delivered === true);
}

/**
 * POST /v1/delivery-point/list returns ONLY { delivery_point_id, shipment_method_ids }.
 * Address, type and coordinates live behind /v1/delivery-point/info, so the
 * catalogue is assembled in two steps: collect ids, then hydrate them in batches.
 */
async function fetchOzonDeliveryPointIds() {
  const ids = new Set<string>();
  const seenCursors = new Set<string>();
  let cursor = "";
  for (let page = 0; page < POINTS_MAX_PAGES; page += 1) {
    const response = await postOzonDeliveryApi("/v1/delivery-point/list", {
      // cursor is nullable: an empty string is rejected by Ozon.
      pagination: cursor ? { limit: POINTS_PAGE_LIMIT, cursor } : { limit: POINTS_PAGE_LIMIT },
    });
    for (const item of records(response)) {
      const id = text(item, ["delivery_point_id"]);
      if (/^\d+$/.test(id)) ids.add(id);
    }
    // next_cursor sits at the top level of the response, not inside the items.
    const next = text(response, ["next_cursor"])
      || records(response).map((item) => text(item, ["next_cursor"])).find(Boolean)
      || "";
    if (!next || next === cursor || seenCursors.has(next)) break;
    seenCursors.add(next);
    cursor = next;
  }
  return [...ids];
}

/** POST /v1/delivery-point/info — details for up to POINTS_INFO_BATCH ids at a time. */
async function fetchOzonDeliveryPointBatch(batch: string[]) {
  const response = await postOzonDeliveryApi("/v1/delivery-point/info", {
    delivery_point_ids: batch.map(Number),
  });
  const points: OzonDeliveryPoint[] = [];
  for (const item of records(response)) {
    const id = text(item, ["delivery_point_id"]);
    const type = text(item, ["type"]).toLowerCase();
    const address = text(item, ["full_address", "address"]);
    if (!/^\d+$/.test(id) || !address) continue;
    if (item.is_active === false) continue;
    if (type !== "pvz" && type !== "postamat") continue;
    const name = text(item, ["name", "delivery_point_number"]) || address;
    const coordinates = item.coordinates && typeof item.coordinates === "object" && !Array.isArray(item.coordinates)
      ? item.coordinates as Record<string, unknown>
      : {};
    points.push({
      id, name, address,
      type: type === "postamat" ? "ozon_postamat" : "ozon_pvz",
      latitude: coordinate(coordinates.latitude ?? coordinates.lat, -90, 90),
      longitude: coordinate(coordinates.longitude ?? coordinates.lon ?? coordinates.lng, -180, 180),
    });
  }
  return points;
}

async function fetchOzonDeliveryPointDetails(ids: string[]) {
  const batches: string[][] = [];
  for (let start = 0; start < ids.length; start += POINTS_INFO_BATCH) {
    batches.push(ids.slice(start, start + POINTS_INFO_BATCH));
  }
  const unique = new Map<string, OzonDeliveryPoint>();
  let next = 0;
  // Несколько параллельных запросов: последовательно десятки тысяч пунктов
  // читались бы слишком долго, а без ограничения Ozon ответит 429.
  const worker = async () => {
    while (next < batches.length) {
      const batch = batches[next];
      next += 1;
      for (const point of await fetchOzonDeliveryPointBatch(batch)) unique.set(point.id, point);
    }
  };
  await Promise.all(Array.from({ length: POINTS_INFO_CONCURRENCY }, worker));
  return [...unique.values()];
}

function ensureOzonPointsSchema() {
  if (!pointsSchemaReady) {
    pointsSchemaReady = getDb().query(`
      CREATE TABLE IF NOT EXISTS ozon_delivery_points (
        id BIGINT PRIMARY KEY,
        name TEXT NOT NULL,
        address TEXT NOT NULL,
        type VARCHAR(20) NOT NULL,
        latitude DOUBLE PRECISION,
        longitude DOUBLE PRECISION,
        synced_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).then(() => undefined).catch((error) => {
      pointsSchemaReady = null;
      throw error;
    });
  }
  return pointsSchemaReady;
}

type StoredPoint = {
  id: string; name: string; address: string; type: string;
  latitude: number | null; longitude: number | null; synced_at: Date;
};

async function readStoredOzonPoints() {
  await ensureOzonPointsSchema();
  const result = await getDb().query<StoredPoint>(
    "SELECT id::text AS id, name, address, type, latitude, longitude, synced_at FROM ozon_delivery_points"
  );
  let syncedAt = 0;
  const points = result.rows.map((row) => {
    syncedAt = Math.max(syncedAt, new Date(row.synced_at).getTime());
    return {
      id: row.id, name: row.name, address: row.address,
      type: row.type === "ozon_postamat" ? "ozon_postamat" as const : "ozon_pvz" as const,
      latitude: row.latitude === null ? null : Number(row.latitude),
      longitude: row.longitude === null ? null : Number(row.longitude),
    };
  });
  return { points, syncedAt };
}

async function storeOzonPoints(points: OzonDeliveryPoint[]) {
  const db = getDb();
  const startedAt = new Date();
  for (let start = 0; start < points.length; start += 1000) {
    const chunk = points.slice(start, start + 1000);
    await db.query(`
      INSERT INTO ozon_delivery_points (id, name, address, type, latitude, longitude, synced_at)
      SELECT u.id, u.name, u.address, u.type, u.latitude, u.longitude, $7
      FROM unnest($1::bigint[], $2::text[], $3::text[], $4::text[], $5::float8[], $6::float8[])
        AS u(id, name, address, type, latitude, longitude)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, address = EXCLUDED.address,
        type = EXCLUDED.type, latitude = EXCLUDED.latitude, longitude = EXCLUDED.longitude,
        synced_at = EXCLUDED.synced_at
    `, [
      chunk.map((point) => point.id), chunk.map((point) => point.name),
      chunk.map((point) => point.address), chunk.map((point) => point.type),
      chunk.map((point) => point.latitude), chunk.map((point) => point.longitude), startedAt,
    ]);
  }
  // Закрытые пункты удаляются только после полной успешной выгрузки.
  await db.query("DELETE FROM ozon_delivery_points WHERE synced_at < $1", [startedAt]);
}

/**
 * Полная выгрузка каталога из Ozon в базу. Одновременно идёт только одна:
 * повторные вызовы получают тот же Promise.
 */
export function refreshOzonDeliveryPoints() {
  if (!pointsRefresh) {
    pointsRefresh = (async () => {
      await ensureOzonPointsSchema();
      const ids = await fetchOzonDeliveryPointIds();
      const points = await fetchOzonDeliveryPointDetails(ids);
      const previous = pointsCache?.points.length ?? 0;
      // Защита от частичного ответа: каталог, резко уменьшившийся вдвое,
      // скорее означает сбой Ozon, чем массовое закрытие пунктов.
      if (!points.length || (previous > 0 && points.length < previous / 2)) {
        throw new Error(`Ozon вернул подозрительно мало пунктов: ${points.length} (было ${previous}). Каталог не обновлён.`);
      }
      await storeOzonPoints(points);
      pointsCache = { points, syncedAt: Date.now() };
      return points.length;
    })().finally(() => { pointsRefresh = null; });
  }
  return pointsRefresh;
}

export async function getOzonPointsCatalogStatus() {
  await ensureOzonPointsSchema();
  const result = await getDb().query<{ count: string; synced_at: Date | null }>(
    "SELECT COUNT(*)::text AS count, MAX(synced_at) AS synced_at FROM ozon_delivery_points"
  );
  return {
    count: Number(result.rows[0]?.count ?? 0),
    syncedAt: result.rows[0]?.synced_at ?? null,
    refreshing: pointsRefresh !== null,
  };
}

async function loadOzonDeliveryPoints() {
  if (!pointsCache) {
    const stored = await readStoredOzonPoints();
    if (stored.points.length) pointsCache = stored;
  }
  if (!pointsCache) {
    // Самый первый запуск: каталога ещё нет, ждём выгрузку.
    await refreshOzonDeliveryPoints();
    // TypeScript не знает, что выгрузка заполнила кэш, поэтому читаем заново.
    const loaded = pointsCache as { points: OzonDeliveryPoint[]; syncedAt: number } | null;
    return loaded ? loaded.points : [];
  }
  if (Date.now() - pointsCache.syncedAt > POINTS_FRESH_MS) {
    // Устаревший каталог отдаём сразу, а свежий подгружаем в фоне.
    void refreshOzonDeliveryPoints().catch(() => undefined);
  }
  return pointsCache.points;
}

function distanceSquared(point: OzonDeliveryPoint) {
  if (point.latitude === null || point.longitude === null) return Number.POSITIVE_INFINITY;
  const lat = point.latitude - DEFAULT_POINTS_CENTER.latitude;
  const lon = (point.longitude - DEFAULT_POINTS_CENTER.longitude) * Math.cos(DEFAULT_POINTS_CENTER.latitude * Math.PI / 180);
  return lat * lat + lon * lon;
}

export async function searchOzonDeliveryPoints(query: string, limit = POINTS_SEARCH_LIMIT) {
  const points = await loadOzonDeliveryPoints();
  const words = query.trim().toLocaleLowerCase("ru-RU").split(/[\s,]+/).filter(Boolean);
  if (!words.length) {
    // Пустой запрос: ближайшие к Воронежу пункты, а не случайные по всей стране.
    const nearby = [...points].sort((a, b) => distanceSquared(a) - distanceSquared(b));
    return { points: nearby.slice(0, POINTS_NEARBY_LIMIT), total: points.length, matched: points.length };
  }
  // Все слова запроса должны встретиться: «воронеж ленина» не найдёт
  // улицу Ленина в другом городе.
  const matched = points.filter((point) => {
    const haystack = `${point.name} ${point.address}`.toLocaleLowerCase("ru-RU");
    return words.every((word) => haystack.includes(word));
  });
  return { points: matched.slice(0, limit), total: points.length, matched: matched.length };
}

export async function getOzonDeliveryPoint(id: string) {
  const points = await loadOzonDeliveryPoints();
  return points.find((point) => point.id === id) ?? null;
}

/** POST /v1/delivery-point/check-availability — point limits for this parcel. */
async function checkOzonPointAvailability(input: {
  pointId: string;
  shipmentMethodId: number;
  requestId: number;
  printPriceRubles: number;
  parcel: OzonParcel;
}) {
  const response = await postOzonDeliveryApi("/v1/delivery-point/check-availability", {
    delivery_point_ids: [Number(input.pointId)],
    shipment_method_id: input.shipmentMethodId,
    postings: [{
      request_id: input.requestId,
      declared_value: declaredValue(input.printPriceRubles),
      dimensions: dimensions(input.parcel),
    }],
  });
  // Only an explicit negative answer blocks the customer: /v1/order/checkout stays
  // the authoritative gate, so an unknown payload shape must not break checkout.
  // Ozon сообщает об ограничениях пункта объектом error внутри results,
  // а не флагом: раньше такие ответы молча считались «доступно».
  const problem = ozonResultError(response);
  if (problem) throw new Error(describeOzonError(problem));
  const denied = records(response).some((record) => {
    const sameId = text(record, ["delivery_point_id"]) === input.pointId;
    const unavailable = record.is_available === false || record.available === false
      || record.can_be_delivered === false;
    return sameId && unavailable;
  });
  return !denied;
}

/** POST /v1/order/checkout — preliminary cost, insurance, days and cutoff_at. */
async function requestOzonCheckout(input: {
  pointId: string;
  shipmentMethodId: number;
  requestId: number;
  phone: string;
  printPriceRubles: number;
  parcel: OzonParcel;
}): Promise<OzonDeliveryQuote> {
  const response = await postOzonDeliveryApi("/v1/order/checkout", {
    recipient: { phone_number: toOzonPhoneNumber(input.phone) },
    postings: [{
      request_id: input.requestId,
      shipment_method_id: input.shipmentMethodId,
      declared_value: declaredValue(input.printPriceRubles),
      dimensions: dimensions(input.parcel),
    }],
    delivery: { delivery_point: { delivery_point_id: Number(input.pointId) } },
  });
  const all = records(response);
  if (all.some((record) => record.can_be_delivered === false || record.is_available === false)) {
    throw new Error("Ozon не может доставить этот заказ в выбранный пункт выдачи. Выберите другой пункт.");
  }
  const priced = all.find((record) => "estimated_delivery_cost" in record || "estimated_delivery_days" in record);
  if (!priced) {
    const problem = ozonResultError(response);
    throw new Error(problem
      ? describeOzonError(problem)
      : "Ozon не вернул расчёт стоимости доставки. Попробуйте позже.");
  }
  const deliveryKopecks = kopecks(priced.estimated_delivery_cost);
  const insuranceKopecks = kopecks(priced.estimated_insurance_cost);
  const deliveryPriceRubles = rublesUp(deliveryKopecks);
  const insurancePriceRubles = rublesUp(insuranceKopecks);
  return {
    deliveryPriceRubles,
    insurancePriceRubles,
    priceRubles: deliveryPriceRubles + insurancePriceRubles,
    deliveryDays: integer(priced.estimated_delivery_days),
    cutoffAt: text(priced, ["cutoff_at"]) || null,
  };
}

export async function quoteOzonPickupDelivery(input: {
  orderId: string;
  pointId: string;
  phone: string;
  printPriceRubles: number;
  parcel: OzonParcel;
}) {
  if (!/^\d+$/.test(input.pointId)) throw new Error("Выберите пункт выдачи Ozon.");
  if (!(await checkOzonClient(input.phone))) {
    throw new Error("Этот номер не зарегистрирован на Ozon. Доставка Ozon доступна только покупателям Ozon.");
  }
  const shipmentMethodId = await activeShipmentMethodId();
  // Каждый вызов получает новый request_id: Ozon кэширует расчёт по нему,
  // и повторный id вернул бы устаревшую цену вместо актуальной.
  const requestId = freshRequestId();
  const available = await checkOzonPointAvailability({
    pointId: input.pointId, shipmentMethodId, requestId,
    printPriceRubles: input.printPriceRubles, parcel: input.parcel,
  });
  if (!available) {
    throw new Error("Выбранный пункт Ozon не принимает этот заказ по габаритам или стоимости. Выберите другой пункт.");
  }
  return requestOzonCheckout({
    pointId: input.pointId, shipmentMethodId, requestId, phone: input.phone,
    printPriceRubles: input.printPriceRubles, parcel: input.parcel,
  });
}

type ClaimedOzonOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  pickup_point_id: string | null;
  print_price: number;
  delivery_price: number | null;
  package_weight_grams: number;
  package_width_mm: number;
  package_length_mm: number;
  package_height_mm: number;
  ozon_delivery_idempotency_key: string;
};

type ClaimedApprove = {
  id: string;
  order_number: string;
  ozon_posting_number: string | null;
  ozon_cutoff_at: Date | null;
};

/**
 * POST /v1/posting/approve — шаг, без которого созданный заказ оставался
 * черновиком и не попадал в логистику Ozon.
 *
 * Строка захватывается заранее: два одновременных вызова не подтвердят заказ
 * дважды. Повторный запуск возможен из admin-роута после сбоя.
 */
export async function approveOzonDeliveryForPaidOrder(orderId: string) {
  const db = getDb();
  const claimed = await db.query<ClaimedApprove>(`
    UPDATE orders SET ozon_delivery_status = 'approving', ozon_delivery_error = NULL, updated_at = NOW()
    WHERE id = $1 AND status = 'paid' AND fulfillment_method = 'ozon_pickup_point'
      AND ozon_posting_number IS NOT NULL AND ozon_order_number IS NOT NULL
      AND COALESCE(ozon_delivery_status, '') IN ('created', 'approve_failed', 'approve_expired')
    RETURNING id, order_number, ozon_posting_number, ozon_cutoff_at
  `, [orderId]);
  const order = claimed.rows[0];
  if (!order) return false;

  try {
    const postingNumber = order.ozon_posting_number as string;

    // Просроченный слот Ozon отвергнет валидацией, поэтому такой заказ уходит
    // оператору, а не в бесконечный повтор заведомо неудачного запроса.
    if (order.ozon_cutoff_at && new Date(order.ozon_cutoff_at).getTime() < Date.now()) {
      throw new Error(
        `Срок отгрузки истёк ${new Date(order.ozon_cutoff_at).toLocaleString("ru-RU")}. ` +
          "Подтвердите заказ в кабинете Ozon или оформите его заново."
      );
    }

    const response = await postOzonDeliveryApi("/v1/posting/approve", {
      posting_numbers: [postingNumber],
    });

    // Ozon отвечает 200 и при ошибке по конкретному отправлению — читаем results.
    const failure = records(response).find(
      (record) => record.error && typeof record.error === "object"
    );
    if (failure) {
      const error = failure.error as Record<string, unknown>;
      const code = text(error, ["code"]) || "OtherError";
      const message = text(error, ["message"]) || "Ошибка подтверждения отправления.";
      if (code === "NotEnoughBalance") {
        throw new Error(
          `Недостаточно средств на балансе Ozon для подтверждения отправления ${postingNumber}. ` +
            "Пополните баланс и повторите подтверждение."
        );
      }
      if (code === "PostingNotFound") {
        throw new Error(
          `Отправление ${postingNumber} не найдено в Ozon. Проверьте номер отправления.`
        );
      }
      throw new Error(`Ozon ${code}: ${message}`);
    }

    await db.query(`
      UPDATE orders SET ozon_delivery_status = 'approved', ozon_delivery_error = NULL,
        ozon_delivery_approved_at = NOW(), updated_at = NOW()
      WHERE id = $1 AND ozon_delivery_status = 'approving'
    `, [order.id]);
    return true;
  } catch (cause) {
    const message = cause instanceof Error
      ? cause.message.slice(0, 2000)
      : "Unknown Ozon approve error";
    // Просроченный слот помечается отдельно: повторять его бессмысленно,
    // заказ требует ручной обработки оператором.
    const expired = message.includes("Срок отгрузки истёк");
    await db.query(`
      UPDATE orders SET ozon_delivery_status = $1, ozon_delivery_error = $2, updated_at = NOW()
      WHERE id = $3 AND ozon_delivery_status = 'approving'
    `, [expired ? "approve_expired" : "approve_failed", message, order.id]);
    throw cause;
  }
}

/**
 * Creates the Ozon order after the payment is confirmed.
 * The row is claimed first, so a webhook and a status poll cannot create it twice,
 * and the stored Idempotency-Key is reused on every retry.
 */
export async function createOzonDeliveryForPaidOrder(orderId: string) {
  const db = getDb();
  const claimed = await db.query<ClaimedOzonOrder>(`
    UPDATE orders SET ozon_delivery_status = 'creating', ozon_delivery_error = NULL,
      ozon_delivery_idempotency_key = COALESCE(ozon_delivery_idempotency_key, $2), updated_at = NOW()
    WHERE id = $1 AND status = 'paid' AND fulfillment_method = 'ozon_pickup_point'
      AND ozon_order_number IS NULL AND COALESCE(ozon_delivery_status, '') <> 'creating'
    RETURNING id, order_number, customer_name, customer_phone, pickup_point_id, print_price, delivery_price,
      package_weight_grams, package_width_mm, package_length_mm, package_height_mm, ozon_delivery_idempotency_key
  `, [orderId, randomUUID()]);
  const order = claimed.rows[0];
  if (!order) return false;
  try {
    if (!order.pickup_point_id) throw new Error("Не сохранён пункт выдачи Ozon.");
    const parcel: OzonParcel = {
      weightGrams: Number(order.package_weight_grams), widthMm: Number(order.package_width_mm),
      lengthMm: Number(order.package_length_mm), heightMm: Number(order.package_height_mm),
    };
    const printPriceRubles = Number(order.print_price);
    const shipmentMethodId = await activeShipmentMethodId();
    // Ozon requires /v1/order/checkout with the same parameters right before creating the order.
    // request_id must be fresh: Ozon treats it as an idempotency key and replays the
    // earlier result for a repeated id. Reusing the order id here returned the quote
    // computed at checkout time, including its now-expired cutoff_at, and order/create
    // then failed with "Плановый момент отгрузки не может быть в прошлом".
    const requestId = freshRequestId();
    const quote = await requestOzonCheckout({
      pointId: order.pickup_point_id, shipmentMethodId, requestId,
      phone: order.customer_phone, printPriceRubles, parcel,
    });
    const cutoffAt = futureCutoff(quote.cutoffAt);
    const paidDeliveryPrice = Number(order.delivery_price ?? 0);
    if (quote.priceRubles !== paidDeliveryPrice) {
      // Never ship on economics the customer did not pay for: leave it for an operator.
      throw new Error(`Ozon изменил стоимость доставки после оплаты: оплачено ${paidDeliveryPrice} ₽, сейчас ${quote.priceRubles} ₽. Заказ в Ozon не создан.`);
    }
    const response = await postOzonDeliveryApi("/v1/order/create", {
      order_external_id: order.order_number,
      recipient: {
        full_name: order.customer_name,
        phone_number: toOzonPhoneNumber(order.customer_phone),
      },
      delivery: { delivery_point: { delivery_point_id: Number(order.pickup_point_id) } },
      postings: [{
        request_id: requestId,
        posting_external_id: order.order_number,
        shipment_method_id: shipmentMethodId,
        description: `Печатная продукция, заказ ${order.order_number}`,
        declared_value: declaredValue(printPriceRubles),
        dimensions: dimensions(parcel),
        ...(cutoffAt ? { cutoff_at: cutoffAt } : {}),
      }],
    }, { "Idempotency-Key": order.ozon_delivery_idempotency_key });
    const ozonOrderNumber = records(response).map((record) => text(record, ["order_number"])).find(Boolean) ?? "";
    if (!ozonOrderNumber) throw new Error("Ozon не вернул номер созданного заказа.");
    const postingNumber = records(response).map((record) => text(record, ["posting_number"])).find(Boolean) ?? null;
    await db.query(`
      UPDATE orders SET ozon_order_number = $1, ozon_posting_number = $2, ozon_delivery_status = 'created',
        ozon_delivery_error = NULL, ozon_delivery_created_at = NOW(), updated_at = NOW()
      WHERE id = $3 AND ozon_delivery_status = 'creating'
    `, [ozonOrderNumber, postingNumber, order.id]);
    // Подтверждение к отгрузке — отдельный шаг: без него отправление не попадает
    // в логистику Ozon. Его сбой не должен отменять уже созданный заказ, поэтому
    // статус заказа остаётся 'created', а причина ложится в ozon_delivery_error.
    await approveOzonDeliveryForPaidOrder(order.id).catch(() => undefined);
    return true;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 2000) : "Unknown Ozon Delivery creation error";
    await db.query(`UPDATE orders SET ozon_delivery_status = 'failed', ozon_delivery_error = $1, updated_at = NOW()
      WHERE id = $2 AND ozon_delivery_status = 'creating'`, [message, order.id]);
    throw cause;
  }
}
