import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";

const TOKEN_ENDPOINT = "https://xapi.ozon.ru/oauth/token";
const OAUTH_STATE_MAX_AGE_SECONDS = 10 * 60;
let schemaReady: Promise<void> | null = null;

type TokenResponse = { access_token?: unknown; refresh_token?: unknown; expires_in?: unknown };

function getRequiredEnv(name: "OZON_DELIVERY_CLIENT_ID" | "OZON_DELIVERY_CLIENT_SECRET" | "APP_URL") {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} не задана в Environment Variables ONREZA.`);
  return value;
}

function getEncryptionKey() {
  const secret = process.env.OZON_DELIVERY_TOKEN_ENCRYPTION_KEY?.trim()
    ?? process.env.ADMIN_SESSION_SECRET?.trim();
  if (!secret) throw new Error("Добавьте OZON_DELIVERY_TOKEN_ENCRYPTION_KEY или ADMIN_SESSION_SECRET в Environment Variables ONREZA.");
  return createHash("sha256").update(secret).digest();
}

function encrypt(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getEncryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return `${iv.toString("base64url")}.${cipher.getAuthTag().toString("base64url")}.${encrypted.toString("base64url")}`;
}

function decrypt(value: string) {
  const [iv, tag, encrypted] = value.split(".");
  if (!iv || !tag || !encrypted) throw new Error("Сохранённый токен Ozon имеет неверный формат.");
  const decipher = createDecipheriv("aes-256-gcm", getEncryptionKey(), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(encrypted, "base64url")), decipher.final()]).toString("utf8");
}

export function getOzonRedirectUri() {
  return `${getRequiredEnv("APP_URL").replace(/\/$/, "")}/api/integrations/ozon/callback`;
}

export function newOauthState() {
  return randomBytes(32).toString("base64url");
}

export function getOauthStateMaxAge() { return OAUTH_STATE_MAX_AGE_SECONDS; }

export function getOzonAuthorizationUrl(state: string) {
  const params = new URLSearchParams({
    response_type: "code",
    client_id: getRequiredEnv("OZON_DELIVERY_CLIENT_ID"),
    redirect_uri: getOzonRedirectUri(),
    state,
    access_type: "offline",
    scope: "seller-api.ozon-logistics",
  });
  return `https://seller.ozon.ru/app/appstore/oauth/authorize?${params.toString()}`;
}

export async function ensureOzonOauthSchema() {
  if (!schemaReady) {
    schemaReady = getDb().query(`
      CREATE TABLE IF NOT EXISTS integration_credentials (
        provider VARCHAR(40) PRIMARY KEY,
        refresh_token_encrypted TEXT NOT NULL,
        access_token_encrypted TEXT NOT NULL,
        access_token_expires_at TIMESTAMPTZ,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
    `).then(() => undefined);
  }
  return schemaReady;
}

async function tokenRequest(fields: Record<string, string>) {
  const response = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
    body: new URLSearchParams(fields),
    cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object") {
    const errorBody = body && typeof body === "object" ? body as Record<string, unknown> : null;
    const detail = typeof errorBody?.message === "string"
      ? errorBody.message
      : `Ozon вернул HTTP ${response.status} при получении токена.`;
    throw new Error(detail);
  }
  return body as TokenResponse;
}

export async function saveAuthorizationCode(code: string) {
  const token = await tokenRequest({
    grant_type: "authorization_code",
    client_id: getRequiredEnv("OZON_DELIVERY_CLIENT_ID"),
    client_secret: getRequiredEnv("OZON_DELIVERY_CLIENT_SECRET"),
    redirect_uri: getOzonRedirectUri(),
    code,
  });
  if (typeof token.access_token !== "string" || typeof token.refresh_token !== "string") {
    throw new Error("Ozon не вернул access_token и refresh_token.");
  }
  const expiresIn = typeof token.expires_in === "number" && Number.isFinite(token.expires_in) ? token.expires_in : 0;
  await ensureOzonOauthSchema();
  await getDb().query(`
    INSERT INTO integration_credentials (provider, refresh_token_encrypted, access_token_encrypted, access_token_expires_at, updated_at)
    VALUES ('ozon_delivery', $1, $2, CASE WHEN $3 > 0 THEN NOW() + ($3 * INTERVAL '1 second') ELSE NULL END, NOW())
    ON CONFLICT (provider) DO UPDATE SET refresh_token_encrypted = EXCLUDED.refresh_token_encrypted,
      access_token_encrypted = EXCLUDED.access_token_encrypted,
      access_token_expires_at = EXCLUDED.access_token_expires_at, updated_at = NOW();
  `, [encrypt(token.refresh_token), encrypt(token.access_token), expiresIn]);
}

export async function getOzonConnectionStatus() {
  await ensureOzonOauthSchema();
  const result = await getDb().query<{ updated_at: Date }>("SELECT updated_at FROM integration_credentials WHERE provider = 'ozon_delivery'");
  return result.rows[0] ? { connected: true, updatedAt: result.rows[0].updated_at.toISOString() } : { connected: false, updatedAt: null };
}

// Kept here for the delivery API layer. Tokens are never returned to a browser or API response.
export async function getOzonAccessToken() {
  await ensureOzonOauthSchema();
  const result = await getDb().query<{ refresh_token_encrypted: string; access_token_encrypted: string; access_token_expires_at: Date | null }>(
    "SELECT refresh_token_encrypted, access_token_encrypted, access_token_expires_at FROM integration_credentials WHERE provider = 'ozon_delivery'"
  );
  const stored = result.rows[0];
  if (!stored) throw new Error("Ozon Доставка ещё не подключена.");
  if (stored.access_token_expires_at && stored.access_token_expires_at.getTime() > Date.now() + 60_000) return decrypt(stored.access_token_encrypted);

  const token = await tokenRequest({
    grant_type: "refresh_token", client_id: getRequiredEnv("OZON_DELIVERY_CLIENT_ID"),
    client_secret: getRequiredEnv("OZON_DELIVERY_CLIENT_SECRET"), refresh_token: decrypt(stored.refresh_token_encrypted),
  });
  if (typeof token.access_token !== "string") throw new Error("Ozon не вернул обновлённый access_token.");
  const refreshToken = typeof token.refresh_token === "string" ? token.refresh_token : decrypt(stored.refresh_token_encrypted);
  const expiresIn = typeof token.expires_in === "number" && Number.isFinite(token.expires_in) ? token.expires_in : 0;
  await getDb().query(`UPDATE integration_credentials SET refresh_token_encrypted = $1, access_token_encrypted = $2,
    access_token_expires_at = CASE WHEN $3 > 0 THEN NOW() + ($3 * INTERVAL '1 second') ELSE NULL END, updated_at = NOW() WHERE provider = 'ozon_delivery'`,
    [encrypt(refreshToken), encrypt(token.access_token), expiresIn]);
  return token.access_token;
}
