import { NextResponse } from "next/server";
import { queryOzonDeliveryPoints, type OzonPointsBounds } from "@/lib/ozon-order";
import { checkRateLimit, getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function numberParam(value: string | null, min: number, max: number) {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : null;
}

/**
 * Пункты выдачи по области карты (bbox) или по тексту запроса.
 * Область приходит из браузера: покупатель двигает карту — грузим то,
 * что видно, а не «500 ближайших к одной точке».
 */
export async function GET(request: Request) {
  const requestId = getRequestId();
  try {
    const limit = await checkRateLimit(request, "ozon-delivery-points", { shortWindowMinutes: 1, shortWindowLimit: 30, dailyLimit: 600 });
    if (!limit.allowed) return NextResponse.json({ error: "Попробуйте через минуту." }, { status: 429 });

    const params = new URL(request.url).searchParams;
    const query = (params.get("query") ?? "").slice(0, 120);
    const minLatitude = numberParam(params.get("minLat"), -90, 90);
    const maxLatitude = numberParam(params.get("maxLat"), -90, 90);
    const minLongitude = numberParam(params.get("minLon"), -180, 180);
    const maxLongitude = numberParam(params.get("maxLon"), -180, 180);

    const bounds: OzonPointsBounds | undefined =
      minLatitude !== null && maxLatitude !== null && minLongitude !== null && maxLongitude !== null
        && minLatitude < maxLatitude && minLongitude < maxLongitude
        ? { minLatitude, maxLatitude, minLongitude, maxLongitude }
        : undefined;

    const result = await queryOzonDeliveryPoints({ query, bounds });
    // `total` отличает «в Ozon вообще нет пунктов» от «по фильтру ничего не нашлось».
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await logAppError({ request, requestId, scope: "ozon_delivery_points", error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить пункты выдачи Ozon." }, { status: 502 });
  }
}
