import { NextResponse } from "next/server";
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
      return NextResponse.json(
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
      return NextResponse.json(
        {
          error: "Выберите файл для печати.",
          requestId,
        },
        { status: 400 }
      );
    }

    const validation = validateSupportedFile(file);

    if (!validation.valid) {
      return NextResponse.json(
        {
          error: validation.error,
          requestId,
        },
        { status: 400 }
      );
    }

    const analysis = await analyzePrintFile(file);

    return NextResponse.json({
      success: true,
      pageCount: analysis.pageCount,
      pdfSize: analysis.pdfSize,
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
        : "Не удалось проверить файл. Попробуйте ещё раз или отправьте его на ручную проверку.";

    return NextResponse.json(
      {
        error: message,
        requestId,
      },
      { status: 502 }
    );
  }
}