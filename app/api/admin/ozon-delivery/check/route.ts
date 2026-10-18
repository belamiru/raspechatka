import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getOzonDeliveryAccessToken } from "@/lib/ozon-delivery";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  if (request.headers.get("sec-fetch-site") === "cross-site") {
    return NextResponse.json({ error: "Нет доступа." }, { status: 403 });
  }
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }

  try {
    await getOzonDeliveryAccessToken();
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (cause) {
    // API error messages are useful to an administrator, but never include the
    // request body, client secret, or access token in a response or a log here.
    const message = cause instanceof Error ? cause.message : "Не удалось получить токен Ozon Delivery API.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
