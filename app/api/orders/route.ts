import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { uploadOrderFile } from "@/lib/yandex-disk";
import {
  checkRateLimit,
  getRequestId,
  logAppError,
  validatePrintFile,
} from "@/lib/security";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_FILE_SIZE = 25 * 1024 * 1024;

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

    const file = formData.get("file");

    if (!(file instanceof File)) {
      return NextResponse.json(
        {
          error: "Сначала выберите файл для печати.",
          requestId,
        },
        { status: 400 }
      );
    }

    if (file.size < 1) {
      return NextResponse.json(
        {
          error: "Выбранный файл пустой.",
          requestId,
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        {
          error: "Размер файла не должен превышать 25 МБ.",
          requestId,
        },
        { status: 400 }
      );
    }

    const fileValidation = await validatePrintFile(file);

    if (!fileValidation.valid) {
      return NextResponse.json(
        {
          error: fileValidation.error,
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

    const pageCount = Number(textValue(formData, "pageCount"));
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

    if (
      !Number.isInteger(pageCount) ||
      pageCount < 1 ||
      pageCount > 10000
    ) {
      return NextResponse.json(
        {
          error: "Проверьте количество страниц.",
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

    const unitPrice = paperFormat === "A3" ? 20 : 10;
    const sideMultiplier = printSides === "two-sided" ? 1.5 : 1;
    const totalPrice = Math.round(
      unitPrice * pageCount * copies * sideMultiplier
    );

    const orderNumber = createOrderNumber();

    const uploadedFile = await uploadOrderFile({
      file,
      orderNumber,
    });

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

      await client.query(
        `
          INSERT INTO order_items (
            order_id,
            file_name,
            disk_path,
            file_size,
            mime_type,
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
            $6, $7, $8, $9, $10, $11, $12
          );
        `,
        [
          orderId,
          uploadedFile.originalName,
          uploadedFile.diskPath,
          uploadedFile.fileSize,
          uploadedFile.mimeType,
          paperFormat,
          pageCount,
          copies,
          printSides,
          unitPrice,
          sideMultiplier,
          totalPrice,
        ]
      );

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
          "Не удалось загрузить файл и создать заказ. Попробуйте ещё раз.",
        requestId,
      },
      { status: 500 }
    );
  }
}