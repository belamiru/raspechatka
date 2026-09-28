import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScript } from "./load-typescript.mjs";

function setup({ admin = true, deliveryRequestId = "delivery-123", creationError, orderExists = true } = {}) {
  const claims = [];
  const queries = [];
  const { POST } = loadTypeScript("app/api/admin/orders/[id]/yandex-delivery/route.ts", {
    imports: {
      "next/headers": { cookies: async () => ({ get: () => ({ value: "session" }) }) },
      "next/server": { NextResponse: { json: Response.json } },
      "@/lib/auth": { getAdminCookieName: () => "admin", isAdminSession: async () => admin },
      "@/lib/db": { getDb: () => ({ query: async (sql, values) => {
        queries.push({ sql, values });
        return { rows: orderExists ? [{ yandex_delivery_request_id: deliveryRequestId }] : [] };
      } }) },
      "@/lib/order-checkout": { ensureOrderCheckoutSchema: async () => {} },
      "@/lib/security": { getRequestId: () => "request-123", logAppError: async () => {} },
      "@/lib/yandex-order-sync": { createYandexDeliveryForPaidOrder: async (id) => {
        claims.push(id);
        if (creationError) throw new Error(creationError);
        return Boolean(deliveryRequestId);
      } },
    },
  });
  return {
    claims, queries,
    post: (headers = {}, id = "123") => POST(new Request(`https://example.test/api/admin/orders/${id}/yandex-delivery`, {
      method: "POST", headers,
    }), { params: Promise.resolve({ id }) }),
  };
}

test("only an authenticated admin can request a retry", async () => {
  const api = setup({ admin: false });
  assert.equal((await api.post()).status, 401);
  assert.equal(api.claims.length, 0);
  assert.equal(api.queries.length, 0);
});

for (const headers of [{ "sec-fetch-site": "cross-site" }, { origin: "https://other.test" }]) {
  test(`cross-site retry is rejected (${JSON.stringify(headers)})`, async () => {
    const api = setup();
    assert.equal((await api.post(headers)).status, 403);
    assert.equal(api.claims.length, 0);
  });
}

test("invalid order ID never reaches the creation service", async () => {
  const api = setup();
  assert.equal((await api.post({}, "-1")).status, 400);
  assert.equal(api.claims.length, 0);
});

test("same-origin browser request works behind a reverse proxy", async () => {
  const api = setup();
  const response = await api.post({ "sec-fetch-site": "same-origin", origin: "https://public.example.test" });
  assert.equal(response.status, 200);
});

test("retry uses the shared claim and returns the persisted shipment ID", async () => {
  const api = setup();
  const response = await api.post({ origin: "https://example.test" });
  assert.equal(response.status, 200);
  assert.deepEqual(api.claims, ["123"]);
  assert.equal((await response.json()).deliveryRequestId, "delivery-123");
  assert.equal(response.headers.get("cache-control"), "no-store");
});

test("unclaimed order without a shipment is not reported as delivered", async () => {
  const api = setup({ deliveryRequestId: null });
  assert.equal((await api.post()).status, 409);
});

test("missing order returns 404", async () => {
  assert.equal((await setup({ orderExists: false }).post()).status, 404);
});

test("admin sees the delivery error and diagnostic request ID", async () => {
  const api = setup({ creationError: "Яндекс Доставка не создала заявку (HTTP 403)." });
  const response = await api.post();
  assert.equal(response.status, 502);
  const result = await response.json();
  assert.match(result.error, /HTTP 403/);
  assert.equal(result.requestId, "request-123");
});
