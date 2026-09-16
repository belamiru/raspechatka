import {
  analyzeDocumentFile,
  validateSupportedFile,
} from "@/lib/converter";
import { randomUUID } from "crypto";
import {
  createPrintDraft,
  createPrintDraftOwnerToken,
  getPrintDraftLifetimeSeconds,
  getPrintDraftOwnerCookieName,
  getPrintDraftOwnerToken,
} from "@/lib/print-drafts";
import { uploadPrintDraftFiles } from "@/lib/yandex-disk";
import {
  checkRateLimit,
  getRequestId,
  logAppError,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_PAGE_COUNT = 10_000;

function makePrintPdfName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "document";

  return `${baseName}.pdf`;
}

function makeOwnerCookie(token: string) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";

  return `${getPrintDraftOwnerCookieName()}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${getPrintDraftLifetimeSeconds()}${secure}`;
}

export async function POST(request: Request) {
  const requestId = getRequestId();

  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!(file instanceof File)) {
      return Response.json(
        {
          error: "Выберите файл для печати.",
          requestId,
        },
        { status: 400 }
      );
    }

    const validation = validateSupportedFile(file);

    if (!validation.valid) {
      return Response.json(
        {
          error: validation.error,
          requestId,
        },
        { status: 400 }
      );
    }

    /*
     * JPG/JPEG/PNG не направляются в converter-service:
     * одно изображение считается одной печатной страницей и будет
     * сохранено как оригинал для печати.
     */
    if (validation.kind === "image") {
      return Response.json(
        {
          success: true,
          kind: "image",
          pageCount: 1,
        },
        {
          headers: {
            "Cache-Control": "no-store",
          },
        }
      );
    }
        /*
     * Лимитируем только документы: именно их проверка запускает конвертацию
     * на отдельном сервисе. JPG/JPEG/PNG обрабатываются мгновенно выше и не
     * должны расходовать лимит при пакетной загрузке.
     *
     * В заказ можно добавить до 8 файлов, поэтому прежний лимит в 8 проверок
     * за 15 минут блокировал пользователя уже после одного полного выбора.
     */
    const rateLimit = await checkRateLimit(request, "analyze_file", {
      shortWindowMinutes: 15,
      shortWindowLimit: 32,
      dailyLimit: 120,
    });

    if (!rateLimit.allowed) {
      return Response.json(
        {
          error:
            "Слишком много проверок документов. Попробуйте немного позже.",
          requestId,
        },
        {
          status: 429,
          headers: {
            "Retry-After": String(rateLimit.retryAfterSeconds),
          },
        }
      );
    }

    const analysis = await analyzeDocumentFile(file);

    if (
      !Number.isInteger(analysis.pageCount) ||
      analysis.pageCount < 1 ||
      analysis.pageCount > MAX_PAGE_COUNT
    ) {
      throw new Error(
        "Сервис подготовки файлов вернул некорректное количество страниц."
      );
    }

    /*
     * Документ конвертируется ровно один раз. Временный черновик содержит
     * оригинал и этот же канонический PDF: позднее он будет показан в
     * предпросмотре и использован при создании заказа без новой конвертации.
     */
    const existingOwnerToken = getPrintDraftOwnerToken(request);
    const ownerToken = existingOwnerToken ?? createPrintDraftOwnerToken();
    const uploadedFiles = await uploadPrintDraftFiles({
      originalFile: file,
      printPdf: new Uint8Array(analysis.pdfBytes),
      printPdfName: makePrintPdfName(file.name),
      draftKey: randomUUID(),
    });

    const draft = await createPrintDraft({
      ownerToken,
      originalFileName: uploadedFiles.original.originalName,
      originalDiskPath: uploadedFiles.original.diskPath,
      originalFileSize: uploadedFiles.original.fileSize,
      originalMimeType: uploadedFiles.original.mimeType,
      pdfFileName: uploadedFiles.printPdf.originalName,
      pdfDiskPath: uploadedFiles.printPdf.diskPath,
      pdfFileSize: uploadedFiles.printPdf.fileSize,
      pageCount: analysis.pageCount,
    });

    const headers = new Headers({ "Cache-Control": "no-store" });

    if (!existingOwnerToken) {
      headers.set("Set-Cookie", makeOwnerCookie(ownerToken));
    }

    return Response.json(
      {
        success: true,
        kind: "document",
        draftId: draft.id,
        pageCount: draft.pageCount,
        previewUrl: `/api/print-drafts/${draft.id}/preview`,
      },
      { headers }
    );
  } catch (error) {
    await logAppError({
      request,
      requestId,
      scope: "analyze_file",
      error,
    });

    const message =
      error instanceof Error && error.message
        ? error.message
        : "Не удалось проверить файл. Попробуйте ещё раз или отправьте его на ручную проверку.";

    return Response.json(
      {
        error: message,
        requestId,
      },
      { status: 502 }
    );
  }
}