import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getOzonPointsCatalogStatus, refreshOzonDeliveryPoints } from "@/lib/ozon-order";
import { getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
// Полная выгрузка каталога идёт дольше обычного запроса.
export const maxDuration = 300;

/** GET — сколько пунктов в базе и когда обновлялись. */
export async function GET() {
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }
  try {
    return NextResponse.json(
      await getOzonPointsCatalogStatus(),
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (cause) {
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Не удалось прочитать каталог." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}

/** POST — перечитать каталог пунктов выдачи из Ozon. */
export async function POST(request: Request) {
  const requestId = getRequestId();
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }
  try {
    const count = await refreshOzonDeliveryPoints();
    return NextResponse.json({ count }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    await logAppError({ request, requestId, scope: "ozon-delivery-points-sync", error: cause });
    return NextResponse.json(
      { error: cause instanceof Error ? cause.message : "Не удалось обновить каталог пунктов." },
      { status: 502, headers: { "Cache-Control": "no-store" } },
    );
  }
}
