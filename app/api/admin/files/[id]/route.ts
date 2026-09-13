import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { getOrderFileDownloadUrl } from "@/lib/yandex-disk";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type FileRow = {
  disk_path: string | null;
  file_name: string | null;
  mime_type: string | null;
};

function makeDownloadFileName(fileName: string) {
  return fileName.replace(/["\\\r\n]/g, "_") || "document";
}

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
  const orderItemId = Number(id);

  if (!Number.isInteger(orderItemId) || orderItemId < 1) {
    return NextResponse.json(
      { error: "Некорректный идентификатор файла." },
      { status: 400 }
    );
  }

  /*
   * В URL передаётся ID конкретной записи order_items.
   * Поэтому администратор получает именно выбранный файл,
   * а не первую позицию соответствующего заказа.
   */
  const result = await getDb().query<FileRow>(
    `
      SELECT disk_path, file_name, mime_type
      FROM order_items
      WHERE id = $1
      LIMIT 1;
    `,
    [orderItemId]
  );

  const file = result.rows[0];

  if (!file?.disk_path) {
    return NextResponse.json(
      { error: "Файл для скачивания не найден." },
      { status: 404 }
    );
  }

  try {
    /*
     * Получаем временную закрытую ссылку у Яндекс Диска,
     * скачиваем файл сервером и передаём его только авторизованному админу.
     */
    const downloadUrl = await getOrderFileDownloadUrl(file.disk_path);

    const diskResponse = await fetch(downloadUrl, {
      cache: "no-store",
    });

    if (!diskResponse.ok || !diskResponse.body) {
      throw new Error("Не удалось скачать файл с Яндекс Диска.");
    }

    const fileName = makeDownloadFileName(file.file_name ?? "document");
    const encodedFileName = encodeURIComponent(fileName);

    /*
     * Обычный filename содержит только ASCII для совместимости,
     * а filename* передаёт настоящее имя, включая кириллицу.
     */
    const fallbackFileName = "print-file";

    return new Response(diskResponse.body, {
      headers: {
        "Content-Type":
          file.mime_type ??
          diskResponse.headers.get("content-type") ??
          "application/octet-stream",
        "Content-Disposition": `attachment; filename="${fallbackFileName}"; filename*=UTF-8''${encodedFileName}`,
        "Cache-Control": "private, no-store, max-age=0",
      },
    });
  } catch (error) {
    console.error("Ошибка скачивания файла администратором:", error);

    return NextResponse.json(
      { error: "Не удалось подготовить файл к скачиванию." },
      { status: 500 }
    );
  }
}