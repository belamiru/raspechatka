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
  file_name: string | null;
  paper_format: string;
  page_count: number;
  copies: number;
  print_sides: string;
};

export default async function AdminPage() {
  const cookieStore = await cookies();

  const isAdmin = await isAdminSession(
    cookieStore.get(getAdminCookieName())?.value
  );

  if (!isAdmin) {
    redirect("/admin/login");
  }

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
      order_items.file_name,
      order_items.paper_format,
      order_items.page_count,
      order_items.copies,
      order_items.print_sides
    FROM orders
    LEFT JOIN order_items ON order_items.order_id = orders.id
    ORDER BY orders.created_at DESC;
  `);

  const orders = result.rows.map((order) => ({
    id: order.id,
    orderNumber: order.order_number,
    customerName: order.customer_name,
    customerPhone: order.customer_phone,
    customerEmail: order.customer_email,
    customerComment: order.customer_comment,
    totalPrice: order.total_price,
    status: order.status,
    createdAt: order.created_at.toISOString(),
    fileName: order.file_name,
    paperFormat: order.paper_format ?? "—",
    pageCount: order.page_count ?? 0,
    copies: order.copies ?? 0,
    printSides: order.print_sides ?? "one-sided",
  }));

  return <AdminOrders initialOrders={orders} />;
}