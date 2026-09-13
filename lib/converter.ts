const DOCUMENT_EXTENSIONS = new Set([
  "pdf",
  "doc",
  "docx",
  "xls",
  "xlsx",
  "ppt",
  "pptx",
  "odt",
  "ods",
  "rtf",
]);

const IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png"]);

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_CONVERTED_PDF_SIZE = 100 * 1024 * 1024;

export type FileKind = "document" | "image";

export type FileAnalysis = {
  pageCount: number;
  pdfSize: number;
  pdfBytes: Uint8Array;
};

export function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function getFileKind(fileName: string): FileKind | null {
  const extension = getFileExtension(fileName);

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return "document";
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  return null;
}

export function isDocumentFile(fileName: string) {
  return getFileKind(fileName) === "document";
}

export function isImageFile(fileName: string) {
  return getFileKind(fileName) === "image";
}

export function validateSupportedFile(file: File) {
  const fileKind = getFileKind(file.name);

  if (!fileKind) {
    return {
      valid: false as const,
      error:
        "Поддерживаются PDF, DOC, DOCX, XLS, XLSX, PPT, PPTX, ODT, ODS, RTF, JPG и PNG.",
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

  return {
    valid: true as const,
    kind: fileKind,
  };
}

/**
 * Выполняется только на сервере ONREZA.
 * CONVERTER_API_KEY никогда не передаётся в браузер.
 *
 * Возвращает PDF, подготовленный из документа.
 * JPG/JPEG/PNG через этот сервис не проходят.
 */
export async function analyzeDocumentFile(file: File): Promise<FileAnalysis> {
  if (!isDocumentFile(file.name)) {
    throw new Error(
      "В сервис подготовки PDF можно отправлять только документы."
    );
  }

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

    const contentType = response.headers.get("content-type") ?? "";

    if (!contentType.toLowerCase().startsWith("application/pdf")) {
      throw new Error(
        "Сервис подготовки файлов вернул результат в некорректном формате."
      );
    }

    const pdfBytes = new Uint8Array(await response.arrayBuffer());

    if (pdfBytes.byteLength < 5) {
      throw new Error("Подготовленный PDF-файл пустой.");
    }

    if (pdfBytes.byteLength > MAX_CONVERTED_PDF_SIZE) {
      throw new Error(
        "Подготовленный PDF больше 100 МБ. Для него нужна ручная проверка."
      );
    }

    if (
      pdfBytes[0] !== 0x25 ||
      pdfBytes[1] !== 0x50 ||
      pdfBytes[2] !== 0x44 ||
      pdfBytes[3] !== 0x46 ||
      pdfBytes[4] !== 0x2d
    ) {
      throw new Error(
        "Сервис подготовки файлов вернул некорректный PDF-файл."
      );
    }

    return {
      pageCount,
      pdfSize: pdfBytes.byteLength,
      pdfBytes,
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw new Error(
        "Подготовка файла заняла слишком много времени. Попробуйте файл меньшего размера."
      );
    }

    throw error;
  } finally {
    clearTimeout(timeout);
  }
}