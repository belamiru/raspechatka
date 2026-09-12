import {
  analyzePrintFile,
  validateSupportedFile,
} from "@/lib/converter";
import {
  checkRateLimit,
  getRequestId,
  logAppError,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const requestId = getRequestId();

  try {
    const rateLimit = await checkRateLimit(request, "analyze_file", {
      shortWindowMinutes: 15,
      shortWindowLimit: 8,
      dailyLimit: 30,
    });

    if (!rateLimit.allowed) {
      return Response.json(
        {
          error:
            "Слишком много попыток проверки файлов. Попробуйте немного позже.",
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

    const analysis = await analyzePrintFile(file);

    const pdfBody = new Uint8Array(analysis.pdfBytes).buffer;

    return new Response(pdfBody, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Length": String(analysis.pdfSize),
        "Content-Disposition": 'inline; filename="prepared.pdf"',
        "Cache-Control": "no-store",
        "X-Page-Count": String(analysis.pageCount),
        "X-Prepared-PDF-Size": String(analysis.pdfSize),
      },
    });
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
        : "Не удалось подготовить файл. Попробуйте ещё раз или отправьте его на ручную проверку.";

    return Response.json(
      {
        error: message,
        requestId,
      },
      { status: 502 }
    );
  }
}