import { NextResponse } from "next/server";
import { searchOzonDeliveryPoints } from "@/lib/ozon-order";
import { checkRateLimit, getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const requestId = getRequestId();
  try {
    const limit = await checkRateLimit(request, "ozon-delivery-points", { shortWindowMinutes: 1, shortWindowLimit: 30, dailyLimit: 600 });
    if (!limit.allowed) return NextResponse.json({ error: "Попробуйте через минуту." }, { status: 429 });
    const query = new URL(request.url).searchParams.get("query")?.slice(0, 120) ?? "";
    const result = await searchOzonDeliveryPoints(query);
    // `total` lets the picker tell "Ozon returned no points at all" apart from
    // "your search matched nothing", which are very different problems.
    return NextResponse.json(result, { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    await logAppError({ request, requestId, scope: "ozon_delivery_points", error });
    return NextResponse.json({ error: error instanceof Error ? error.message : "Не удалось загрузить пункты выдачи Ozon." }, { status: 502 });
  }
}
