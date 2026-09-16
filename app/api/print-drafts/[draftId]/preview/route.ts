import { getOwnedPrintDraft, getPrintDraftOwnerToken } from "@/lib/print-drafts";
import { getOrderFileDownloadUrl } from "@/lib/yandex-disk";
import { getRequestId, logAppError } from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DRAFT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function makeInlineFileName(fileName: string) {
  return fileName.replace(/["\\\r\n]/g, "_") || "prepared.pdf";
}

export async function GET(
  request: Request,
  context: { params: Promise<{ draftId: string }> }
) {
  const requestId = getRequestId();
  const { draftId } = await context.params;

  if (!DRAFT_ID_PATTERN.test(draftId)) {
    return Response.json(
      { error: "Некорректный идентификатор черновика.", requestId },
      { status: 400 }
    );
  }

  const ownerToken = getPrintDraftOwnerToken(request);

  if (!ownerToken) {
    return Response.json(
      { error: "Нет доступа к черновику.", requestId },
      { status: 401 }
    );
  }

  try {
    /*
     * Поиск одновременно проверяет владельца cookie, статус и срок жизни.
     * Наружу намеренно возвращаем одинаковый 404: нельзя узнать, существует
     * ли чужой черновик по его UUID.
     */
    const draft = await getOwnedPrintDraft(draftId, ownerToken);

    if (!draft) {
      return Response.json(
        { error: "Черновик не найден или срок его действия истёк.", requestId },
        { status: 404 }
      );
    }

    /*
     * Временная ссылка Яндекс.Диска используется только между сервером сайта
     * и хранилищем. Браузеру отдаётся поток PDF через этот защищённый маршрут.
     */
    const diskResponse = await fetch(
      await getOrderFileDownloadUrl(draft.pdfDiskPath),
      { cache: "no-store" }
    );

    if (!diskResponse.ok || !diskResponse.body) {
      throw new Error("Не удалось загрузить подготовленный PDF из хранилища.");
    }

    const fileName = makeInlineFileName(draft.pdfFileName);

    return new Response(diskResponse.body, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="prepared.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
        "Cache-Control": "private, no-store, max-age=0",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    await logAppError({
      request,
      requestId,
      scope: "print_draft_preview",
      error,
      details: { draftId },
    });

    return Response.json(
      {
        error: "Не удалось открыть предпросмотр документа. Попробуйте ещё раз.",
        requestId,
      },
      { status: 502 }
    );
  }
}
