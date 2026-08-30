import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

let schemaReady: Promise<void> | null = null;

function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await getDb().query(`
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

      await getDb().query(`
        CREATE TABLE IF NOT EXISTS order_items (
          id BIGSERIAL PRIMARY KEY,
          order_id BIGINT NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
          file_name VARCHAR(255),
          paper_format VARCHAR(10) NOT NULL,
          page_count INTEGER NOT NULL,
          copies INTEGER NOT NULL,
          print_sides VARCHAR(20) NOT NULL,
          unit_price INTEGER NOT NULL,
          side_multiplier NUMERIC(4,2) NOT NULL,
          item_total INTEGER NOT NULL
        );
      `);
    })();
  }

  return schemaReady;
}

function createOrderNumber() {
  const date = new Date().toISOString().slice(0, 10).replaceAll("-", "");
  const random = Math.floor(1000 + Math.random() * 9000);

  return `R-${date}-${random}`;
}

export async function POST(request: Request) {
  try {
    await ensureSchema();

    const body = await request.json();

    const customerName = String(body.customerName ?? "").trim();
    const customerPhone = String(body.customerPhone ?? "").trim();
    const customerEmail = String(body.customerEmail ?? "").trim();
    const customerComment = String(body.customerComment ?? "").trim();
    const fileName = String(body.fileName ?? "").trim();

    const paperFormat = body.paperFormat === "A3" ? "A3" : "A4";
    const printSides =
      body.printSides === "two-sided" ? "two-sided" : "one-sided";

    const pageCount = Number(body.pageCount);
    const copies = Number(body.copies);

    if (!fileName) {
      return NextResponse.json(
        { error: "Сначала выберите файл для печати." },
        { status: 400 }
      );
    }

    if (customerName.length < 2) {
      return NextResponse.json(
        { error: "Укажите имя." },
        { status: 400 }
      );
    }

    if (customerPhone.length < 6) {
      return NextResponse.json(
        { error: "Укажите корректный номер телефона." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(pageCount) ||
      pageCount < 1 ||
      pageCount > 10000
    ) {
      return NextResponse.json(
        { error: "Проверьте количество страниц." },
        { status: 400 }
      );
    }

    if (!Number.isInteger(copies) || copies < 1 || copies > 1000) {
      return NextResponse.json(
        { error: "Проверьте количество копий." },
        { status: 400 }
      );
    }

    const unitPrice = paperFormat === "A3" ? 20 : 10;
    const sideMultiplier = printSides === "two-sided" ? 1.5 : 1;
    const totalPrice = Math.round(
      unitPrice * pageCount * copies * sideMultiplier
    );

    let orderNumber = createOrderNumber();

    for (let attempt = 0; attempt < 3; attempt += 1) {
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
              paper_format,
              page_count,
              copies,
              print_sides,
              unit_price,
              side_multiplier,
              item_total
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);
          `,
          [
            orderId,
            fileName,
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
          orderNumber,
          totalPrice,
        });
      } catch (error) {
        await client.query("ROLLBACK");

        if (
          error instanceof Error &&
          "code" in error &&
          error.code === "23505"
        ) {
          orderNumber = createOrderNumber();
          continue;
        }

        throw error;
      } finally {
        client.release();
      }
    }

    throw new Error("Не удалось сформировать уникальный номер заказа.");
  } catch (error) {
    console.error("Ошибка создания заказа:", error);

    return NextResponse.json(
      { error: "Не удалось создать заказ. Попробуйте ещё раз." },
      { status: 500 }
    );
  }
}