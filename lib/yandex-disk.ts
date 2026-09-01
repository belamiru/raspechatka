import { randomUUID } from "crypto";

const API_URL = "https://cloud-api.yandex.net/v1/disk";

function getSettings() {
  const token = process.env.YANDEX_DISK_TOKEN;
  const basePath = process.env.YANDEX_DISK_BASE_PATH;

  if (!token) {
    throw new Error("YANDEX_DISK_TOKEN не задана в настройках проекта.");
  }

  if (!basePath) {
    throw new Error("YANDEX_DISK_BASE_PATH не задана в настройках проекта.");
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

export async function uploadOrderFile({
  file,
  orderNumber,
}: {
  file: File;
  orderNumber: string;
}) {
  const { token, basePath } = getSettings();

  const now = new Date();
  const year = String(now.getUTCFullYear());
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");

  const yearPath = `${basePath}/${year}`;
  const monthPath = `${yearPath}/${month}`;

  await ensureFolder(yearPath, token);
  await ensureFolder(monthPath, token);

  const originalName = safeFileName(file.name);
  const uniqueName = `${orderNumber}_${randomUUID()}_${originalName}`;
  const diskPath = `${monthPath}/${uniqueName}`;

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
    throw new Error("Не удалось получить ссылку для загрузки файла.");
  }

  const uploadLink = (await uploadLinkResponse.json()) as { href?: string };

  if (!uploadLink.href) {
    throw new Error("Яндекс Диск не вернул ссылку для загрузки.");
  }

  const fileBuffer = Buffer.from(await file.arrayBuffer());

  const uploadResponse = await fetch(uploadLink.href, {
    method: "PUT",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
    },
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    throw new Error("Не удалось загрузить файл на Яндекс Диск.");
  }

  return {
    diskPath,
    originalName,
    fileSize: file.size,
    mimeType: file.type || "application/octet-stream",
  };
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
    throw new Error("Не удалось получить ссылку для скачивания файла.");
  }

  const data = (await response.json()) as { href?: string };

  if (!data.href) {
    throw new Error("Яндекс Диск не вернул ссылку на файл.");
  }

  return data.href;
}