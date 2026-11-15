import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminFulfillment, type AdminFulfillmentProps } from "../components/admin-fulfillment";

const base: AdminFulfillmentProps = {
  orderId: "1", orderStatus: "paid", method: "ozon_pickup_point",
  pickupPointId: "123", pickupPointAddress: "Тестовый адрес", pickupPointType: "ozon_postamat",
  deliveryPrice: 150, yandexDeliveryStatus: null, yandexDeliveryRequestId: null, yandexDeliveryError: null,
};
const render = (changes: Partial<AdminFulfillmentProps>) => renderToStaticMarkup(<AdminFulfillment {...base} {...changes} />);
const ozon = render({});
assert.match(ozon, /Доставка в ПВЗ Ozon/);
assert.match(ozon, /Тестовый адрес/);
assert.match(ozon, /Постамат/);
assert.match(ozon, /ID: 123/);
assert.match(ozon, /Доставка: 150 ₽/);
assert.doesNotMatch(ozon, /Самовывоз/);
assert.match(render({ deliveryPrice: 0 }), /Доставка: 0 ₽/);
assert.match(render({ deliveryPrice: null }), /Стоимость доставки уточняется/);
assert.match(render({ method: "pickup" }), /Самовывоз/);
assert.match(render({ method: "other" }), /Неизвестный способ получения: other/);
assert.doesNotMatch(render({ method: "other" }), /Самовывоз/);
assert.match(render({ method: "pickup", orderStatus: "awaiting_checkout" }), /не подтверждён/);
console.log("admin fulfillment rendering: OK");
