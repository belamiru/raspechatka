import { randomUUID } from "crypto";

const API_URL = "https://cloud-api.yandex.net/v1/disk";

type UploadedFile = {
  diskPath: string;
  originalName: string;
  fileSize: number;
  mimeType: string;
};

function getSettings() {
  const token = process.env.YANDEX_DISK_TOKEN;
  const basePath = process.env.YANDEX_DISK_BASE_PATH;

  if (!token) {
    throw new Error("YANDEX_DISK_TOKEN не задана в настройках проекта.");
  }

  if (!basePath) {
    throw new Error(
      "YANDEX_DISK_BASE_PATH не задана в настройках проекта."
    );
  }

  return {
    token,
    basePath: basePath.replace(/\/+$/, ""),
  };
}

function headers(token: string) {
  return {
    Authorization: `OAuth ${token}`,
  };
}

async function ensureFolder(path: string, token: string) {
  const response = await fetch(
    `${API_URL}/resources?${new URLSearchParams({ path })}`,
    {
      method: "PUT",
      headers: headers(token),
    }
  );

  // 201 — папка создана, 409 — уже существует.
  if (response.status !== 201 && response.status !== 409) {
    throw new Error("Не удалось подготовить папку на Яндекс Диске.");
  }
}

function safeFileName(fileName: string) {
  const cleaned = fileName
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, "_")
    .replace(/\s+/g, " ")
    .trim();

  return cleaned || "document";
}

function getMonthlyPaths(basePath: string) {
  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  return {
    yearPath: `${basePath}/${year}`,
    monthPath: `${basePath}/${year}/${month}`,
  };
}

async function uploadFile({
  bytes,
  fileName,
  mimeType,
  orderNumber,
  folder,
}: {
  bytes: Uint8Array;
  fileName: string;
  mimeType: string;
  orderNumber: string;
  folder: "originals" | "print-pdf";
}): Promise<UploadedFile> {
  const { token, basePath } = getSettings();
  const { yearPath, monthPath } = getMonthlyPaths(basePath);

  const folderPath = `${monthPath}/${folder}`;

  await ensureFolder(yearPath, token);
  await ensureFolder(monthPath, token);
  await ensureFolder(folderPath, token);

  const originalName = safeFileName(fileName);
  const uniqueName = `${orderNumber}_${randomUUID()}_${originalName}`;
  const diskPath = `${folderPath}/${uniqueName}`;

  const uploadLinkResponse = await fetch(
    `${API_URL}/resources/upload?${new URLSearchParams({
      path: diskPath,
      overwrite: "false",
    })}`,
    {
      headers: headers(token),
    }
  );

  if (!uploadLinkResponse.ok) {
    throw new Error(
      "Не удалось получить ссылку для загрузки файла на Яндекс Диск."
    );
  }

  const uploadLink = (await uploadLinkResponse.json()) as { href?: string };

  if (!uploadLink.href) {
    throw new Error(
      "Яндекс Диск не вернул ссылку для загрузки файла."
    );
  }

  const uploadResponse = await fetch(uploadLink.href, {
    method: "PUT",
    headers: {
      "Content-Type": mimeType,
    },
    body: Buffer.from(bytes),
  });

  if (!uploadResponse.ok) {
    throw new Error("Не удалось загрузить файл на Яндекс Диск.");
  }

  return {
    diskPath,
    originalName,
    fileSize: bytes.byteLength,
    mimeType,
  };
}

/**
 * Сохраняет оба файла заказа:
 * - исходный файл, предоставленный пользователем;
 * - PDF, подготовленный converter-service и предназначенный для печати.
 */
export async function uploadOrderFiles({
  originalFile,
  printPdf,
  printPdfName,
  orderNumber,
}: {
  originalFile: File;
  printPdf: Uint8Array;
  printPdfName: string;
  orderNumber: string;
}) {
  const original = await uploadFile({
    bytes: new Uint8Array(await originalFile.arrayBuffer()),
    fileName: originalFile.name,
    mimeType: originalFile.type || "application/octet-stream",
    orderNumber,
    folder: "originals",
  });

  const printPdfFile = await uploadFile({
    bytes: printPdf,
    fileName: printPdfName,
    mimeType: "application/pdf",
    orderNumber,
    folder: "print-pdf",
  });

  return {
    original,
    printPdf: printPdfFile,
  };
}

/**
 * Оставлено для совместимости с прежним кодом.
 * Новые заказы должны использовать uploadOrderFiles().
 */
export async function uploadOrderFile({
  file,
  orderNumber,
}: {
  file: File;
  orderNumber: string;
}) {
  return uploadFile({
    bytes: new Uint8Array(await file.arrayBuffer()),
    fileName: file.name,
    mimeType: file.type || "application/octet-stream",
    orderNumber,
    folder: "originals",
  });
}

export async function getOrderFileDownloadUrl(diskPath: string) {
  const { token } = getSettings();

  const response = await fetch(
    `${API_URL}/resources/download?${new URLSearchParams({ path: diskPath })}`,
    {
      headers: headers(token),
      cache: "no-store",
    }
  );

  if (!response.ok) {
    throw new Error(
      "Не удалось получить ссылку для скачивания файла с Яндекс Диска."
    );
  }

  const data = (await response.json()) as { href?: string };

  if (!data.href) {
    throw new Error(
      "Яндекс Диск не вернул ссылку на скачивание файла."
    );
  }

  return data.href;
}