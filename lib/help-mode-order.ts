import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { validateSupportedFile } from "@/lib/converter";
import { validatePrintFile } from "@/lib/security";
import { deleteDiskFile, uploadOrderFile } from "@/lib/yandex-disk";

// Uses orders and order_items, not a separate request store. Zero/empty values
// satisfy legacy NOT NULL columns; the admin UI must not show them as settings.
export async function createHelpModeOrder(form: FormData, orderNumber: string) {
  const phone = form.get("helpPhone");
  const method = form.get("helpContact");
  const files = form.getAll("helpFiles");
  if (typeof phone !== "string" || phone.length > 40 || !/^[+\d ()-]+$/.test(phone) || !/^\d{10,15}$/.test(phone.replace(/\D/g, ""))) {
    return NextResponse.json({ error: "Укажите корректный номер телефона." }, { status: 400 });
  }
  if (method !== "call" && method !== "max") return NextResponse.json({ error: "Выберите способ связи." }, { status: 400 });
  if (form.get("personalDataConsent") !== "true") return NextResponse.json({ error: "Необходимо согласие на обработку персональных данных." }, { status: 400 });
  if (!files.length || files.length > 8 || files.some(f => !(f instanceof File))) return NextResponse.json({ error: "Выберите от 1 до 8 файлов." }, { status: 400 });
  const selected = files as File[];
  if (selected.reduce((sum, f) => sum + f.size, 0) > 200 * 1024 * 1024) return NextResponse.json({ error: "Общий размер файлов — не больше 200 МБ." }, { status: 400 });
  for (const file of selected) {
    const valid = validateSupportedFile(file);
    if (!valid.valid) return NextResponse.json({ error: valid.error }, { status: 400 });
    if (/\.(pdf|jpe?g|png)$/i.test(file.name)) {
      const signature = await validatePrintFile(file);
      if (!signature.valid) return NextResponse.json({ error: signature.error }, { status: 400 });
    }
  }
  const uploads: Awaited<ReturnType<typeof uploadOrderFile>>[] = [];
  let commitAttempted = false;
  try {
    for (const file of selected) uploads.push(await uploadOrderFile({ file, orderNumber }));
    const client = await getDb().connect();
    try {
      await client.query("BEGIN");
      const order = await client.query<{ id: string }>(`INSERT INTO orders
        (order_number, customer_name, customer_phone, customer_email, customer_comment, fulfillment_method, status, total_price, print_price)
        VALUES ($1, '', $2, NULL, NULL, $3, 'new', 0, 0) RETURNING id`, [orderNumber, phone.trim(), `help_${method}`]);
      for (const f of uploads) {
        await client.query(`INSERT INTO order_items
          (order_id, file_name, disk_path, file_size, mime_type, original_file_name, original_disk_path,
           original_file_size, original_mime_type, paper_format, page_count, copies, print_sides, unit_price, side_multiplier, item_total)
          VALUES ($1,$2,$3,$4,$5,$2,$3,$4,$5,'',0,0,'',0,0,0)`,
          [order.rows[0].id, f.originalName, f.diskPath, f.fileSize, f.mimeType]);
      }
      commitAttempted = true;
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw error;
    } finally { client.release(); }
    return NextResponse.json({ success: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    // On ambiguous COMMIT failure the order may exist; retain its files.
    if (!commitAttempted) for (const f of uploads) await deleteDiskFile(f.diskPath).catch(() => console.error("Help-order upload cleanup failed"));
    throw error;
  }
}
