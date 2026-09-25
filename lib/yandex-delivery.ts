const YANDEX_DELIVERY_API = "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/pricing-calculator";
export const YANDEX_DELIVERY_SOURCE_PLATFORM_STATION_ID = "019e06631c07764c8cf4bc2ede9c2284";

type Package = { weightGrams: number; widthMm: number; lengthMm: number; heightMm: number };

function toCentimeters(mm: number) { return Math.max(1, Math.ceil(mm / 10)); }

function parseRublesToKopecks(value: unknown) {
  const match = typeof value === "string" ? value.match(/^\s*(\d+)(?:[.,](\d{1,2}))?\s*RUB\s*$/i) : null;
  if (!match) return null;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0") || "0");
}

export async function calculateYandexPickupDelivery({ pickupPointId, printPriceRubles, package: parcel }: {
  pickupPointId: string; printPriceRubles: number; package: Package;
}) {
  const token = process.env.YANDEX_DELIVERY_API_TOKEN?.trim();
  if (!token) throw new Error("Не настроен API Яндекс Доставки.");
  if (!/^[a-zA-Z0-9-]{16,120}$/.test(pickupPointId)) throw new Error("Некорректный пункт выдачи.");
  if (![parcel.weightGrams, parcel.widthMm, parcel.lengthMm, parcel.heightMm].every(Number.isSafeInteger)
    || parcel.weightGrams < 1 || parcel.widthMm < 1 || parcel.lengthMm < 1 || parcel.heightMm < 1) {
    throw new Error("Для расчёта доставки нужны вес и габариты заказа.");
  }
  const response = await fetch(YANDEX_DELIVERY_API, {
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
        weight_gross: parcel.weightGrams,
        dx: toCentimeters(parcel.widthMm),
        dy: toCentimeters(parcel.lengthMm),
        dz: toCentimeters(parcel.heightMm),
      } }],
    }),
    cache: "no-store",
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
