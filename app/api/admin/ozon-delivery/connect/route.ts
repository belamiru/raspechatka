import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getOauthStateMaxAge, getOzonAuthorizationUrl, newOauthState } from "@/lib/ozon-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "raspechatka_ozon_oauth_state";

export async function GET(request: Request) {
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) {
    return NextResponse.redirect(new URL("/admin/login", request.url));
  }
  try {
    const state = newOauthState();
    const response = NextResponse.redirect(getOzonAuthorizationUrl(state));
    response.cookies.set({ name: STATE_COOKIE, value: state, httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/ozon/callback", maxAge: getOauthStateMaxAge() });
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Не удалось начать подключение Ozon Доставки.";
    return NextResponse.redirect(new URL(`/admin/ozon-delivery?error=${encodeURIComponent(message)}`, request.url));
  }
}
