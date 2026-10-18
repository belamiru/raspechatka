"use client";

import { useCallback, useEffect, useRef, useState } from "react";

export type OzonPickupPoint = {
  id: string;
  name: string;
  address: string;
  type: "ozon_pvz" | "ozon_postamat";
};

export function OzonPickupPicker({ selected, onSelect }: {
  selected: OzonPickupPoint | null;
  onSelect: (point: OzonPickupPoint | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState<OzonPickupPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const latestRequest = useRef(0);

  const load = useCallback((search: string) => {
    const requestNumber = latestRequest.current + 1;
    latestRequest.current = requestNumber;
    setLoading(true);
    setError("");
    void fetch(`/api/ozon-delivery/points?query=${encodeURIComponent(search)}`)
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok) throw new Error(result.error ?? "Не удалось загрузить пункты выдачи Ozon.");
        if (latestRequest.current === requestNumber) setPoints(result.points ?? []);
      })
      .catch((cause) => {
        if (latestRequest.current !== requestNumber) return;
        setPoints([]);
        setError(cause instanceof Error ? cause.message : "Не удалось загрузить пункты выдачи Ozon.");
      })
      .finally(() => { if (latestRequest.current === requestNumber) setLoading(false); });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(query), query ? 400 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  return <div className="mt-3">
    <label className="block text-sm font-semibold">Поиск пункта Ozon по адресу или названию
      <input value={query} maxLength={120} placeholder="Воронеж, Ленина"
        onChange={(event) => setQuery(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
    </label>
    {loading && <p className="mt-2 text-sm text-slate-600">Загружаем пункты выдачи…</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {!loading && !error && points.length === 0 && <p className="mt-2 text-sm text-slate-600">Пункты не найдены. Уточните запрос.</p>}
    {points.length > 0 && <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
      {points.map((point) => {
        const active = selected?.id === point.id;
        return <li key={point.id}>
          <button type="button" onClick={() => onSelect(active ? null : point)}
            aria-pressed={active}
            className={`w-full rounded-xl border px-4 py-3 text-left text-sm ${active ? "border-blue-700 bg-blue-50" : "border-slate-200"}`}>
            <span className="block font-semibold">{point.name}</span>
            <span className="block text-slate-600">{point.address}</span>
            <span className="block text-slate-500">{point.type === "ozon_postamat" ? "Постамат Ozon" : "Пункт выдачи Ozon"}</span>
          </button>
        </li>;
      })}
    </ul>}
  </div>;
}
