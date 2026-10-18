"use client";

import { useState } from "react";

export function OzonDeliveryConnectionCheck({ configured }: { configured: boolean }) {
  const [state, setState] = useState<"idle" | "checking" | "success" | "error">("idle");
  const [message, setMessage] = useState("");

  async function checkConnection() {
    setState("checking");
    setMessage("");
    try {
      const response = await fetch("/api/admin/ozon-delivery/check", { method: "POST" });
      const result = await response.json().catch(() => null) as { success?: boolean; error?: string } | null;
      if (!response.ok || !result?.success) throw new Error(result?.error ?? "Не удалось проверить подключение.");
      setState("success");
      setMessage("Доступ к Ozon Delivery API подтверждён. Теперь можно настроить пункт отгрузки и метод доставки.");
    } catch (cause) {
      setState("error");
      setMessage(cause instanceof Error ? cause.message : "Не удалось проверить подключение.");
    }
  }

  return <section className="mt-5 rounded-xl border border-slate-200 p-5">
    <h2 className="text-lg font-bold">Проверка подключения</h2>
    <p className="mt-2 text-sm text-slate-600">
      Сервер получит временный токен по новым данным приложения Ozon Delivery. Никакое отправление или заказ не создаётся.
    </p>
    {!configured && <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">
      Добавьте <code>OZON_DELIVERY_CLIENT_ID</code> и <code>OZON_DELIVERY_CLIENT_SECRET</code> в Environment Variables ONREZA, затем перезапустите деплой.
    </p>}
    <button type="button" onClick={checkConnection} disabled={!configured || state === "checking"}
      className="mt-4 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-400">
      {state === "checking" ? "Проверяем…" : "Проверить доступ к Ozon Delivery"}
    </button>
    {message && <p role="status" className={`mt-3 rounded-lg p-3 text-sm ${state === "success" ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>{message}</p>}
  </section>;
}
