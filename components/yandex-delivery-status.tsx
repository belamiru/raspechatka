"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STATUS_TEXT: Record<string, string> = {
  created: "Заявка создана в Яндекс Доставке",
  creating: "Заявка создаётся…",
  failed: "Заявка не создана",
};

/** Оплата подтверждена, но заявки в Яндексе ещё нет: её можно создать вручную. */
const RETRYABLE_ORDER_STATUSES = ["paid", "in_progress", "ready"];

/**
 * Статус заявки Яндекс Доставки в карточке заказа.
 * Раньше результат создания хранился только в базе, и ошибки вроде
 * «Merchant not found» никто не видел.
 */
export function YandexDeliveryStatus({ orderId, orderStatus, status, requestId, error }: {
  orderId: string;
  orderStatus: string;
  status: string | null;
  requestId: string | null;
  error: string | null;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [retryError, setRetryError] = useState("");

  const canRetry = !requestId && status !== "creating" && RETRYABLE_ORDER_STATUSES.includes(orderStatus);

  const retry = async () => {
    setBusy(true);
    setRetryError("");
    try {
      const response = await fetch("/api/admin/yandex-delivery/retry", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json().catch(() => ({})) as { error?: string };
      if (!response.ok) throw new Error(result.error ?? "Не удалось создать заявку.");
      router.refresh();
    } catch (cause) {
      setRetryError(cause instanceof Error ? cause.message : "Не удалось создать заявку.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  if (!status && !canRetry) return null;

  return <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2">
    <p className={status === "failed" ? "font-semibold text-red-700" : status === "created" ? "font-semibold text-emerald-700" : "font-semibold"}>
      {status ? STATUS_TEXT[status] ?? status : "Заявка ещё не создавалась"}
    </p>
    {requestId && <p className="break-all font-mono text-xs">Номер заявки: {requestId}</p>}
    {status === "failed" && error && <p className="mt-1 whitespace-pre-wrap break-words text-xs text-red-700">{error}</p>}
    {canRetry && <button type="button" onClick={retry} disabled={busy}
      className="mt-2 rounded-lg bg-slate-900 px-3 py-1 text-xs font-semibold text-white disabled:opacity-50">
      {busy ? "Создаём заявку…" : status === "failed" ? "Создать заявку повторно" : "Создать заявку"}
    </button>}
    {retryError && <p role="alert" className="mt-1 whitespace-pre-wrap break-words text-xs text-red-700">{retryError}</p>}
  </div>;
}
