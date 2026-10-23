import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getOzonLabelForOrder } from "@/lib/ozon-order";
import { getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/admin/ozon-delivery/label?orderId=123 — скачать этикетку Ozon.
 *
 * GET, потому что это обычная ссылка «Скачать». Чужой сайт может отправить
 * такой запрос, но прочитать ответ не сможет, а побочный эффект безвреден:
 * только отметка времени скачивания.
 */
export async function GET(request: Request) {
  const requestId = getRequestId();
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) {
    return NextResponse.json({ error: "Нет доступа." }, { status: 401 });
  }

  const orderId = new URL(request.url).searchParams.get("orderId")?.trim() ?? "";
  if (!/^\d+$/.test(orderId)) {
    return NextResponse.json({ error: "Некорректный заказ." }, { status: 400 });
  }

  try {
    const file = await getOzonLabelForOrder(orderId);
    return new Response(file.body, {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.fileName}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (cause) {
    await logAppError({ request, requestId, scope: "ozon-delivery-label", error: cause });
    // Ошибка показывается в новой вкладке обычным текстом: так её проще переслать.
    const message = cause instanceof Error ? cause.message : "Не удалось получить этикетку Ozon.";
    return new Response(`Этикетка не получена.\n\n${message}`, {
      status: 502,
      headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "no-store" },
    });
  }
}
