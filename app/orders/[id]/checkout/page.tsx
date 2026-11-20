import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGuestOrder, hashGuestToken, ORDER_GUEST_COOKIE } from "@/lib/order-checkout";
import { getDb } from "@/lib/db";
import type { SummaryItem } from "@/components/order-summary-items";
import { OrderCheckout } from "@/components/order-checkout";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
  title: "Оформление заказа", robots: { index: false, follow: false },
};
export default async function CheckoutPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const token = (await cookies()).get(ORDER_GUEST_COOKIE)?.value;
  const order = await getGuestOrder(id, token);
  if (!order) notFound();
  const items = await getDb().query<{
    id: string; name: string | null; page_count: number; printable_page_count: number | null;
    copies: number; print_sides: string; paper_format: string; page_overrides: SummaryItem["pageOverrides"] | null; print_extras: Record<string, unknown> | null; item_total: number;
  }>(`SELECT i.id, COALESCE(i.original_file_name, i.file_name) AS name,
             i.page_count, i.printable_page_count, i.copies, i.print_sides, i.paper_format, i.page_overrides, i.print_extras, i.item_total
      FROM order_items i JOIN orders o ON o.id = i.order_id
      WHERE o.id = $1 AND o.guest_token_hash = $2 ORDER BY i.id`, [id, hashGuestToken(token!)]);
  const summaryItems: SummaryItem[] = items.rows.map(item => ({
    id: String(item.id), name: item.name ?? "Файл", kind: typeof item.print_extras?.printKind === "string" ? item.print_extras.printKind : null,
    pages: item.page_count, printablePages: item.printable_page_count ?? item.page_count,
    copies: item.copies, sides: item.print_sides, format: item.paper_format, pageOverrides: item.page_overrides ?? {}, extras: item.print_extras ?? {}, total: item.item_total,
  }));
  return <OrderCheckout order={order} summaryItems={summaryItems} />;
}
