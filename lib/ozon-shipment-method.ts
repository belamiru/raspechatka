import { getDb } from "@/lib/db";
import { postOzonDeliveryApi } from "@/lib/ozon-delivery";

export type OzonPoint = { id: string; title: string; address: string; raw: Record<string, unknown> };
export type OzonShipmentMethod = {
  id: string;
  name: string;
  phoneNumber: string;
  dropoffPoint: OzonPoint;
  returnPoint: OzonPoint;
  status: string;
  createdAt: string;
  updatedAt: string;
};

let schemaReady: Promise<void> | null = null;

export async function ensureOzonShipmentMethodSchema() {
  if (!schemaReady) {
    schemaReady = getDb().query(`
      CREATE TABLE IF NOT EXISTS ozon_delivery_shipment_method (
        singleton BOOLEAN PRIMARY KEY DEFAULT TRUE CHECK (singleton),
        shipment_method_id TEXT NOT NULL,
        name TEXT NOT NULL,
        phone_number TEXT NOT NULL,
        dropoff_point_id TEXT NOT NULL,
        dropoff_point_title TEXT NOT NULL DEFAULT '',
        dropoff_point_address TEXT NOT NULL DEFAULT '',
        return_point_id TEXT NOT NULL,
        return_point_title TEXT NOT NULL DEFAULT '',
        return_point_address TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'forming',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).then(() => undefined);
  }
  return schemaReady;
}

function value(object: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const candidate = object[key];
    if (typeof candidate === "string" && candidate.trim()) return candidate.trim();
    if (typeof candidate === "number" && Number.isFinite(candidate)) return String(candidate);
  }
  return "";
}

function records(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(records);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  return [record, ...Object.values(record).flatMap(records)];
}

function toPoint(point: Record<string, unknown>): OzonPoint | null {
  const id = value(point, ["id", "point_id", "dropoff_point_id", "return_point_id"]);
  if (!id) return null;
  const address = value(point, ["address", "full_address"]);
  const title = value(point, ["name", "title", "display_name"]) || address || `Точка ${id}`;
  return { id, title, address, raw: point };
}

function pointsFromResponse(response: Record<string, unknown>) {
  const unique = new Map<string, OzonPoint>();
  for (const candidate of records(response)) {
    const point = toPoint(candidate);
    if (point) unique.set(point.id, point);
  }
  return [...unique.values()];
}

function shipmentMethodId(response: Record<string, unknown>) {
  const fields = ["shipment_method_id", "id"];
  for (const record of records(response)) {
    const id = value(record, fields);
    if (id) return id;
  }
  throw new Error("Ozon не вернул shipment_method_id созданного метода доставки.");
}

function shipmentMethodStatus(response: Record<string, unknown>) {
  for (const record of records(response)) {
    const status = value(record, ["status", "state"]);
    if (status) return status;
  }
  return "forming";
}

function mapStoredPoint(id: string, title: string, address: string): OzonPoint {
  return { id, title, address, raw: {} };
}

export async function searchOzonPoints(kind: "dropoff" | "return") {
  const path = kind === "dropoff" ? "/v1/dropoff-point/search" : "/v1/return-point/search";
  // pagination is mandatory for both endpoints. shipment_method_id is optional
  // for return-point search, so it must not be sent before a method exists.
  const filters = kind === "dropoff"
    ? { is_bulky: false, types: ["pvz"], address_search: "Воронеж" }
    : { types: ["pvz"] };
  const response = await postOzonDeliveryApi(path, {
    filters,
    pagination: { cursor: "", limit: 100 },
  });
  return pointsFromResponse(response);
}

export async function getOzonShipmentMethod() {
  await ensureOzonShipmentMethodSchema();
  const result = await getDb().query<{
    shipment_method_id: string; name: string; phone_number: string;
    dropoff_point_id: string; dropoff_point_title: string; dropoff_point_address: string;
    return_point_id: string; return_point_title: string; return_point_address: string;
    status: string; created_at: Date; updated_at: Date;
  }>(`SELECT * FROM ozon_delivery_shipment_method WHERE singleton = TRUE`);
  const row = result.rows[0];
  if (!row) return null;
  return {
    id: row.shipment_method_id, name: row.name, phoneNumber: row.phone_number,
    dropoffPoint: mapStoredPoint(row.dropoff_point_id, row.dropoff_point_title, row.dropoff_point_address),
    returnPoint: mapStoredPoint(row.return_point_id, row.return_point_title, row.return_point_address),
    status: row.status, createdAt: row.created_at.toISOString(), updatedAt: row.updated_at.toISOString(),
  } satisfies OzonShipmentMethod;
}

function validatePhoneNumber(phoneNumber: string) {
  if (!/^\+[1-9]\d{9,14}$/.test(phoneNumber)) {
    throw new Error("Укажите номер в международном формате, например +79611909993.");
  }
}

function validatePoint(point: OzonPoint, label: string) {
  if (!/^\d+$/.test(point.id)) throw new Error(`${label}: Ozon вернул некорректный идентификатор точки.`);
}

export async function createOzonShipmentMethod(input: {
  name: string; phoneNumber: string; dropoffPoint: OzonPoint; returnPoint: OzonPoint;
}) {
  const name = input.name.trim();
  const phoneNumber = input.phoneNumber.trim();
  if (!name) throw new Error("Укажите название метода доставки.");
  if (name.length > 100) throw new Error("Название метода доставки не должно превышать 100 символов.");
  validatePhoneNumber(phoneNumber);
  validatePoint(input.dropoffPoint, "Точка отгрузки");
  validatePoint(input.returnPoint, "Пункт возврата");

  const existing = await getOzonShipmentMethod();
  if (existing) throw new Error("Метод Ozon Delivery уже создан. Обновите его статус вместо повторного создания.");

  const response = await postOzonDeliveryApi("/v1/shipment-method/create", {
    name,
    phone_number: phoneNumber,
    is_bulky: false,
    type: {
      dropoff: {
        dropoff_point_id: Number(input.dropoffPoint.id),
        return_point_id: Number(input.returnPoint.id),
      },
    },
  });
  const id = shipmentMethodId(response);
  const status = shipmentMethodStatus(response);

  await ensureOzonShipmentMethodSchema();
  await getDb().query(`
    INSERT INTO ozon_delivery_shipment_method (
      singleton, shipment_method_id, name, phone_number,
      dropoff_point_id, dropoff_point_title, dropoff_point_address,
      return_point_id, return_point_title, return_point_address, status
    ) VALUES (TRUE, $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
  `, [id, name, phoneNumber, input.dropoffPoint.id, input.dropoffPoint.title, input.dropoffPoint.address,
    input.returnPoint.id, input.returnPoint.title, input.returnPoint.address, status]);
  return getOzonShipmentMethod();
}

export async function refreshOzonShipmentMethod() {
  const method = await getOzonShipmentMethod();
  if (!method) throw new Error("Метод Ozon Delivery ещё не создан.");
  const response = await postOzonDeliveryApi("/v1/shipment-method/info", {
    shipment_method_ids: [Number(method.id)],
  });
  const status = shipmentMethodStatus(response);
  await getDb().query(`UPDATE ozon_delivery_shipment_method SET status = $1, updated_at = NOW() WHERE singleton = TRUE`, [status]);
  return getOzonShipmentMethod();
}
