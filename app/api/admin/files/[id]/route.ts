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
  const orderId = Number(id);

  if (!Number.isInteger(orderId) || orderId < 1) {
    return NextResponse.json(
      { error: "Некорректный идентификатор заказа." },
      { status: 400 }
    );
  }

  const result = await getDb().query<FileRow>(
    `
      SELECT disk_path, file_name, mime_type
      FROM order_items
      WHERE order_id = $1
      LIMIT 1;
    `,
    [orderId]
  );

  const file = result.rows[0];

  if (!file?.disk_path) {
    return NextResponse.json(
      { error: "Файл для этого заказа не найден." },
      { status: 404 }
    );
  }

  try {
    // Получаем временную закрытую ссылку у Яндекс Диска.
    const downloadUrl = await getOrderFileDownloadUrl(file.disk_path);

    // Скачиваем файл сервером и передаём его только авторизованному админу.
    const diskResponse = await fetch(downloadUrl, {
      cache: "no-store",
    });

    if (!diskResponse.ok || !diskResponse.body) {
      throw new Error("Не удалось скачать файл с Яндекс Диска.");
    }

    const fileName = makeDownloadFileName(file.file_name ?? "document");
    const encodedFileName = encodeURIComponent(fileName);

    // Обычный filename должен содержать только ASCII.
    // Реальное имя, включая кириллицу, браузеры получают из filename*.
    const fallbackFileName = "print-file.pdf";

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