import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { saveAuthorizationCode } from "@/lib/ozon-oauth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const STATE_COOKIE = "raspechatka_ozon_oauth_state";

function redirectToAdmin(requestUrl: string, params: Record<string, string>) {
  const url = new URL("/admin/ozon-delivery", requestUrl);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  return url;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const cookieStore = await cookies();
  const expectedState = cookieStore.get(STATE_COOKIE)?.value;
  // OAuth returns to the same browser session; keep the admin gate in addition to state validation.
  const admin = await isAdminSession(cookieStore.get(getAdminCookieName())?.value);
  if (!admin) return NextResponse.redirect(redirectToAdmin(request.url, { error: "Сессия администратора завершилась. Начните подключение Ozon ещё раз." }));
  if (!state || !expectedState || state !== expectedState) return NextResponse.redirect(redirectToAdmin(request.url, { error: "Не удалось проверить OAuth state. Начните подключение Ozon ещё раз." }));
  if (error) return NextResponse.redirect(redirectToAdmin(request.url, { error: `Ozon отклонил подключение: ${error}` }));
  if (!code) return NextResponse.redirect(redirectToAdmin(request.url, { error: "Ozon не передал код авторизации." }));
  try {
    await saveAuthorizationCode(code);
    const success = NextResponse.redirect(redirectToAdmin(request.url, { connected: "1" }));
    success.cookies.set({ name: STATE_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/ozon/callback", maxAge: 0 });
    return success;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Не удалось завершить подключение Ozon Доставки.";
    const failure = NextResponse.redirect(redirectToAdmin(request.url, { error: message }));
    failure.cookies.set({ name: STATE_COOKIE, value: "", httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/api/integrations/ozon/callback", maxAge: 0 });
    return failure;
  }
}
