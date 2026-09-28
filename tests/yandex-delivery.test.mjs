import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScript } from "./load-typescript.mjs";

const order = {
  orderNumber: "12345", pickupPointId: "0123456789abcdef0123456789abcdef", printPriceRubles: 350,
  recipient: { name: "Тест Получатель", phone: "+79990000000", email: null },
  package: { weightGrams: 500, widthMm: 210, lengthMm: 297, heightMm: 20 },
};

function setup(merchantId, response = Response.json({ request_id: "delivery-123" })) {
  const calls = [];
  const api = loadTypeScript("lib/yandex-delivery.ts", {
    env: { YANDEX_DELIVERY_API_TOKEN: "test-token", YANDEX_DELIVERY_MERCHANT_ID: merchantId },
    globals: { fetch: async (url, options) => { calls.push({ url, options }); return response; } },
  });
  return { ...api, calls };
}

for (const merchantId of [undefined, "", "   "]) {
  test(`direct sender creates a prepaid shipment without merchant_id (${JSON.stringify(merchantId)})`, async () => {
    const api = setup(merchantId);
    const result = await api.createYandexPickupDelivery(order);
    assert.equal(result.requestId, "delivery-123");
    assert.equal(api.calls.length, 1);
    const { url, options } = api.calls[0];
    assert.equal(url, "https://b2b-authproxy.taxi.yandex.net/api/b2b/platform/request/create");
    assert.equal(options.headers.Authorization, "Bearer test-token");
    const body = JSON.parse(options.body);
    assert.equal(Object.hasOwn(body.info, "merchant_id"), false);
    assert.equal(body.info.operator_request_id, "print-12345");
    assert.equal(body.destination.platform_station.platform_id, order.pickupPointId);
    assert.equal(body.billing_info.payment_method, "already_paid");
    assert.equal(body.billing_info.delivery_cost, 0);
    assert.equal(body.items[0].billing_details.unit_price, 35000);
    assert.equal(body.places[0].physical_dims.weight_gross, 500);
  });
}

test("registered merchant ID is still sent when configured", async () => {
  const api = setup(" merchant-123 ");
  await api.createYandexPickupDelivery(order);
  assert.equal(JSON.parse(api.calls[0].options.body).info.merchant_id, "merchant-123");
});

test("Yandex rejection includes HTTP status and provider explanation", async () => {
  const api = setup(undefined, Response.json({ message: "No delivery options for interval" }, { status: 400 }));
  await assert.rejects(api.createYandexPickupDelivery(order), /HTTP 400.*No delivery options for interval/);
});

test("non-JSON gateway error remains diagnosable", async () => {
  const api = setup(undefined, new Response("<html>Bad Gateway</html>", { status: 502 }));
  await assert.rejects(api.createYandexPickupDelivery(order), /HTTP 502/);
});

test("invalid parcel does not create a shipment", async () => {
  const api = setup();
  await assert.rejects(api.createYandexPickupDelivery({ ...order, package: { ...order.package, weightGrams: 0 } }));
  assert.equal(api.calls.length, 0);
});

test("successful HTTP response without shipment ID is not considered creation", async () => {
  const api = setup(undefined, Response.json({}));
  await assert.rejects(api.createYandexPickupDelivery(order), /не вернула идентификатор/);
});
