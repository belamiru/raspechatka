"use client";

import { useEffect, useState } from "react";

type Status = { count?: number; syncedAt?: string | null; refreshing?: boolean; error?: string };

function formatDate(value: string | null | undefined) {
  if (!value) return "никогда";
  return new Date(value).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

/**
 * Каталог пунктов выдачи хранится в базе и обновляется в фоне раз в 12 часов.
 * Здесь его можно перечитать принудительно — например, сразу после подключения
 * договора, чтобы новые ПВЗ появились не через сутки.
 */
export function OzonPointsCatalogPanel() {
  const [status, setStatus] = useState<Status>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    void fetch("/api/admin/ozon-delivery/points-sync")
      .then(async (response) => {
        const result = await response.json() as Status;
        if (!response.ok) throw new Error(result.error ?? "Не удалось прочитать каталог.");
        setStatus(result);
        setError("");
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Не удалось прочитать каталог."));
  };

  useEffect(load, []);

  const refresh = async () => {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/admin/ozon-delivery/points-sync", { method: "POST" });
      const result = await response.json() as { count?: number; error?: string };
      if (!response.ok) throw new Error(result.error ?? "Не удалось обновить каталог.");
      load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось обновить каталог.");
    } finally {
      setBusy(false);
    }
  };

  return <section className="mt-5 rounded-xl border border-slate-200 p-5">
    <h2 className="text-lg font-bold">Пункты выдачи</h2>
    <p className="mt-2 text-sm text-slate-600">
      Каталог Ozon хранится в базе и обновляется в фоне раз в 12 часов.
    </p>
    <ul className="mt-3 space-y-1 text-sm">
      <li>Пунктов в каталоге: <strong>{(status.count ?? 0).toLocaleString("ru-RU")}</strong></li>
      <li>Обновлён: <strong>{formatDate(status.syncedAt)}</strong></li>
    </ul>
    <button type="button" onClick={refresh} disabled={busy}
      className="mt-3 rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
      {busy ? "Обновляем каталог…" : "Обновить каталог сейчас"}
    </button>
    {busy && <p className="mt-2 text-sm text-slate-600">
      Полная выгрузка занимает несколько минут: Ozon отдаёт пункты порциями по 100.
    </p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </section>;
}
