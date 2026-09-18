import { NextResponse } from "next/server";
import { validateSupportedFile, type FileKind } from "@/lib/converter";
import { getDb } from "@/lib/db";
import { uploadOrderFile } from "@/lib/yandex-disk";
import { getPrintPrice } from "@/lib/pricing";
import { getPrintablePageCount, type PagePrintOverride } from "@/lib/print-settings";
import {
  checkRateLimit,
  getRequestId,
  logAppError,
} from "@/lib/security";
import {
  getOwnedPrintDraft,
  getPrintDraftOwnerToken,
  hashPrintDraftOwnerToken,
  type PrintDraft,
} from "@/lib/print-drafts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 200 * 1024 * 1024;
const MAX_FILES_PER_ORDER = 8;
const MAX_PAGE_COUNT = 10_000;

type PreparedOrderItem = {
  kind: FileKind;
  pageCount: number;
  file?: File;
  draft?: PrintDraft;
};

type SubmittedOrderItem = {
  fileId: string;
  kind: FileKind;
  draftId?: string;
};

type SubmittedFileSettings = {
  fileId: string;
  paperFormat: "A4" | "A3";
  copies: number;
  printSides: "one-sided" | "two-sided";
  pageOverrides: Record<number, PagePrintOverride>;
};

let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      const db = getDb();

      await db.query(`
        CREATE TABLE IF NOT EXISTS orders (
          id BIGSERIAL PRIMARY KEY,
          order_number VARCHAR(40) NOT NULL UNIQUE,
          customer_name VARCHAR(120) NOT NULL,
          customer_phone VARCHAR(40) NOT NULL,
          customer_email VARCHAR(160),
          customer_comment TEXT,
          fulfillment_method VARCHAR(30) NOT NULL DEFAULT 'pickup',
          status VARCHAR(30) NOT NULL DEFAULT 'new',
          total_price INTEGER NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS order_items (
          id BIGSERIAL PRIMARY KEY,
          order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          file_name VARCHAR(255),
          disk_path TEXT,
          file_size BIGINT,
          mime_type VARCHAR(120),
          original_file_name VARCHAR(255),
          original_disk_path TEXT,
          original_file_size BIGINT,
          original_mime_type VARCHAR(120),
          paper_format VARCHAR(10) NOT NULL,
          page_count INTEGER NOT NULL,
          copies INTEGER NOT NULL,
          print_sides VARCHAR(20) NOT NULL,
          unit_price INTEGER NOT NULL,
          side_multiplier NUMERIC(4,2) NOT NULL,
          item_total INTEGER NOT NULL
        );
      `);

      await db.query(`
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS disk_path TEXT;
      `);

      await db.query(`
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS file_size BIGINT;
      `);

      await db.query(`
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS mime_type VARCHAR(120);
      `);

      await db.query(`
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS original_file_name VARCHAR(255);
      `);

      await db.query(`
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS original_disk_path TEXT;
      `);

      await db.query(`
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS original_file_size BIGINT;
      `);

      await db.query(`
        ALTER TABLE order_items
        ADD COLUMN IF NOT EXISTS original_mime_type VARCHAR(120);
      `);

      await db.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS printable_page_count INTEGER;`);
      await db.query(`ALTER TABLE order_items ADD COLUMN IF NOT EXISTS page_overrides JSONB NOT NULL DEFAULT '{}'::jsonb;`);
    })().catch((error) => {
      schemaReady = null;
      throw error;
    });
  }

  return schemaReady;
}

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(1000 + Math.random() * 9000);

  return `R-${date}-${random}`;
}

function textValue(formData: FormData, name: string) {
  const value = formData.get(name);

  return typeof value === "string" ? value.trim() : "";
}

function parseFileSettings(
  rawValue: string,
  expectedFileCount: number
):
  | { valid: true; settings: SubmittedFileSettings[] }
  | { valid: false; error: string } {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return {
      valid: false,
      error: "Не удалось прочитать настройки печати файлов.",
    };
  }

  if (!Array.isArray(parsedValue) || parsedValue.length !== expectedFileCount) {
    return {
      valid: false,
      error:
        "Настройки печати должны быть указаны отдельно для каждого файла.",
    };
  }

  const fileIds = new Set<string>();
  const settings: SubmittedFileSettings[] = [];

  for (const item of parsedValue) {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      return {
        valid: false,
        error: "Некорректный формат настроек печати.",
      };
    }

    const value = item as Record<string, unknown>;

    const fileId =
      typeof value.fileId === "string" ? value.fileId.trim() : "";

    const defaults = value.defaults;
    const copies = value.copies;
    const printSides = value.printSides;
    const rawPageOverrides = value.pageOverrides;

    if (!fileId || fileIds.has(fileId)) {
      return {
        valid: false,
        error: "Не удалось сопоставить настройки с файлами заказа.",
      };
    }

    if (!defaults || typeof defaults !== "object" || Array.isArray(defaults)) {
      return { valid: false, error: "Выбран некорректный формат бумаги." };
    }

    const paperFormat = (defaults as Record<string, unknown>).paperFormat;
    const colorMode = (defaults as Record<string, unknown>).colorMode;
    if ((paperFormat !== "A4" && paperFormat !== "A3") || colorMode !== "black-and-white") {
      return { valid: false, error: "Выбраны некорректные настройки печати." };
    }

    if (!rawPageOverrides || typeof rawPageOverrides !== "object" || Array.isArray(rawPageOverrides)) {
      return { valid: false, error: "Некорректные настройки страниц." };
    }

    const pageOverrides: Record<number, PagePrintOverride> = {};
    for (const [key, rawOverride] of Object.entries(rawPageOverrides as Record<string, unknown>)) {
      const pageNumber = Number(key);
      if (!Number.isInteger(pageNumber) || pageNumber < 1 || !rawOverride || typeof rawOverride !== "object" || Array.isArray(rawOverride)) {
        return { valid: false, error: "Некорректные настройки страниц." };
      }
      const override = rawOverride as Record<string, unknown>;
      if (override.pageNumber !== pageNumber || (override.included !== undefined && typeof override.included !== "boolean")) {
        return { valid: false, error: "Некорректные настройки страниц." };
      }
      pageOverrides[pageNumber] = { pageNumber, ...(override.included === false ? { included: false } : {}) };
    }

    if (
      typeof copies !== "number" ||
      !Number.isInteger(copies) ||
      copies < 1 ||
      copies > 1000
    ) {
      return {
        valid: false,
        error: "Проверьте количество копий для каждого файла.",
      };
    }

    if (printSides !== "one-sided" && printSides !== "two-sided") {
      return {
        valid: false,
        error: "Выбран некорректный режим печати.",
      };
    }

    fileIds.add(fileId);

    settings.push({
      fileId,
      paperFormat: paperFormat as "A4" | "A3",
      copies,
      printSides,
      pageOverrides,
    });
  }

  return {
    valid: true,
    settings,
  };
}

const DRAFT_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

class DraftUnavailableError extends Error {}

function parseSubmittedOrderItems(
  rawValue: string
):
  | { valid: true; items: SubmittedOrderItem[] }
  | { valid: false; error: string } {
  let parsedValue: unknown;

  try {
    parsedValue = JSON.parse(rawValue);
  } catch {
    return { valid: false, error: "Не удалось прочитать состав заказа." };
  }

  if (!Array.isArray(parsedValue) || parsedValue.length < 1) {
    return { valid: false, error: "Добавьте хотя бы один файл для печати." };
  }

  if (parsedValue.length > MAX_FILES_PER_ORDER) {
    return {
      valid: false,
      error: `За один заказ можно добавить не больше ${MAX_FILES_PER_ORDER} файлов.`,
    };
  }

  const fileIds = new Set<string>();
  const items: SubmittedOrderItem[] = [];

  for (const value of parsedValue) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { valid: false, error: "Некорректный состав заказа." };
    }

    const item = value as Record<string, unknown>;
    const fileId = typeof item.fileId === "string" ? item.fileId.trim() : "";
    const kind = item.kind;
    const draftId = typeof item.draftId === "string" ? item.draftId.trim() : "";

    if (!fileId || fileIds.has(fileId) || (kind !== "image" && kind !== "document")) {
      return { valid: false, error: "Некорректный состав заказа." };
    }

    if (kind === "document" && !DRAFT_ID_PATTERN.test(draftId)) {
      return {
        valid: false,
        error: "Документ нужно подготовить заново перед оформлением заказа.",
      };
    }

    fileIds.add(fileId);
    items.push({ fileId, kind, ...(kind === "document" ? { draftId } : {}) });
  }

  return { valid: true, items };
}

export async function POST(request: Request) {
  const requestId = getRequestId();

  try {
    const rateLimit = await checkRateLimit(request, "create_order", {
      shortWindowMinutes: 15,
      shortWindowLimit: 8,
      dailyLimit: 30,
    });

    if (!rateLimit.allowed) {
      return NextResponse.json(
        {
          error:
            "Слишком много попыток оформления заказа. Попробуйте немного позже.",
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

    await ensureSchema();

    const formData = await request.formData();
    const website = textValue(formData, "website");

    /*
     * Honeypot: не сообщаем боту, что его запрос отклонён.
     */
    if (website) {
      return NextResponse.json({
        success: true,
        orderNumber: `R-${Date.now()}`,
      });
    }

    const parsedOrderItems = parseSubmittedOrderItems(
      textValue(formData, "orderItems")
    );

    if (!parsedOrderItems.valid) {
      return NextResponse.json(
        { error: parsedOrderItems.error, requestId },
        { status: 400 }
      );
    }

    const submittedItems = parsedOrderItems.items;
    const imageFiles = formData
      .getAll("imageFiles")
      .filter((value): value is File => value instanceof File);

    if (imageFiles.length !== submittedItems.filter((item) => item.kind === "image").length) {
      return NextResponse.json(
        { error: "Не удалось сопоставить изображения с позициями заказа.", requestId },
        { status: 400 }
      );
    }

    let totalSourceFileSize = 0;

    for (const file of imageFiles) {
      const validation = validateSupportedFile(file);

      if (!validation.valid || validation.kind !== "image") {
        return NextResponse.json(
          {
            error: `${file.name}: ${validation.valid ? "ожидалось изображение JPG или PNG." : validation.error}`,
            requestId,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          { error: `${file.name}: размер файла не должен превышать 50 МБ.`, requestId },
          { status: 400 }
        );
      }

      totalSourceFileSize += file.size;
    }

    if (totalSourceFileSize > MAX_TOTAL_FILE_SIZE) {
      return NextResponse.json(
        { error: "Общий размер изображений в заказе не должен превышать 200 МБ.", requestId },
        { status: 400 }
      );
    }

    const customerName = textValue(formData, "customerName");
    const customerPhone = textValue(formData, "customerPhone");
    const customerEmail = textValue(formData, "customerEmail");
    const customerComment = textValue(formData, "customerComment");

    if (customerName.length < 2) {
      return NextResponse.json(
        { error: "Укажите имя.", requestId },
        { status: 400 }
      );
    }

    if (customerPhone.length < 6) {
      return NextResponse.json(
        { error: "Укажите корректный номер телефона.", requestId },
        { status: 400 }
      );
    }

    const parsedFileSettings = parseFileSettings(
      textValue(formData, "fileSettings"),
      submittedItems.length
    );

    if (!parsedFileSettings.valid) {
      return NextResponse.json(
        { error: parsedFileSettings.error, requestId },
        { status: 400 }
      );
    }

    const ownerToken = getPrintDraftOwnerToken(request);
    const preparedItems: Array<
      PreparedOrderItem & { settings: SubmittedFileSettings }
    > = [];
    let imageIndex = 0;

    for (const [index, submittedItem] of submittedItems.entries()) {
      const settings = parsedFileSettings.settings[index];

      if (settings.fileId !== submittedItem.fileId) {
        return NextResponse.json(
          { error: "Не удалось сопоставить настройки с файлами заказа.", requestId },
          { status: 400 }
        );
      }

      if (submittedItem.kind === "image") {
        const file = imageFiles[imageIndex++];
        preparedItems.push({
          kind: "image",
          file,
          pageCount: 1,
          settings: { ...settings, printSides: "one-sided", pageOverrides: {} },
        });
        continue;
      }

      if (!ownerToken) {
        return NextResponse.json(
          { error: "Срок доступа к подготовленному документу истёк. Загрузите его снова.", requestId },
          { status: 409 }
        );
      }

      const draft = await getOwnedPrintDraft(submittedItem.draftId!, ownerToken);

      if (!draft || draft.pageCount > MAX_PAGE_COUNT) {
        return NextResponse.json(
          { error: "Подготовленный документ больше недоступен. Загрузите его снова.", requestId },
          { status: 409 }
        );
      }

      if (Object.keys(settings.pageOverrides).some((page) => Number(page) > draft.pageCount)) {
        return NextResponse.json({ error: "Настройки содержат несуществующую страницу документа.", requestId }, { status: 400 });
      }
      if (getPrintablePageCount(draft.pageCount, { copies: settings.copies, printSides: settings.printSides, defaults: { paperFormat: settings.paperFormat, colorMode: "black-and-white" }, pageOverrides: settings.pageOverrides }) < 1) {
        return NextResponse.json({ error: "Нельзя исключить все страницы документа.", requestId }, { status: 400 });
      }

      preparedItems.push({ kind: "document", draft, pageCount: draft.pageCount, settings });
    }

    const pricedItems = preparedItems.map((item) => ({
      ...item,
      pricing: getPrintPrice({
        paperFormat: item.settings.paperFormat,
        printSides: item.settings.printSides,
        pageCount: item.kind === "document" ? getPrintablePageCount(item.pageCount, { copies: item.settings.copies, printSides: item.settings.printSides, defaults: { paperFormat: item.settings.paperFormat, colorMode: "black-and-white" }, pageOverrides: item.settings.pageOverrides }) : item.pageCount,
        copies: item.settings.copies,
      }),
    }));

    const totalPrice = pricedItems.reduce(
      (total, item) => total + item.pricing.totalPrice,
      0
    );
    const orderNumber = createOrderNumber();
    const uploadedItems = [];

    for (const item of pricedItems) {
      if (item.kind === "image") {
        if (!item.file) {
          throw new Error("Не найдено изображение для заказа.");
        }

        const original = await uploadOrderFile({ file: item.file, orderNumber });
        uploadedItems.push({ ...item, original, printFile: original });
        continue;
      }

      if (!item.draft) {
        throw new Error("Не найден подготовленный документ для заказа.");
      }

      uploadedItems.push({
        ...item,
        original: {
          originalName: item.draft.originalFileName,
          diskPath: item.draft.originalDiskPath,
          fileSize: item.draft.originalFileSize,
          mimeType: item.draft.originalMimeType,
        },
        printFile: {
          originalName: item.draft.pdfFileName,
          diskPath: item.draft.pdfDiskPath,
          fileSize: item.draft.pdfFileSize,
          mimeType: "application/pdf",
        },
      });
    }

    const client = await getDb().connect();

    try {
      await client.query("BEGIN");

      if (ownerToken) {
        for (const item of pricedItems) {
          if (!item.draft) {
            continue;
          }

          const claimResult = await client.query(
            `
              UPDATE print_drafts
              SET status = 'used', used_at = NOW()
              WHERE id = $1
                AND owner_token_hash = $2
                AND status = 'ready'
                AND expires_at > NOW()
              RETURNING id;
            `,
            [item.draft.id, hashPrintDraftOwnerToken(ownerToken)]
          );

          if (claimResult.rowCount !== 1) {
            throw new DraftUnavailableError(
              "Подготовленный документ больше недоступен. Загрузите его снова."
            );
          }
        }
      }

      const orderResult = await client.query<{ id: string }>(
        `
          INSERT INTO orders (
            order_number,
            customer_name,
            customer_phone,
            customer_email,
            customer_comment,
            fulfillment_method,
            status,
            total_price
          )
          VALUES ($1, $2, $3, $4, $5, 'pickup', 'new', $6)
          RETURNING id;
        `,
        [
          orderNumber,
          customerName,
          customerPhone,
          customerEmail || null,
          customerComment || null,
          totalPrice,
        ]
      );

      const orderId = orderResult.rows[0].id;

      for (const item of uploadedItems) {
        await client.query(
          `
            INSERT INTO order_items (
              order_id,
              file_name,
              disk_path,
              file_size,
              mime_type,
              original_file_name,
              original_disk_path,
              original_file_size,
              original_mime_type,
              paper_format,
              page_count,
              printable_page_count,
              page_overrides,
              copies,
              print_sides,
              unit_price,
              side_multiplier,
              item_total
            )
            VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10, $11, $12, $13, $14, $15, $16, $17, $18
            );
          `,
          [
            orderId,
            item.printFile.originalName,
            item.printFile.diskPath,
            item.printFile.fileSize,
            item.printFile.mimeType,
            item.original.originalName,
            item.original.diskPath,
            item.original.fileSize,
            item.original.mimeType,
            item.settings.paperFormat,
            item.pageCount,
            item.pricing.quantity / item.settings.copies,
            JSON.stringify(item.settings.pageOverrides),
            item.settings.copies,
            item.settings.printSides,
            item.pricing.effectiveUnitPrice,
            item.pricing.sidesMultiplier,
            item.pricing.totalPrice,
          ]
        );
      }

      await client.query("COMMIT");

      return NextResponse.json({
        success: true,
        orderNumber,
        totalPrice,
      });
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof DraftUnavailableError) {
      return NextResponse.json(
        { error: error.message, requestId },
        { status: 409 }
      );
    }

        await logAppError({
          request,
          requestId,
          scope: "create_order_failed",
          error,
        });

    return NextResponse.json(
      {
        error:
          "Не удалось создать заказ. Попробуйте ещё раз немного позже.",
        requestId,
      },
      { status: 500 }
    );
  }
}