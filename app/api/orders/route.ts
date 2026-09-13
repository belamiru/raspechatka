import { NextResponse } from "next/server";
import {
  analyzeDocumentFile,
  validateSupportedFile,
  type FileKind,
} from "@/lib/converter";
import { getDb } from "@/lib/db";
import {
  uploadOrderFile,
  uploadOrderFiles,
} from "@/lib/yandex-disk";
import { getPrintPrice } from "@/lib/pricing";
import {
  checkRateLimit,
  getRequestId,
  logAppError,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 200 * 1024 * 1024;
const MAX_FILES_PER_ORDER = 8;
const MAX_PAGE_COUNT = 10_000;

type PreparedOrderItem = {
  file: File;
  kind: FileKind;
  pageCount: number;
  printPdf?: Uint8Array;
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

function makePrintPdfName(fileName: string) {
  const baseName = fileName.replace(/\.[^.]+$/, "").trim() || "document";

  return `${baseName}.pdf`;
}

function getSubmittedFiles(formData: FormData) {
  const files = formData
    .getAll("files")
    .filter((value): value is File => value instanceof File);

  /*
   * Временная обратная совместимость с предыдущей формой:
   * до публикации нового интерфейса она отправляет поле "file".
   */
  if (files.length > 0) {
    return files;
  }

  const legacyFile = formData.get("file");

  return legacyFile instanceof File ? [legacyFile] : [];
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

    if (website) {
      // Не сообщаем боту, что его запрос был отклонён.
      return NextResponse.json({
        success: true,
        orderNumber: `R-${Date.now()}`,
      });
    }

    const files = getSubmittedFiles(formData);

    if (files.length < 1) {
      return NextResponse.json(
        {
          error: "Сначала выберите хотя бы один файл для печати.",
          requestId,
        },
        { status: 400 }
      );
    }

    if (files.length > MAX_FILES_PER_ORDER) {
      return NextResponse.json(
        {
          error: `За один заказ можно добавить не больше ${MAX_FILES_PER_ORDER} файлов.`,
          requestId,
        },
        { status: 400 }
      );
    }

    let totalSourceFileSize = 0;
    const fileKinds: FileKind[] = [];

    for (const file of files) {
      const validation = validateSupportedFile(file);

      if (!validation.valid) {
        return NextResponse.json(
          {
            error: `${file.name}: ${validation.error}`,
            requestId,
          },
          { status: 400 }
        );
      }

      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json(
          {
            error: `${file.name}: размер файла не должен превышать 50 МБ.`,
            requestId,
          },
          { status: 400 }
        );
      }

      totalSourceFileSize += file.size;
      fileKinds.push(validation.kind);
    }

    if (totalSourceFileSize > MAX_TOTAL_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "Общий размер файлов в заказе не должен превышать 200 МБ.",
          requestId,
        },
        { status: 400 }
      );
    }

    const customerName = textValue(formData, "customerName");
    const customerPhone = textValue(formData, "customerPhone");
    const customerEmail = textValue(formData, "customerEmail");
    const customerComment = textValue(formData, "customerComment");

    const paperFormat =
      textValue(formData, "paperFormat") === "A3" ? "A3" : "A4";

    const printSides =
      textValue(formData, "printSides") === "two-sided"
        ? "two-sided"
        : "one-sided";

    const copies = Number(textValue(formData, "copies"));

    if (customerName.length < 2) {
      return NextResponse.json(
        {
          error: "Укажите имя.",
          requestId,
        },
        { status: 400 }
      );
    }

    if (customerPhone.length < 6) {
      return NextResponse.json(
        {
          error: "Укажите корректный номер телефона.",
          requestId,
        },
        { status: 400 }
      );
    }

    if (!Number.isInteger(copies) || copies < 1 || copies > 1000) {
      return NextResponse.json(
        {
          error: "Проверьте количество копий.",
          requestId,
        },
        { status: 400 }
      );
    }

    /*
     * Повторяем обработку всех документов на сервере и не доверяем
     * pageCount, переданному браузером. Изображение — одна страница
     * и никогда не отправляется в converter-service.
     */
    const preparedItems: PreparedOrderItem[] = [];

    for (const [index, file] of files.entries()) {
      const kind = fileKinds[index];

      if (kind === "image") {
        preparedItems.push({
          file,
          kind,
          pageCount: 1,
        });

        continue;
      }

      const analysis = await analyzeDocumentFile(file);

      if (
        !Number.isInteger(analysis.pageCount) ||
        analysis.pageCount < 1 ||
        analysis.pageCount > MAX_PAGE_COUNT
      ) {
        return NextResponse.json(
          {
            error: `${file.name}: в подготовленном файле некорректное количество страниц.`,
            requestId,
          },
          { status: 400 }
        );
      }

      preparedItems.push({
        file,
        kind,
        pageCount: analysis.pageCount,
        printPdf: analysis.pdfBytes,
      });
    }

    const pricedItems = preparedItems.map((item) => {
      const pricing = getPrintPrice({
        paperFormat,
        printSides,
        pageCount: item.pageCount,
        copies,
      });

      return {
        ...item,
        pricing,
      };
    });

    const totalPrice = pricedItems.reduce(
      (total, item) => total + item.pricing.totalPrice,
      0
    );

    const orderNumber = createOrderNumber();

    /*
     * Документы хранятся в двух вариантах:
     * original — исходный файл, print-pdf — подготовленный PDF.
     *
     * Изображения хранятся один раз в originals. Этот же файл является
     * файлом для печати, поэтому его данные будут записаны и в полях
     * print-файла позиции заказа.
     */
    const uploadedItems = [];

    for (const item of pricedItems) {
      if (item.kind === "image") {
        const original = await uploadOrderFile({
          file: item.file,
          orderNumber,
        });

        uploadedItems.push({
          ...item,
          original,
          printFile: original,
        });

        continue;
      }

      if (!item.printPdf) {
        throw new Error("Не найден подготовленный PDF для документа.");
      }

      const uploadedFiles = await uploadOrderFiles({
        originalFile: item.file,
        printPdf: item.printPdf,
        printPdfName: makePrintPdfName(item.file.name),
        orderNumber,
      });

      uploadedItems.push({
        ...item,
        original: uploadedFiles.original,
        printFile: uploadedFiles.printPdf,
      });
    }

    const client = await getDb().connect();

    try {
      await client.query("BEGIN");

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
              copies,
              print_sides,
              unit_price,
              side_multiplier,
              item_total
            )
            VALUES (
              $1, $2, $3, $4, $5,
              $6, $7, $8, $9,
              $10, $11, $12, $13, $14, $15, $16
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
            paperFormat,
            item.pageCount,
            copies,
            printSides,
            item.pricing.baseUnitPrice,
            item.pricing.priceMultiplier,
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
    await logAppError({
      request,
      requestId,
      scope: "create_order",
      error,
    });

    return NextResponse.json(
      {
        error:
          "Не удалось подготовить файлы и создать заказ. Попробуйте ещё раз.",
        requestId,
      },
      { status: 500 }
    );
  }
}