/*
 * Условия бесплатной доставки.
 *
 * Порог общий для браузера и сервера: страница заказа показывает прогресс,
 * а /api/orders обнуляет стоимость доставки. Если правило лежит в одном месте,
 * покупатель никогда не увидит одну сумму, а заплатит другую.
 */

/* Сумма печати, начиная с которой доставка бесплатная. */
export const FREE_DELIVERY_THRESHOLD = 1500;

export type DeliveryProgress = {
  threshold: number;
  /* Стоимость печати без доставки. */
  printPrice: number;
  /* Сколько рублей осталось до бесплатной доставки. */
  remaining: number;
  /* Заполнение шкалы в процентах, 0–100. */
  percent: number;
  isFree: boolean;
};

/** Прогресс до бесплатной доставки для шкалы на странице заказа. */
export function getDeliveryProgress(printPrice: number): DeliveryProgress {
  const safePrice = Math.max(0, Math.round(printPrice));

  return {
    threshold: FREE_DELIVERY_THRESHOLD,
    printPrice: safePrice,
    remaining: Math.max(0, FREE_DELIVERY_THRESHOLD - safePrice),
    percent: Math.min(100, Math.round((safePrice / FREE_DELIVERY_THRESHOLD) * 100)),
    isFree: safePrice >= FREE_DELIVERY_THRESHOLD,
  };
}

/**
 * Стоимость доставки с учётом порога. Применяется и к Яндекс Доставке,
 * и к Ozon: правило одно на все способы.
 */
export function applyFreeDelivery(deliveryPrice: number, printPrice: number) {
  if (printPrice >= FREE_DELIVERY_THRESHOLD) {
    return 0;
  }

  return Math.max(0, deliveryPrice);
}

/** Понятная подпись для итогов: «бесплатно» вместо «0 ₽». */
export function formatDeliveryPrice(deliveryPrice: number) {
  return deliveryPrice === 0 ? "бесплатно" : `${deliveryPrice.toLocaleString("ru-RU")} ₽`;
}
