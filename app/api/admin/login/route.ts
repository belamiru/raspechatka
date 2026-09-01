import { NextResponse } from "next/server";
import {
  createAdminSession,
  getAdminCookieName,
} from "@/lib/auth";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const { password } = await request.json();

    const adminPassword = process.env.ADMIN_PASSWORD;

    if (!adminPassword) {
      return NextResponse.json(
        { error: "Пароль администратора не настроен." },
        { status: 500 }
      );
    }

    if (typeof password !== "string" || password !== adminPassword) {
      return NextResponse.json(
        { error: "Неверный пароль." },
        { status: 401 }
      );
    }

    const session = await createAdminSession();

    const response = NextResponse.json({ success: true });

    response.cookies.set({
      name: getAdminCookieName(),
      value: session,
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 7,
    });

    return response;
  } catch {
    return NextResponse.json(
      { error: "Не удалось выполнить вход." },
      { status: 500 }
    );
  }
}