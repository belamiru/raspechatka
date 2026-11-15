import { YandexDeliveryStatus } from "@/components/yandex-delivery-status";

export type AdminFulfillmentProps = {
  orderId: string;
  orderStatus: string;
  method: string;
  pickupPointId: string | null;
  pickupPointAddress: string | null;
  pickupPointType: string | null;
  deliveryPrice: number | null;
  yandexDeliveryStatus: string | null;
  yandexDeliveryRequestId: string | null;
  yandexDeliveryError: string | null;
};

export function AdminFulfillment({ orderId, orderStatus, method, pickupPointId, pickupPointAddress, pickupPointType, deliveryPrice, yandexDeliveryStatus, yandexDeliveryRequestId, yandexDeliveryError }: AdminFulfillmentProps) {
  // The initial order is created with a placeholder "pickup" before checkout.
  if (orderStatus === "awaiting_checkout") {
    return <p className="mt-2 text-sm text-slate-700">Способ получения ещё не подтверждён</p>;
  }

  if (method === "pickup") {
    return <p className="mt-2 text-sm text-slate-700">Самовывоз · бесплатно</p>;
  }

  if (method !== "yandex_pickup_point" && method !== "ozon_pickup_point") {
    return <p className="mt-2 text-sm text-amber-700">Неизвестный способ получения: {method || "не указан"}</p>;
  }

  const isOzon = method === "ozon_pickup_point";
  const pointLabel = pickupPointType === "terminal" || pickupPointType === "ozon_postamat" ? "Постамат" : "ПВЗ";
  return (
    <div className="mt-2 text-sm leading-6 text-slate-700">
      <p className="font-semibold">Доставка в ПВЗ {isOzon ? "Ozon" : "Яндекс Доставки"}</p>
      <p>{pickupPointAddress ?? "Пункт ещё не выбран"}</p>
      {pickupPointType && <p>{pointLabel}{pickupPointId ? ` · ID: ${pickupPointId}` : ""}</p>}
      {!pickupPointType && pickupPointId && <p>ID: {pickupPointId}</p>}
      <p>{deliveryPrice === null ? "Стоимость доставки уточняется" : `Доставка: ${deliveryPrice} ₽`}</p>
      {!isOzon && <YandexDeliveryStatus orderId={orderId} orderStatus={orderStatus} status={yandexDeliveryStatus} requestId={yandexDeliveryRequestId} error={yandexDeliveryError} />}
    </div>
  );
}
