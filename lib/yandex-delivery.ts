const YANDEX_DELIVERY_PRICING_API = "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/pricing-calculator";
const YANDEX_DELIVERY_CREATE_API = "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/request/create";
export const YANDEX_DELIVERY_SOURCE_PLATFORM_STATION_ID = "019e06631c07764c8cf4bc2ede9c2284";

type Package = { weightGrams: number; widthMm: number; lengthMm: number; heightMm: number };
type Recipient = { name: string; phone: string; email: string | null };

function toCentimeters(mm: number) { return Math.max(1, Math.ceil(mm / 10)); }
function getToken() {
  const token = process.env.YANDEX_DELIVERY_API_TOKEN?.trim();
  if (!token) throw new Error("Не настроен API Яндекс Доставки.");
  return token;
}
function validatePackage(parcel: Package) {
  if (![parcel.weightGrams, parcel.widthMm, parcel.lengthMm, parcel.heightMm].every(Number.isSafeInteger)
    || parcel.weightGrams < 1 || parcel.widthMm < 1 || parcel.lengthMm < 1 || parcel.heightMm < 1) {
    throw new Error("Для доставки нужны вес и габариты заказа.");
  }
}
function validPickupPointId(value: string) { return /^[a-zA-Z0-9-]{16,120}$/.test(value); }
function parseRublesToKopecks(value: unknown) {
  const match = typeof value === "string" ? value.match(/^\s*(\d+)(?:[.,](\d{1,2}))?\s*RUB\s*$/i) : null;
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
}
function yandexError(body: unknown) {
  if (!body || typeof body !== "object") return null;
  const message = (body as Record<string, unknown>).message;
  return typeof message === "string" && message.length <= 500 ? message : null;
}
function recipientInfo(recipient: Recipient) {
  const names = recipient.name.trim().split(/\s+/).filter(Boolean);
  return {
    first_name: names[0] || "Покупатель",
    ...(names[1] ? { last_name: names.slice(1).join(" ") } : {}),
    phone: recipient.phone,
    ...(recipient.email ? { email: recipient.email } : {}),
  };
}

export async function calculateYandexPickupDelivery({ pickupPointId, printPriceRubles, package: parcel }: {
  pickupPointId: string; printPriceRubles: number; package: Package;
}) {
  const token = getToken();
  if (!validPickupPointId(pickupPointId)) throw new Error("Некорректный пункт выдачи.");
  validatePackage(parcel);
  const response = await fetch(YANDEX_DELIVERY_PRICING_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      source: { platform_station_id: YANDEX_DELIVERY_SOURCE_PLATFORM_STATION_ID },
      destination: { platform_station_id: pickupPointId },
      tariff: "self_pickup",
      total_weight: parcel.weightGrams,
      total_assessed_price: printPriceRubles * 100,
      client_price: 0,
      payment_method: "already_paid",
      places: [{ physical_dims: {
        weight_gross: parcel.weightGrams, dx: toCentimeters(parcel.widthMm),
        dy: toCentimeters(parcel.lengthMm), dz: toCentimeters(parcel.heightMm),
      } }],
    }), cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object") throw new Error("Яндекс Доставка не смогла рассчитать стоимость.");
  const result = body as Record<string, unknown>;
  const priceKopecks = parseRublesToKopecks(result.pricing_total);
  if (priceKopecks === null || priceKopecks < 0) throw new Error("Яндекс Доставка вернула некорректную стоимость.");
  const deliveryDays = typeof result.delivery_days === "number" && Number.isFinite(result.delivery_days)
    ? Math.max(0, Math.floor(result.delivery_days)) : null;
  return { priceRubles: Math.ceil(priceKopecks / 100), deliveryDays };
}

// This call is intentionally made only after T-Bank confirms payment.
export async function createYandexPickupDelivery({ orderNumber, pickupPointId, recipient, package: parcel }: {
  orderNumber: string; pickupPointId: string; recipient: Recipient; package: Package;
}) {
  const token = getToken();
  const merchantId = process.env.YANDEX_DELIVERY_MERCHANT_ID?.trim();
  if (!merchantId) throw new Error("Не задан YANDEX_DELIVERY_MERCHANT_ID для создания заказа Яндекс Доставки.");
  if (!validPickupPointId(pickupPointId)) throw new Error("Некорректный пункт выдачи.");
  validatePackage(parcel);
  const response = await fetch(YANDEX_DELIVERY_CREATE_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      info: {
        // Stable merchant-side ID makes repeated T-Bank notifications idempotent in Yandex.
        operator_request_id: `print-${orderNumber}`.slice(0, 50),
        merchant_id: merchantId,
        comment: `Оплаченный заказ ${orderNumber}`.slice(0, 500),
      },
      source: { platform_station: { platform_id: YANDEX_DELIVERY_SOURCE_PLATFORM_STATION_ID } },
      destination: { type: "platform_station", platform_station: { platform_id: pickupPointId } },
      last_mile_policy: "self_pickup",
      places: [{
        barcode: `print-${orderNumber}`.slice(0, 100),
        physical_dims: {
          weight_gross: parcel.weightGrams, dx: toCentimeters(parcel.widthMm),
          dy: toCentimeters(parcel.lengthMm), dz: toCentimeters(parcel.heightMm),
        },
      }],
      recipient_info: recipientInfo(recipient),
    }), cache: "no-store",
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok || !body || typeof body !== "object") {
    throw new Error(`Яндекс Доставка не создала заявку${yandexError(body) ? `: ${yandexError(body)}` : "."}`);
  }
  const requestId = (body as Record<string, unknown>).request_id;
  if (typeof requestId !== "string" || requestId.length < 1 || requestId.length > 200) {
    throw new Error("Яндекс Доставка не вернула идентификатор созданной заявки.");
  }
  return { requestId };
}
