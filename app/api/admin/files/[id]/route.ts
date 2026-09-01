import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getOrderFileDownloadUrl } from "@/lib/yandex-disk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const cookieStore = await cookies();

  const isAdmin = await isAdminSession(
    cookieStore.get(getAdminCookieName())?.value
  );

  if (!isAdmin) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }

  const { id } = await context.params;
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId < 1) {
    return NextResponse.json(
      { error: "Некорректный идентификатор заказа." },
      { status: 400 }
    );
  }

  const result = await getDb().query<{ disk_path: string | null }>(
    `
      SELECT disk_path
      FROM order_items
      WHERE order_id = $1
      LIMIT 1;
    `,
    [orderId]
  );

  const diskPath = result.rows[0]?.disk_path;

  if (!diskPath) {
    return NextResponse.json(
      { error: "Файл для этого заказа не найден." },
      { status: 404 }
    );
  }

  try {
    const downloadUrl = await getOrderFileDownloadUrl(diskPath);

    return NextResponse.redirect(downloadUrl);
  } catch {
    return NextResponse.json(
      { error: "Не удалось подготовить файл к скачиванию." },
      { status: 500 }
    );
  }
}