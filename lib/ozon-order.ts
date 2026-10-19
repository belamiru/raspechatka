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

const POINTS_CACHE_TTL_MS = 10 * 60 * 1000;
const POINTS_PAGE_LIMIT = 100;
const POINTS_MAX_PAGES = 20;
const POINTS_INFO_BATCH = 100;
let pointsCache: { points: OzonDeliveryPoint[]; expiresAt: number } | null = null;

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
async function fetchOzonDeliveryPointDetails(ids: string[]) {
  const unique = new Map<string, OzonDeliveryPoint>();
  for (let start = 0; start < ids.length; start += POINTS_INFO_BATCH) {
    const batch = ids.slice(start, start + POINTS_INFO_BATCH).map(Number);
    const response = await postOzonDeliveryApi("/v1/delivery-point/info", {
      delivery_point_ids: batch,
    });
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
      unique.set(id, {
        id, name, address,
        type: type === "postamat" ? "ozon_postamat" : "ozon_pvz",
        latitude: coordinate(coordinates.latitude ?? coordinates.lat, -90, 90),
        longitude: coordinate(coordinates.longitude ?? coordinates.lon ?? coordinates.lng, -180, 180),
      });
    }
  }
  return [...unique.values()];
}

async function loadOzonDeliveryPoints() {
  if (pointsCache && pointsCache.expiresAt > Date.now()) return pointsCache.points;
  const ids = await fetchOzonDeliveryPointIds();
  if (!ids.length) return [];
  const points = await fetchOzonDeliveryPointDetails(ids);
  if (points.length) pointsCache = { points, expiresAt: Date.now() + POINTS_CACHE_TTL_MS };
  return points;
}

export async function searchOzonDeliveryPoints(query: string, limit = 300) {
  const points = await loadOzonDeliveryPoints();
  const needle = query.trim().toLocaleLowerCase("ru-RU");
  const matched = needle
    ? points.filter((point) => `${point.name} ${point.address}`.toLocaleLowerCase("ru-RU").includes(needle))
    : points;
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
  if (!priced) throw new Error("Ozon не вернул расчёт стоимости доставки. Попробуйте позже.");
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
  const requestId = Number(input.orderId);
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
    return true;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 2000) : "Unknown Ozon Delivery creation error";
    await db.query(`UPDATE orders SET ozon_delivery_status = 'failed', ozon_delivery_error = $1, updated_at = NOW()
      WHERE id = $2 AND ozon_delivery_status = 'creating'`, [message, order.id]);
    throw cause;
  }
}
