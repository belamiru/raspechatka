import { createHash, timingSafeEqual } from "node:crypto";

const DEFAULT_API_BASE_URL = "https://securepay.tinkoff.ru/v2";

type Scalar = string | number | boolean;
type TbankPayload = Record<string, unknown>;

type TbankConfig = {
  terminalKey: string;
  password: string;
  apiBaseUrl: string;
};

export type TbankInitResponse = {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  PaymentId?: string;
  PaymentURL?: string;
  Status?: string;
};

export type TbankStateResponse = {
  Success: boolean;
  ErrorCode?: string;
  Message?: string;
  Details?: string;
  TerminalKey?: string;
  PaymentId?: string;
  OrderId?: string;
  Amount?: number;
  Status?: string;
};

function getConfig(): TbankConfig {
  const terminalKey = process.env.TBANK_TERMINAL_KEY?.trim();
  const password = process.env.TBANK_PASSWORD;
  if (!terminalKey || !password) {
    throw new Error("Не заданы TBANK_TERMINAL_KEY или TBANK_PASSWORD.");
  }
  const apiBaseUrl = (process.env.TBANK_API_BASE_URL || DEFAULT_API_BASE_URL).replace(/\/$/, "");
  if (!/^https:\/\//.test(apiBaseUrl)) throw new Error("TBANK_API_BASE_URL должен начинаться с https://.");
  return { terminalKey, password, apiBaseUrl };
}

/** Signature prescribed by T-Bank: root scalar fields + Password, keys sorted, SHA-256. */
export function buildTbankToken(payload: TbankPayload, password: string) {
  const values: Record<string, Scalar> = { Password: password };
  for (const [key, value] of Object.entries(payload)) {
    if (key !== "Token" && (typeof value === "string" || typeof value === "number" || typeof value === "boolean")) {
      values[key] = value;
    }
  }
  const input = Object.keys(values).sort().map((key) => String(values[key])).join("");
  return createHash("sha256").update(input, "utf8").digest("hex");
}

export function isValidTbankToken(payload: TbankPayload) {
  const { password } = getConfig();
  const received = typeof payload.Token === "string" ? payload.Token : "";
  const expected = buildTbankToken(payload, password);
  if (!/^[a-f0-9]{64}$/i.test(received)) return false;
  return timingSafeEqual(Buffer.from(received.toLowerCase()), Buffer.from(expected));
}

async function tbankPost<T>(method: string, payload: TbankPayload): Promise<T> {
  const { terminalKey, password, apiBaseUrl } = getConfig();
  const request = { ...payload, TerminalKey: terminalKey };
  const response = await fetch(`${apiBaseUrl}/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...request, Token: buildTbankToken(request, password) }),
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok || !data || typeof data !== "object") {
    throw new Error(`Т‑Банк временно недоступен (HTTP ${response.status}).`);
  }
  return data as T;
}

export async function initTbankPayment(payload: {
  amountKopecks: number;
  orderId: string;
  description: string;
  notificationUrl: string;
  successUrl: string;
  failUrl: string;
  receipt?: Record<string, unknown>;
}) {
  return tbankPost<TbankInitResponse>("Init", {
    Amount: payload.amountKopecks,
    OrderId: payload.orderId,
    Description: payload.description,
    NotificationURL: payload.notificationUrl,
    SuccessURL: payload.successUrl,
    FailURL: payload.failUrl,
    PayType: "O",
    Language: "ru",
    ...(payload.receipt ? { Receipt: payload.receipt } : {}),
  });
}

export async function getTbankPaymentState(paymentId: string) {
  return tbankPost<TbankStateResponse>("GetState", { PaymentId: paymentId });
}

export function getTbankTerminalKey() {
  return getConfig().terminalKey;
}
