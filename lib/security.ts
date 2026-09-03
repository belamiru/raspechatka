import { createHmac, randomUUID } from "crypto";
import { getDb } from "@/lib/db";

type RateLimitOptions = {
  shortWindowMinutes: number;
  shortWindowLimit: number;
  dailyLimit: number;
};

type LogErrorOptions = {
  request?: Request;
  requestId: string;
  scope: string;
  error: unknown;
  details?: Record<string, unknown>;
};

let securitySchemaReady: Promise<void> | null = null;

function ensureSecuritySchema() {
  if (!securitySchemaReady) {
    securitySchemaReady = (async () => {
      const db = getDb();

      await db.query(`
        CREATE TABLE IF NOT EXISTS request_attempts (
          id BIGSERIAL PRIMARY KEY,
          scope VARCHAR(80) NOT NULL,
          ip_hash VARCHAR(64) NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS request_attempts_lookup_idx
        ON request_attempts (scope, ip_hash, created_at DESC);
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS app_error_logs (
          id BIGSERIAL PRIMARY KEY,
          request_id UUID NOT NULL,
          scope VARCHAR(100) NOT NULL,
          error_message TEXT NOT NULL,
          details JSONB,
          ip_hash VARCHAR(64),
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS app_error_logs_created_at_idx
        ON app_error_logs (created_at DESC);
      `);
    })().catch((error) => {
      securitySchemaReady = null;
      throw error;
    });
  }

  return securitySchemaReady;
}

function getClientIp(request: Request) {
  const realIp = request.headers.get("x-real-ip");

  if (realIp) {
    return realIp.trim().slice(0, 100);
  }

  const forwardedFor = request.headers.get("x-forwarded-for");

  if (forwardedFor) {
    return forwardedFor.split(",")[0].trim().slice(0, 100);
  }

  const cloudflareIp = request.headers.get("cf-connecting-ip");

  if (cloudflareIp) {
    return cloudflareIp.trim().slice(0, 100);
  }

  // Если хостинг не передал IP, используем ограниченный отпечаток браузера.
  const userAgent = request.headers.get("user-agent") ?? "unknown";

  return `unknown:${userAgent.slice(0, 150)}`;
}

function getRateLimitSecret() {
  const secret =
    process.env.RATE_LIMIT_SECRET ??
    process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "RATE_LIMIT_SECRET не задана в переменных окружения."
    );
  }

  return secret;
}

export function getRequestId() {
  return randomUUID();
}

export function getRequestIpHash(request: Request) {
  return createHmac("sha256", getRateLimitSecret())
    .update(getClientIp(request))
    .digest("hex");
}

export async function checkRateLimit(
  request: Request,
  scope: string,
  options: RateLimitOptions
) {
  await ensureSecuritySchema();

  const ipHash = getRequestIpHash(request);
  const client = await getDb().connect();

  try {
    await client.query("BEGIN");

    // Не даёт нескольким одновременным запросам обойти ограничение.
    await client.query(
      `
        SELECT pg_advisory_xact_lock(
          hashtext($1),
          hashtext($2)
        );
      `,
      [scope, ipHash]
    );

    const result = await client.query<{
      short_count: string;
      daily_count: string;
    }>(
      `
        SELECT
          COUNT(*) FILTER (
            WHERE created_at >
              NOW() - ($3::integer * INTERVAL '1 minute')
          ) AS short_count,
          COUNT(*) FILTER (
            WHERE created_at > NOW() - INTERVAL '24 hours'
          ) AS daily_count
        FROM request_attempts
        WHERE scope = $1
          AND ip_hash = $2;
      `,
      [scope, ipHash, options.shortWindowMinutes]
    );

    const shortCount = Number(result.rows[0]?.short_count ?? 0);
    const dailyCount = Number(result.rows[0]?.daily_count ?? 0);

    if (
      shortCount >= options.shortWindowLimit ||
      dailyCount >= options.dailyLimit
    ) {
      await client.query("COMMIT");

      return {
        allowed: false,
        ipHash,
        retryAfterSeconds: options.shortWindowMinutes * 60,
      };
    }

    await client.query(
      `
        INSERT INTO request_attempts (scope, ip_hash)
        VALUES ($1, $2);
      `,
      [scope, ipHash]
    );

    await client.query("COMMIT");

    return {
      allowed: true,
      ipHash,
      retryAfterSeconds: 0,
    };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

function errorMessage(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 2000);
  }

  return String(error).slice(0, 2000);
}

export async function logAppError({
  request,
  requestId,
  scope,
  error,
  details,
}: LogErrorOptions) {
  console.error(`[${requestId}] ${scope}:`, error);

  try {
    await ensureSecuritySchema();

    const ipHash = request ? getRequestIpHash(request) : null;

    await getDb().query(
      `
        INSERT INTO app_error_logs (
          request_id,
          scope,
          error_message,
          details,
          ip_hash
        )
        VALUES ($1, $2, $3, $4::jsonb, $5);
      `,
      [
        requestId,
        scope,
        errorMessage(error),
        JSON.stringify(details ?? {}),
        ipHash,
      ]
    );
  } catch (loggingError) {
    console.error(
      `[${requestId}] Не удалось записать ошибку в журнал:`,
      loggingError
    );
  }
}

export async function validatePrintFile(file: File) {
  const extension = file.name
    .toLowerCase()
    .split(".")
    .pop();

  if (!extension || !["pdf", "jpg", "jpeg", "png"].includes(extension)) {
    return {
      valid: false,
      error: "Поддерживаются только PDF, JPG и PNG.",
    };
  }

  const firstBytes = new Uint8Array(
    await file.slice(0, 8).arrayBuffer()
  );

  const isPdf =
    firstBytes[0] === 0x25 &&
    firstBytes[1] === 0x50 &&
    firstBytes[2] === 0x44 &&
    firstBytes[3] === 0x46 &&
    firstBytes[4] === 0x2d;

  const isJpeg =
    firstBytes[0] === 0xff &&
    firstBytes[1] === 0xd8 &&
    firstBytes[2] === 0xff;

  const isPng =
    firstBytes[0] === 0x89 &&
    firstBytes[1] === 0x50 &&
    firstBytes[2] === 0x4e &&
    firstBytes[3] === 0x47 &&
    firstBytes[4] === 0x0d &&
    firstBytes[5] === 0x0a &&
    firstBytes[6] === 0x1a &&
    firstBytes[7] === 0x0a;

  const matchesExtension =
    (extension === "pdf" && isPdf) ||
    ((extension === "jpg" || extension === "jpeg") && isJpeg) ||
    (extension === "png" && isPng);

  if (!matchesExtension) {
    return {
      valid: false,
      error:
        "Содержимое файла не соответствует его расширению. Выберите другой файл.",
    };
  }

  return {
    valid: true,
    error: null,
  };
}