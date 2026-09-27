import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const YANDEX_REGISTRATION_STATUS_API = "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/merchant/registration/status";

type YandexError = { code?: unknown; message?: unknown };
type RegistrationStatus = { status?: unknown; merchant_id?: unknown; error?: unknown };

// Read-only diagnostic endpoint. The API token never leaves the server.
export async function GET(request: Request) {
  const requestId = getRequestId();
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }

  try {
    const token = process.env.YANDEX_DELIVERY_API_TOKEN?.trim();
    if (!token) {
      return NextResponse.json({ error: "Не настроен API Яндекс Доставки." }, { status: 503 });
    }

    const response = await fetch(YANDEX_REGISTRATION_STATUS_API, {
      headers: { Authorization: `Bearer ${token}`, "Accept-Language": "ru" },
      cache: "no-store",
    });
    const data: unknown = await response.json().catch(() => null);
    const result = data && typeof data === "object" ? data as RegistrationStatus : null;
    const yandexError = result?.error && typeof result.error === "object" ? result.error as YandexError : null;
    const payload = {
      status: typeof result?.status === "string" ? result.status : null,
      merchantId: typeof result?.merchant_id === "string" ? result.merchant_id : null,
      error: typeof yandexError?.message === "string" ? yandexError.message : null,
      errorCode: typeof yandexError?.code === "string" ? yandexError.code : null,
      yandexHttpStatus: response.status,
    };

    if (!response.ok) {
      return NextResponse.json({
        ...payload,
        error: payload.error ?? "Яндекс Доставка не вернула статус регистрации мерчанта.",
        requestId,
      }, { status: 502, headers: { "Cache-Control": "no-store" } });
    }

    return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await logAppError({ request, requestId, scope: "yandex-delivery-registration-status", error });
    return NextResponse.json({
      error: "Не удалось получить статус регистрации мерчанта в Яндекс Доставке.",
      requestId,
    }, { status: 502 });
  }
}
