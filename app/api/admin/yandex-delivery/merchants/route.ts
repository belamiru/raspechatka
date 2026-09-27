import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YANDEX_MERCHANTS_FIND_API = "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/merchants/find";

type Merchant = { id?: unknown; legal_name?: unknown; inn?: unknown; is_removed?: unknown };

export async function POST(request: Request) {
  const requestId = getRequestId();
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }
  try {
    const body: unknown = await request.json().catch(() => null);
    const inn = body && typeof body === "object" && !Array.isArray(body) ? (body as Record<string, unknown>).inn : null;
    if (typeof inn !== "string" || !/^\d{10}(\d{2})?$/.test(inn)) {
      return NextResponse.json({ error: "Укажите ИНН из 10 или 12 цифр." }, { status: 400 });
    }
    const token = process.env.YANDEX_DELIVERY_API_TOKEN?.trim();
    if (!token) return NextResponse.json({ error: "Не настроен API Яндекс Доставки." }, { status: 503 });
    const response = await fetch(YANDEX_MERCHANTS_FIND_API, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Accept-Language": "ru" },
      body: JSON.stringify({ inn, is_only_active: true }), cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => null);
    if (!response.ok || !data || typeof data !== "object") {
      const message = data && typeof data === "object" && typeof (data as Record<string, unknown>).message === "string"
        ? (data as Record<string, unknown>).message : "Яндекс Доставка не вернула список мерчантов.";
      return NextResponse.json({ error: message, requestId }, { status: 502 });
    }
    const merchants: unknown[] = Array.isArray((data as Record<string, unknown>).merchants)
      ? (data as Record<string, unknown>).merchants as unknown[] : [];
    const safeMerchants = merchants.flatMap((value) => {
      if (!value || typeof value !== "object") return [];
      const merchant = value as Merchant;
      return typeof merchant.id === "string" && typeof merchant.legal_name === "string" && typeof merchant.inn === "string"
        ? [{ id: merchant.id, legalName: merchant.legal_name, inn: merchant.inn, isRemoved: merchant.is_removed === true }] : [];
    });
    return NextResponse.json({ merchants: safeMerchants }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await logAppError({ request, requestId, scope: "yandex-delivery-find-merchants", error });
    return NextResponse.json({ error: "Не удалось получить список мерчантов Яндекс Доставки.", requestId }, { status: 502 });
  }
}
