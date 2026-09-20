import { createHash, randomBytes } from "node:crypto";
import { getDb } from "@/lib/db";

export const ORDER_GUEST_COOKIE = "raspechatka_order_guest";
export const ORDER_GUEST_MAX_AGE = 60 * 60 * 24 * 30;
export function validGuestToken(value: string | undefined): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}
export function newGuestToken() { return randomBytes(32).toString("hex"); }
export function hashGuestToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

let schemaReady: Promise<void> | null = null;
// Called after the existing orders schema is initialized.
export function ensureOrderCheckoutSchema() {
  if (!schemaReady) {
    schemaReady = getDb().query(`
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS guest_token_hash TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS payment_method VARCHAR(30);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_point_id VARCHAR(120);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_point_address TEXT;
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS pickup_point_type VARCHAR(40);
      ALTER TABLE orders ADD COLUMN IF NOT EXISTS delivery_price INTEGER;
    `).then(() => undefined).catch((error) => {
      schemaReady = null;
      throw error;
    });
  }
  return schemaReady;
}

export type GuestOrder = {
  id: string;
  order_number: string;
  customer_name: string;
  customer_phone: string;
  customer_comment: string | null;
  total_price: number;
  status: string;
  fulfillment_method: string;
  payment_method: string | null;
  pickup_point_id: string | null;
  pickup_point_address: string | null;
  pickup_point_type: string | null;
  delivery_price: number | null;
  package_weight_grams: number | null;
};

export async function getGuestOrder(id: string, token: string | undefined) {
  if (!/^[1-9][0-9]{0,17}$/.test(id) || !validGuestToken(token)) return null;
  await ensureOrderCheckoutSchema();
  const result = await getDb().query<GuestOrder>(`
    SELECT id, order_number, customer_name, customer_phone, customer_comment,
           total_price, status, fulfillment_method, payment_method,
           pickup_point_id, pickup_point_address, pickup_point_type, delivery_price,
           package_weight_grams
    FROM orders WHERE id = $1 AND guest_token_hash = $2
  `, [id, hashGuestToken(token)]);
  return result.rows[0] ?? null;
}
