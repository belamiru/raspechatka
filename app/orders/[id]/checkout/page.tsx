import { cookies } from "next/headers";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getGuestOrder, ORDER_GUEST_COOKIE } from "@/lib/order-checkout";
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
  return <OrderCheckout order={order} />;
}
