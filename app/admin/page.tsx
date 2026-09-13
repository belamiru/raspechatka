import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import AdminOrders from "./admin-orders";

export const dynamic = "force-dynamic";

type OrderRow = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email: string | null;
  customer_comment: string | null;
  total_price: number;
  status: "new" | "in_progress" | "ready" | "completed" | "cancelled";
  created_at: Date;

  item_id: string | null;
  file_name: string | null;
  disk_path: string | null;
  mime_type: string | null;
  paper_format: string | null;
  page_count: number | null;
  copies: number | null;
  print_sides: string | null;
};

export default async function AdminPage() {
  const cookieStore = await cookies();

  const isAdmin = await isAdminSession(
    cookieStore.get(getAdminCookieName())?.value
  );

  if (!isAdmin) {
    redirect("/admin/login");
  }

  /*
   * LEFT JOIN возвращает строку для каждой позиции заказа.
   * Ниже эти строки группируются по orders.id, чтобы в админке
   * один заказ показывался одной карточкой.
   */
  const result = await getDb().query<OrderRow>(`
    SELECT
      orders.id,
      orders.order_number,
      orders.customer_name,
      orders.customer_phone,
      orders.customer_email,
      orders.customer_comment,
      orders.total_price,
      orders.status,
      orders.created_at,

      order_items.id AS item_id,
      order_items.file_name,
      order_items.disk_path,
      order_items.mime_type,
      order_items.paper_format,
      order_items.page_count,
      order_items.copies,
      order_items.print_sides
    FROM orders
    LEFT JOIN order_items ON order_items.order_id = orders.id
    ORDER BY orders.created_at DESC, order_items.id ASC;
  `);

  const ordersById = new Map<
    string,
    {
      id: string;
      orderNumber: string;
      customerName: string;
      customerPhone: string;
      customerEmail: string | null;
      customerComment: string | null;
      totalPrice: number;
      status: "new" | "in_progress" | "ready" | "completed" | "cancelled";
      createdAt: string;
      files: {
        id: string;
        fileName: string | null;
        diskPath: string | null;
        mimeType: string | null;
        paperFormat: string;
        pageCount: number;
        copies: number;
        printSides: string;
      }[];
    }
  >();

  for (const row of result.rows) {
    let order = ordersById.get(row.id);

    if (!order) {
      order = {
        id: row.id,
        orderNumber: row.order_number,
        customerName: row.customer_name,
        customerPhone: row.customer_phone,
        customerEmail: row.customer_email,
        customerComment: row.customer_comment,
        totalPrice: Number(row.total_price),
        status: row.status,
        createdAt: row.created_at.toISOString(),
        files: [],
      };

      ordersById.set(row.id, order);
    }

    /*
     * LEFT JOIN допускает заказ без позиций: в таком случае item_id будет null.
     */
    if (row.item_id) {
      order.files.push({
        id: row.item_id,
        fileName: row.file_name,
        diskPath: row.disk_path,
        mimeType: row.mime_type,
        paperFormat: row.paper_format ?? "—",
        pageCount: row.page_count ?? 0,
        copies: row.copies ?? 0,
        printSides: row.print_sides ?? "one-sided",
      });
    }
  }

  const orders = Array.from(ordersById.values());

  return <AdminOrders initialOrders={orders} />;
}