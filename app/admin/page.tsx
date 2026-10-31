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
  fulfillment_method: string;
  pickup_point_id: string | null;
  pickup_point_address: string | null;
  pickup_point_type: string | null;
  delivery_price: number | null;
  package_width_mm: number | null;
  package_length_mm: number | null;
  package_height_mm: number | null;
  package_weight_grams: number | null;
  physical_sheet_count: number | null;
  yandex_delivery_status: string | null;
  yandex_delivery_request_id: string | null;
  yandex_delivery_error: string | null;
  status: "awaiting_checkout" | "awaiting_payment" | "paid" | "new" | "in_progress" | "ready" | "completed" | "cancelled";
  created_at: Date;

  item_id: string | null;
  file_name: string | null;
  disk_path: string | null;
  mime_type: string | null;
  paper_format: string | null;
  page_count: number | null;
  printable_page_count: number | null;
  page_overrides: Record<string, { pageNumber: number; included?: boolean; paperFormat?: "A4" | "A3"; colorMode?: "black-and-white" | "color" | "solid-color" }> | null;
  copies: number | null;
  print_sides: string | null;
  print_extras: Record<string, unknown> | null;
};

/*
 * В базе доп. опции лежат как JSONB. Здесь приводим их к типу, чтобы админка
 * не падала на старых заказах, где колонка пустая.
 */
function normalizePrintExtras(raw: Record<string, unknown> | null) {
  if (!raw || typeof raw !== "object") return null;

  const extras = raw as Record<string, unknown>;

  return {
    paper: typeof extras.paper === "string" ? extras.paper : "80",
    lamination: typeof extras.lamination === "string" ? extras.lamination : "none",
    laminationThickness: typeof extras.laminationThickness === "string" ? extras.laminationThickness : "80",
    binding: extras.binding === true,
    coverSet: typeof extras.coverSet === "string" ? extras.coverSet : "none",
    frontCover: typeof extras.frontCover === "string" ? extras.frontCover : "transparent",
    backCover: typeof extras.backCover === "string" ? extras.backCover : "transparent",
    staple: typeof extras.staple === "string" ? extras.staple : "none",
    photoFit: typeof extras.photoFit === "string" ? extras.photoFit : undefined,
  };
}

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
      orders.fulfillment_method,
      orders.pickup_point_id,
      orders.pickup_point_address,
      orders.pickup_point_type,
      orders.delivery_price,
      orders.package_width_mm,
      orders.package_length_mm,
      orders.package_height_mm,
      orders.package_weight_grams,
      orders.physical_sheet_count,
      orders.yandex_delivery_status,
      orders.yandex_delivery_request_id,
      orders.yandex_delivery_error,
      orders.status,
      orders.created_at,

      order_items.id AS item_id,
      order_items.file_name,
      order_items.disk_path,
      order_items.mime_type,
      order_items.paper_format,
      order_items.page_count,
      order_items.printable_page_count,
      order_items.page_overrides,
      order_items.copies,
      order_items.print_sides,
      order_items.print_extras
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
      fulfillmentMethod: string;
      pickupPointId: string | null;
      pickupPointAddress: string | null;
      pickupPointType: string | null;
      deliveryPrice: number | null;
      packageWidthMm: number | null;
      packageLengthMm: number | null;
      packageHeightMm: number | null;
      packageWeightGrams: number | null;
      physicalSheetCount: number | null;
      yandexDeliveryStatus: string | null;
      yandexDeliveryRequestId: string | null;
      yandexDeliveryError: string | null;
      status: "awaiting_checkout" | "awaiting_payment" | "paid" | "new" | "in_progress" | "ready" | "completed" | "cancelled";
      createdAt: string;
      files: {
        id: string;
        fileName: string | null;
        diskPath: string | null;
        mimeType: string | null;
        paperFormat: string;
        pageCount: number;
        printablePageCount: number;
        pageOverrides: Record<string, { pageNumber: number; included?: boolean; paperFormat?: "A4" | "A3"; colorMode?: "black-and-white" | "color" | "solid-color" }>;
        copies: number;
        printSides: string;
        printExtras: ReturnType<typeof normalizePrintExtras>;
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
        fulfillmentMethod: row.fulfillment_method,
        pickupPointId: row.pickup_point_id,
        pickupPointAddress: row.pickup_point_address,
        pickupPointType: row.pickup_point_type,
        deliveryPrice: row.delivery_price,
        packageWidthMm: row.package_width_mm,
        packageLengthMm: row.package_length_mm,
        packageHeightMm: row.package_height_mm,
        packageWeightGrams: row.package_weight_grams,
        physicalSheetCount: row.physical_sheet_count,
        yandexDeliveryStatus: row.yandex_delivery_status,
        yandexDeliveryRequestId: row.yandex_delivery_request_id,
        yandexDeliveryError: row.yandex_delivery_error,
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
        printablePageCount: row.printable_page_count ?? row.page_count ?? 0,
        pageOverrides: row.page_overrides ?? {},
        copies: row.copies ?? 0,
        printSides: row.print_sides ?? "one-sided",
        printExtras: normalizePrintExtras(row.print_extras),
      });
    }
  }

  const orders = Array.from(ordersById.values());

  return <><div className="mx-auto max-w-7xl px-6 pt-6"><a href="/admin/ozon-delivery" className="text-sm font-semibold text-blue-700 underline">Настроить Ozon Доставку</a></div><AdminOrders initialOrders={orders} /></>;
}