import assert from "node:assert/strict";
import * as crypto from "node:crypto";
import test from "node:test";
import { loadTypeScript } from "./load-typescript.mjs";

function setup(appUrl = "https://print.example.test/") {
  const calls = [];
  const api = loadTypeScript("lib/ozon-oauth.ts", {
    env: {
      APP_URL: appUrl, OZON_DELIVERY_CLIENT_ID: "test-client", OZON_DELIVERY_CLIENT_SECRET: "test-secret",
      OZON_DELIVERY_TOKEN_ENCRYPTION_KEY: "test-encryption-key",
    },
    imports: {
      "node:crypto": crypto,
      "@/lib/db": { getDb: () => ({ query: async () => ({ rows: [] }) }) },
    },
    globals: {
      URLSearchParams, Buffer,
      fetch: async (url, options) => {
        calls.push({ url, options });
        return Response.json({ access_token: "test-access", refresh_token: "test-refresh", expires_in: 3600 });
      },
    },
  });
  return { ...api, calls };
}

test("authorization requests the enabled Ozon Logistics scope and a full callback URL", () => {
  const url = new URL(setup().getOzonAuthorizationUrl("test-state"));
  assert.equal(url.searchParams.get("scope"), "seller-api.ozon-logistics");
  assert.equal(url.searchParams.get("redirect_uri"), "https://print.example.test/api/integrations/ozon/callback");
  assert.equal(url.searchParams.get("client_id"), "test-client");
  assert.equal(url.searchParams.get("state"), "test-state");
  assert.equal(url.searchParams.get("response_type"), "code");
  assert.equal(url.searchParams.has("client_secret"), false);
});

test("authorization and code exchange use exactly the same callback", async () => {
  const api = setup();
  const url = new URL(api.getOzonAuthorizationUrl("test-state"));
  await api.saveAuthorizationCode("test-code");
  const fields = api.calls[0].options.body;
  assert.equal(fields.get("redirect_uri"), url.searchParams.get("redirect_uri"));
  assert.equal(fields.get("code"), "test-code");
  assert.equal(fields.get("client_secret"), "test-secret");
});

test("local callback preserves the development port", () => {
  assert.equal(setup("http://localhost:3000").getOzonRedirectUri(), "http://localhost:3000/api/integrations/ozon/callback");
});

for (const appUrl of ["/api/integrations/ozon/callback", "print.example.test", "https://print.example.test/api/integrations/ozon/callback",
  "https://print.example.test/?key=secret", "https://print.example.test/#fragment", "https://user:password@print.example.test/", "ftp://print.example.test/"]) {
  test(`invalid APP_URL is rejected before redirecting to Ozon: ${appUrl}`, () => {
    assert.throws(() => setup(appUrl).getOzonAuthorizationUrl("test-state"), /APP_URL/);
  });
}
