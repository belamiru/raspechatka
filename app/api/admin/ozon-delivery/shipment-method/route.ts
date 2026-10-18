import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import {
  createOzonShipmentMethod,
  getOzonShipmentMethod,
  refreshOzonShipmentMethod,
  searchOzonPoints,
  type OzonPoint,
} from "@/lib/ozon-shipment-method";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function requireAdmin(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") return false;
  const cookieStore = await cookies();
  return isAdminSession(cookieStore.get(getAdminCookieName())?.value);
}

function failure(cause: unknown) {
  const error = cause instanceof Error ? cause.message : "Не удалось выполнить запрос к Ozon Delivery API.";
  return NextResponse.json({ error }, { status: 502, headers: { "Cache-Control": "no-store" } });
}

function readPoint(value: unknown): OzonPoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const point = value as Record<string, unknown>;
  if (typeof point.id !== "string" || !point.id.trim()) return null;
  return {
    id: point.id.trim(),
    title: typeof point.title === "string" ? point.title.trim() : "",
    address: typeof point.address === "string" ? point.address.trim() : "",
    raw: {},
  };
}

export async function GET(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  try {
    return NextResponse.json({ shipmentMethod: await getOzonShipmentMethod() }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    return failure(cause);
  }
}

export async function POST(request: Request) {
  if (!await requireAdmin(request)) return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  const body: unknown = await request.json().catch(() => null);
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return NextResponse.json({ error: "Некорректный запрос." }, { status: 400 });
  }
  const data = body as Record<string, unknown>;
  const action = data.action;
  try {
    if (action === "search-points") {
      const kind = data.kind;
      if (kind !== "dropoff" && kind !== "return") return NextResponse.json({ error: "Некорректный тип точки." }, { status: 400 });
      return NextResponse.json({ points: await searchOzonPoints(kind) }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "create") {
      const name = typeof data.name === "string" ? data.name : "";
      const phoneNumber = typeof data.phoneNumber === "string" ? data.phoneNumber : "";
      const dropoffPoint = readPoint(data.dropoffPoint);
      const returnPoint = readPoint(data.returnPoint);
      if (!dropoffPoint || !returnPoint) return NextResponse.json({ error: "Выберите точку отгрузки и пункт возврата." }, { status: 400 });
      const shipmentMethod = await createOzonShipmentMethod({ name, phoneNumber, dropoffPoint, returnPoint });
      return NextResponse.json({ shipmentMethod }, { headers: { "Cache-Control": "no-store" } });
    }
    if (action === "refresh") {
      const shipmentMethod = await refreshOzonShipmentMethod();
      return NextResponse.json({ shipmentMethod }, { headers: { "Cache-Control": "no-store" } });
    }
    return NextResponse.json({ error: "Неизвестное действие." }, { status: 400 });
  } catch (cause) {
    return failure(cause);
  }
}
