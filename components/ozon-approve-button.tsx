"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Подтверждение отправления к отгрузке из админки.
 *
 * Автоматический шаг уже вызывается после создания заказа, но его можно
 * повторить вручную — например, если на балансе Ozon не хватало средств.
 */
export function OzonApproveButton({ orderId, status }: { orderId: string; status: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  const applicable = status === "created" || status === "approve_failed" || status === "approve_expired";

  if (!applicable && !done) {
    return <span className="text-slate-500">
      {status === "approved" ? "Подтверждён к отгрузке" : "Подтверждение недоступно"}
    </span>;
  }

  const approve = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/ozon-delivery/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      const result = await response.json() as { approved?: boolean; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Не удалось подтвердить отправление.");
      setDone(true);
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось подтвердить отправление.");
    } finally {
      setBusy(false);
    }
  };

  return <div className="mt-3">
    <button type="button" onClick={approve} disabled={busy}
      className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
      {busy ? "Подтверждаем…" : "Подтвердить к отгрузке"}
    </button>
    {error && <p role="alert" className="mt-2 whitespace-pre-wrap break-words text-red-700">{error}</p>}
  </div>;
}
