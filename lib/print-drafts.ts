import { createHmac, randomBytes, randomUUID } from "crypto";
import { getDb } from "@/lib/db";

const OWNER_COOKIE_NAME = "print_draft_owner";
const DRAFT_LIFETIME_HOURS = 24;

export type PrintDraftStatus = "ready" | "used" | "expired";

export type PrintDraft = {
  id: string;
  ownerTokenHash: string;
  originalFileName: string;
  originalDiskPath: string;
  originalFileSize: number;
  originalMimeType: string;
  pdfFileName: string;
  pdfDiskPath: string;
  pdfFileSize: number;
  pageCount: number;
  status: PrintDraftStatus;
  createdAt: Date;
  expiresAt: Date;
  usedAt: Date | null;
};

export type CreatePrintDraftInput = Omit<
  PrintDraft,
  "id" | "ownerTokenHash" | "status" | "createdAt" | "expiresAt" | "usedAt"
> & {
  ownerToken: string;
};

let schemaReady: Promise<void> | null = null;

function getOwnerSecret() {
  const secret =
    process.env.PRINT_DRAFT_SECRET ??
    process.env.RATE_LIMIT_SECRET ??
    process.env.ADMIN_SESSION_SECRET;

  if (!secret) {
    throw new Error(
      "PRINT_DRAFT_SECRET, RATE_LIMIT_SECRET или ADMIN_SESSION_SECRET должны быть заданы для черновиков печати."
    );
  }

  return secret;
}

function mapPrintDraft(row: Record<string, unknown>): PrintDraft {
  return {
    id: String(row.id),
    ownerTokenHash: String(row.owner_token_hash),
    originalFileName: String(row.original_file_name),
    originalDiskPath: String(row.original_disk_path),
    originalFileSize: Number(row.original_file_size),
    originalMimeType: String(row.original_mime_type),
    pdfFileName: String(row.pdf_file_name),
    pdfDiskPath: String(row.pdf_disk_path),
    pdfFileSize: Number(row.pdf_file_size),
    pageCount: Number(row.page_count),
    status: row.status as PrintDraftStatus,
    createdAt: new Date(String(row.created_at)),
    expiresAt: new Date(String(row.expires_at)),
    usedAt: row.used_at ? new Date(String(row.used_at)) : null,
  };
}

export function hashPrintDraftOwnerToken(token: string) {
  return createHmac("sha256", getOwnerSecret()).update(token).digest("hex");
}

export function getPrintDraftOwnerToken(request: Request) {
  const cookieHeader = request.headers.get("cookie") ?? "";
  const token = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${OWNER_COOKIE_NAME}=`))
    ?.slice(OWNER_COOKIE_NAME.length + 1);

  return token ? decodeURIComponent(token) : null;
}

export function createPrintDraftOwnerToken() {
  return randomBytes(32).toString("base64url");
}

export function getPrintDraftOwnerCookieName() {
  return OWNER_COOKIE_NAME;
}

export function getPrintDraftLifetimeSeconds() {
  return DRAFT_LIFETIME_HOURS * 60 * 60;
}

async function ensurePrintDraftSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();

      await db.query(`
        CREATE TABLE IF NOT EXISTS print_drafts (
          id UUID PRIMARY KEY,
          owner_token_hash VARCHAR(64) NOT NULL,
          original_file_name VARCHAR(255) NOT NULL,
          original_disk_path TEXT NOT NULL,
          original_file_size BIGINT NOT NULL,
          original_mime_type VARCHAR(120) NOT NULL,
          pdf_file_name VARCHAR(255) NOT NULL,
          pdf_disk_path TEXT NOT NULL,
          pdf_file_size BIGINT NOT NULL,
          page_count INTEGER NOT NULL CHECK (page_count > 0),
          status VARCHAR(20) NOT NULL DEFAULT 'ready',
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          expires_at TIMESTAMPTZ NOT NULL,
          used_at TIMESTAMPTZ
        );
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS print_drafts_owner_lookup_idx
        ON print_drafts (owner_token_hash, id);
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS print_drafts_expiry_lookup_idx
        ON print_drafts (status, expires_at);
      `);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  return schemaReady;
}

export async function createPrintDraft(input: CreatePrintDraftInput) {
  await ensurePrintDraftSchema();

  const id = randomUUID();
  const expiresAt = new Date(Date.now() + DRAFT_LIFETIME_HOURS * 60 * 60 * 1000);
  const ownerTokenHash = hashPrintDraftOwnerToken(input.ownerToken);

  const result = await getDb().query(
    `
      INSERT INTO print_drafts (
        id, owner_token_hash,
        original_file_name, original_disk_path, original_file_size, original_mime_type,
        pdf_file_name, pdf_disk_path, pdf_file_size,
        page_count, status, expires_at
      )
      VALUES (
        $1, $2,
        $3, $4, $5, $6,
        $7, $8, $9,
        $10, 'ready', $11
      )
      RETURNING *;
    `,
    [
      id,
      ownerTokenHash,
      input.originalFileName,
      input.originalDiskPath,
      input.originalFileSize,
      input.originalMimeType,
      input.pdfFileName,
      input.pdfDiskPath,
      input.pdfFileSize,
      input.pageCount,
      expiresAt,
    ]
  );

  return mapPrintDraft(result.rows[0]);
}

export async function getOwnedPrintDraft(draftId: string, ownerToken: string) {
  await ensurePrintDraftSchema();

  const result = await getDb().query(
    `
      SELECT *
      FROM print_drafts
      WHERE id = $1
        AND owner_token_hash = $2
        AND status = 'ready'
        AND expires_at > NOW()
      LIMIT 1;
    `,
    [draftId, hashPrintDraftOwnerToken(ownerToken)]
  );

  return result.rows[0] ? mapPrintDraft(result.rows[0]) : null;
}

export async function markPrintDraftUsedByOrder(draftId: string, ownerToken: string) {
  await ensurePrintDraftSchema();

  const result = await getDb().query(
    `
      UPDATE print_drafts
      SET status = 'used', used_at = NOW()
      WHERE id = $1
        AND owner_token_hash = $2
        AND status = 'ready'
        AND expires_at > NOW()
      RETURNING *;
    `,
    [draftId, hashPrintDraftOwnerToken(ownerToken)]
  );

  return result.rows[0] ? mapPrintDraft(result.rows[0]) : null;
}

export async function getExpiredPrintDrafts(limit = 100) {
  await ensurePrintDraftSchema();

  const result = await getDb().query(
    `
      SELECT *
      FROM print_drafts
      WHERE status = 'ready' AND expires_at <= NOW()
      ORDER BY expires_at ASC
      LIMIT $1;
    `,
    [limit]
  );

  return result.rows.map(mapPrintDraft);
}

export async function deleteExpiredPrintDraft(draftId: string) {
  await ensurePrintDraftSchema();

  await getDb().query(
    `
      DELETE FROM print_drafts
      WHERE id = $1 AND status = 'ready' AND expires_at <= NOW();
    `,
    [draftId]
  );
}
