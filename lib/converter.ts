const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "xlsx",
  "pptx",
]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;

export type FileAnalysis = {
  pageCount: number;
  pdfSize: number | null;
};

export function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function validateSupportedFile(file: File) {
  const extension = getFileExtension(file.name);

  if (!SUPPORTED_EXTENSIONS.has(extension)) {
    return {
      valid: false as const,
      error: "Поддерживаются файлы PDF, DOCX, XLSX и PPTX.",
    };
  }

  if (file.size < 1) {
    return {
      valid: false as const,
      error: "Выбранный файл пустой.",
    };
  }

  if (file.size > MAX_FILE_SIZE) {
    return {
      valid: false as const,
      error:
        "Файл больше 50 МБ. Для него нужна ручная проверка перед печатью.",
    };
  }

  return { valid: true as const };
}

/**
 * Выполняется только на сервере ONREZA.
 * CONVERTER_API_KEY никогда не передаётся в браузер.
 */
export async function analyzePrintFile(file: File): Promise<FileAnalysis> {
  const converterUrl = process.env.CONVERTER_API_URL;
  const converterApiKey = process.env.CONVERTER_API_KEY;

  if (!converterUrl || !converterApiKey) {
    throw new Error(
      "Сервис проверки файлов пока не настроен. Попробуйте немного позже."
    );
  }

  const formData = new FormData();
  formData.append("file", file, file.name);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 120_000);

  try {
    const response = await fetch(converterUrl, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${converterApiKey}`,
      },
      body: formData,
      signal: controller.signal,
      cache: "no-store",
    });

   if (!response.ok) {
      throw new Error(
        `Сервис подготовки файлов временно вернул ошибку HTTP ${response.status}.`
      );
    }

    const pageCount = Number(response.headers.get("x-page-count"));

    if (!Number.isInteger(pageCount) || pageCount < 1) {
      throw new Error(
        "Не удалось определить количество страниц в документе."
      );
    }

    const contentLength = Number(response.headers.get("content-length"));

    // PDF не отправляется пользователю и не сохраняется на ONREZA.
    // На этом шаге нам нужны только число страниц и размер результата.
    await response.body?.cancel();

    return {
      pageCount,
      pdfSize:
        Number.isSafeInteger(contentLength) && contentLength > 0
          ? contentLength
          : null,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Проверка файла заняла слишком много времени. Попробуйте другой файл или отправьте его на ручную проверку."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}