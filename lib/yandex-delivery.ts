const YANDEX_DELIVERY_PRICING_API = "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/pricing-calculator";
const YANDEX_DELIVERY_CREATE_API = "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/request/create";
export const YANDEX_DELIVERY_SOURCE_PLATFORM_STATION_ID = "019e06631c07764c8cf4bc2ede9c2284";

type Package = { weightGrams: number; widthMm: number; lengthMm: number; heightMm: number };

/*
 * Одно грузоместо. Заказ может уехать несколькими местами: плоская стопка
 * и тубусы с плакатами упаковываются отдельно.
 */
export type DeliveryPlace = {
  weightGrams: number;
  widthMm: number;
  lengthMm: number;
  heightMm: number;
};
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
/*
 * Раскладывает сумму в копейках по грузоместам пропорционально весу.
 *
 * Нужно потому, что items должны ссылаться на каждое место через
 * place_barcode. Сумма последнего места добирается до остатка, чтобы
 * итог совпал с оплаченной суммой до копейки.
 */
function distributeKopecks(totalKopecks: number, places: DeliveryPlace[]) {
  if (places.length <= 1) return [totalKopecks];

  const totalWeight = places.reduce(
    (sum, place) => sum + Math.max(1, place.weightGrams),
    0
  );
  let remaining = totalKopecks;

  return places.map((place, index) => {
    if (index === places.length - 1) return remaining;

    const share = Math.floor(
      (totalKopecks * Math.max(1, place.weightGrams)) / totalWeight
    );
    remaining -= share;
    return share;
  });
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

export async function calculateYandexPickupDelivery({ pickupPointId, printPriceRubles, package: parcel, places }: {
  pickupPointId: string; printPriceRubles: number; package: Package;
  /* Все грузоместа: плакаты едут тубусом отдельно от стопки. */
  places?: DeliveryPlace[];
}) {
  const token = getToken();
  if (!validPickupPointId(pickupPointId)) throw new Error("Некорректный пункт выдачи.");
  validatePackage(parcel);

  /*
   * Ценообразование Яндекса учитывает каждое место. Без этого плакат в тубусе
   * считался бы по габаритам стопки документов.
   */
  const pricingPlaces = places && places.length > 0 ? places : [parcel];
  pricingPlaces.forEach(validatePackage);
  const response = await fetch(YANDEX_DELIVERY_PRICING_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Accept-Language": "ru-RU" },
    body: JSON.stringify({
      source: { platform_station_id: YANDEX_DELIVERY_SOURCE_PLATFORM_STATION_ID },
      destination: { platform_station_id: pickupPointId },
      tariff: "self_pickup",
      total_assessed_price: printPriceRubles * 100,
      client_price: 0,
      payment_method: "already_paid",
      places: pricingPlaces.map((place) => ({ physical_dims: {
        weight_gross: place.weightGrams, dx: toCentimeters(place.widthMm),
        dy: toCentimeters(place.lengthMm), dz: toCentimeters(place.heightMm),
      } })),
      total_weight: pricingPlaces.reduce((total, place) => total + place.weightGrams, 0),
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
export async function createYandexPickupDelivery({ orderNumber, pickupPointId, printPriceRubles, recipient, package: parcel, places }: {
  orderNumber: string; pickupPointId: string; printPriceRubles: number; recipient: Recipient; package: Package;
  /* Все грузоместа заказа. Если не переданы — используется одна посылка. */
  places?: DeliveryPlace[];
}) {
  const token = getToken();
  // merchant_id нужен только при отдельных зарегистрированных мерчантах.
  // Без них заказ создаётся от основного договора (подтверждено поддержкой).
  // Неверный ID Яндекс отклоняет с «Merchant not found».
  const merchantId = process.env.YANDEX_DELIVERY_MERCHANT_ID?.trim() || null;
  if (!validPickupPointId(pickupPointId)) throw new Error("Некорректный пункт выдачи.");
  if (!Number.isSafeInteger(printPriceRubles) || printPriceRubles < 0) throw new Error("Некорректная стоимость печати для заявки Яндекс Доставки.");
  validatePackage(parcel);

  /*
   * Яндекс принимает несколько мест в одном заказе: каждое место — отдельный
   * тубус или коробка. Без этого плакаты уехали бы как одна плоская посылка.
   */
  const deliveryPlaces = places && places.length > 0 ? places : [parcel];
  deliveryPlaces.forEach(validatePackage);

  /*
   * Штрихкод грузоместа.
   *
   * Яндекс связывает позицию заказа с грузоместом через place_barcode:
   * значение в items[].place_barcode обязано совпадать с places[].barcode,
   * иначе заявка отклоняется. Раньше оба поля были `print-{номер}` и совпадали
   * сами собой. Когда мест стало несколько, у мест появился суффикс `-1`, `-2`,
   * а у позиции он остался прежним — ссылка перестала находить место,
   * и Яндекс перестал создавать заказы.
   *
   * Одно место оставляем с прежним кодом: так совместимо со старыми заявками
   * и уже напечатанными ярлыками.
   */
  const placeBarcode = (index: number) =>
    (deliveryPlaces.length > 1
      ? `print-${orderNumber}-${index + 1}`
      : `print-${orderNumber}`
    ).slice(0, 100);

  const itemKopecks = distributeKopecks(printPriceRubles * 100, deliveryPlaces);

  const response = await fetch(YANDEX_DELIVERY_CREATE_API, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", "Accept-Language": "ru-RU" },
    body: JSON.stringify({
      info: {
        // Stable merchant-side ID makes repeated T-Bank notifications idempotent in Yandex.
        operator_request_id: `print-${orderNumber}`.slice(0, 50),
        ...(merchantId ? { merchant_id: merchantId } : {}),
        comment: `Оплаченный заказ ${orderNumber}`.slice(0, 500),
      },
      source: { platform_station: { platform_id: YANDEX_DELIVERY_SOURCE_PLATFORM_STATION_ID } },
      destination: { type: "platform_station", platform_station: { platform_id: pickupPointId } },
      last_mile_policy: "self_pickup",
      // The customer has paid both printing and delivery through T-Bank.
      billing_info: { payment_method: "already_paid", delivery_cost: 0 },
      /*
       * По позиции на каждое грузоместо. place_barcode берётся из той же
       * функции, что и barcode места, — рассинхрон этих двух полей и ломал
       * создание заявки.
       */
      items: deliveryPlaces.map((place, index) => ({
        count: 1,
        name: deliveryPlaces.length > 1
          ? `Печатная продукция, заказ ${orderNumber}, место ${index + 1}`.slice(0, 255)
          : `Печать документов, заказ ${orderNumber}`.slice(0, 255),
        article: "document-printing",
        place_barcode: placeBarcode(index),
        physical_dims: {
          dx: toCentimeters(place.widthMm),
          dy: toCentimeters(place.lengthMm),
          dz: toCentimeters(place.heightMm),
        },
        billing_details: {
          unit_price: itemKopecks[index],
          assessed_unit_price: itemKopecks[index],
        },
      })),
      places: deliveryPlaces.map((place, index) => ({
        barcode: placeBarcode(index),
        physical_dims: {
          weight_gross: place.weightGrams,
          dx: toCentimeters(place.widthMm),
          dy: toCentimeters(place.lengthMm),
          dz: toCentimeters(place.heightMm),
        },
      })),
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
