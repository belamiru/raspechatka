export type ClientFileKind = "document" | "image";

export type ClientFileAnalysis =
  | {
      kind: "image";
      pageCount: 1;
      draftId: null;
      previewUrl: null;
    }
  | {
      kind: "document";
      pageCount: number;
      draftId: string;
      previewUrl: string;
    };

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

export const MAX_FILE_SIZE = 50 * 1024 * 1024;
export const MAX_TOTAL_FILE_SIZE = 200 * 1024 * 1024;
export const MAX_FILES_PER_ORDER = 8;

export function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

export function getClientFileKind(fileName: string): ClientFileKind | null {
  const extension = getFileExtension(fileName);

  if (DOCUMENT_EXTENSIONS.has(extension)) {
    return "document";
  }

  if (IMAGE_EXTENSIONS.has(extension)) {
    return "image";
  }

  return null;
}

export function validateClientFile(file: File) {
  const kind = getClientFileKind(file.name);

  if (!kind) {
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
      error: "Размер одного файла не должен превышать 50 МБ.",
    };
  }

  return {
    valid: true as const,
    kind,
  };
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} Б`;
  }

  const kilobytes = bytes / 1024;

  if (kilobytes < 1024) {
    return `${kilobytes.toFixed(kilobytes < 10 ? 1 : 0)} КБ`;
  }

  const megabytes = kilobytes / 1024;

  return `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} МБ`;
}

export async function analyzeClientFile(
  file: File
): Promise<ClientFileAnalysis> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch("/api/files/analyze", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const result = (await response.json().catch(() => null)) as {
      error?: string;
    } | null;

    throw new Error(
      result?.error ?? "Не удалось проверить файл перед оформлением заказа."
    );
  }

  /*
   * Для JPG/JPEG/PNG API возвращает JSON:
   * { success: true, kind: "image", pageCount: 1 }.
   */
  const contentType = response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    const result = (await response.json()) as {
      kind?: unknown;
      pageCount?: unknown;
      draftId?: unknown;
      previewUrl?: unknown;
    };

    if (
      result.kind === "image" &&
      Number.isInteger(result.pageCount) &&
      result.pageCount === 1
    ) {
      return {
        kind: "image",
        pageCount: 1,
        draftId: null,
        previewUrl: null,
      };
    }

        const documentPageCount =
      typeof result.pageCount === "number" ? result.pageCount : null;

    if (
      result.kind === "document" &&
      documentPageCount !== null &&
      Number.isInteger(documentPageCount) &&
      documentPageCount >= 1 &&
      documentPageCount <= 10_000 &&
      typeof result.draftId === "string" &&
      result.draftId.length > 0 &&
      typeof result.previewUrl === "string" &&
      result.previewUrl.startsWith("/api/print-drafts/")
    ) {
      return {
        kind: "document",
        pageCount: documentPageCount,
        draftId: result.draftId,
        previewUrl: result.previewUrl,
      };
    }

    throw new Error("Сервис проверки вернул некорректный результат.");
  }

  throw new Error("Сервис проверки вернул неожиданный формат ответа.");
}