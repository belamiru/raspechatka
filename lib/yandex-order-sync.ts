import { getDb } from "@/lib/db";
import { createYandexPickupDelivery } from "@/lib/yandex-delivery";

type ClaimedOrder = {
  id: string; order_number: string; pickup_point_id: string; customer_name: string;
  customer_phone: string; customer_email: string | null; package_weight_grams: number;
  package_width_mm: number; package_length_mm: number; package_height_mm: number;
};

// Claims the row before calling Yandex, so concurrent webhook/status checks cannot create two requests.
export async function createYandexDeliveryForPaidOrder(orderId: string) {
  const db = getDb();
  const claimed = await db.query<ClaimedOrder>(`
    UPDATE orders SET yandex_delivery_status = 'creating', yandex_delivery_error = NULL, updated_at = NOW()
    WHERE id = $1 AND status = 'paid' AND fulfillment_method = 'yandex_pickup_point'
      AND yandex_delivery_request_id IS NULL AND COALESCE(yandex_delivery_status, '') <> 'creating'
    RETURNING id, order_number, pickup_point_id, customer_name, customer_phone, customer_email,
      package_weight_grams, package_width_mm, package_length_mm, package_height_mm
  `, [orderId]);
  const order = claimed.rows[0];
  if (!order) return false;
  try {
    if (!order.pickup_point_id) throw new Error("Не сохранён пункт выдачи Яндекс Доставки.");
    const result = await createYandexPickupDelivery({
      orderNumber: order.order_number,
      pickupPointId: order.pickup_point_id,
      recipient: { name: order.customer_name, phone: order.customer_phone, email: order.customer_email },
      package: {
        weightGrams: Number(order.package_weight_grams), widthMm: Number(order.package_width_mm),
        lengthMm: Number(order.package_length_mm), heightMm: Number(order.package_height_mm),
      },
    });
    await db.query(`
      UPDATE orders SET yandex_delivery_request_id = $1, yandex_delivery_status = 'created',
        yandex_delivery_error = NULL, yandex_delivery_created_at = NOW(), updated_at = NOW()
      WHERE id = $2 AND yandex_delivery_status = 'creating'
    `, [result.requestId, order.id]);
    return true;
  } catch (cause) {
    const message = cause instanceof Error ? cause.message.slice(0, 2000) : "Unknown Yandex Delivery creation error";
    await db.query(`UPDATE orders SET yandex_delivery_status = 'failed', yandex_delivery_error = $1, updated_at = NOW()
      WHERE id = $2 AND yandex_delivery_status = 'creating'`, [message, order.id]);
    throw cause;
  }
}
