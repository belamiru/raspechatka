"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type OzonPickupPoint = {
  id: string;
  name: string;
  address: string;
  type: "ozon_pvz" | "ozon_postamat";
  latitude: number | null;
  longitude: number | null;
};

type PointsResponse = { points?: OzonPickupPoint[]; total?: number; matched?: number; error?: string };

// Leaflet + OpenStreetMap need no API key, so the map works with the keys we already have.
const LEAFLET_CSS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
const LEAFLET_JS = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
const MOSCOW: [number, number] = [55.7558, 37.6176];

type LeafletMap = {
  setView: (center: [number, number], zoom: number) => LeafletMap;
  removeLayer: (layer: unknown) => void;
  fitBounds: (bounds: unknown, options?: unknown) => void;
  remove: () => void;
};
type LeafletNamespace = {
  map: (element: HTMLElement, options?: unknown) => LeafletMap;
  tileLayer: (url: string, options?: unknown) => { addTo: (map: LeafletMap) => unknown };
  marker: (position: [number, number], options?: unknown) => {
    addTo: (map: LeafletMap) => { bindPopup: (html: string) => unknown; on: (event: string, handler: () => void) => unknown };
  };
  layerGroup: () => { addTo: (map: LeafletMap) => unknown; clearLayers: () => void; addLayer: (layer: unknown) => void };
  latLngBounds: (positions: [number, number][]) => unknown;
  divIcon: (options: unknown) => unknown;
};

declare global {
  interface Window { L?: LeafletNamespace }
}

function loadLeaflet() {
  return new Promise<LeafletNamespace>((resolve, reject) => {
    if (window.L) { resolve(window.L); return; }
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const css = document.createElement("link");
      css.rel = "stylesheet";
      css.href = LEAFLET_CSS;
      document.head.appendChild(css);
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${LEAFLET_JS}"]`);
    const script = existing ?? document.createElement("script");
    const onReady = () => (window.L ? resolve(window.L) : reject(new Error("Не удалось загрузить карту.")));
    script.addEventListener("load", onReady);
    script.addEventListener("error", () => reject(new Error("Не удалось загрузить карту.")));
    if (!existing) {
      script.src = LEAFLET_JS;
      script.async = true;
      document.body.appendChild(script);
    } else if (window.L) {
      onReady();
    }
  });
}

function markerIcon(L: LeafletNamespace, active: boolean) {
  const color = active ? "#1d4ed8" : "#005bff";
  const size = active ? 34 : 26;
  return L.divIcon({
    className: "",
    iconSize: [size, size],
    iconAnchor: [size / 2, size],
    html: `<div style="width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.4)"></div>`,
  });
}

export function OzonPickupPicker({ selected, onSelect }: {
  selected: OzonPickupPoint | null;
  onSelect: (point: OzonPickupPoint | null) => void;
}) {
  const [query, setQuery] = useState("");
  const [points, setPoints] = useState<OzonPickupPoint[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mapError, setMapError] = useState("");
  const [view, setView] = useState<"map" | "list">("map");
  const latestRequest = useRef(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const layerRef = useRef<ReturnType<LeafletNamespace["layerGroup"]> | null>(null);
  const leafletRef = useRef<LeafletNamespace | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const load = useCallback((search: string) => {
    const requestNumber = latestRequest.current + 1;
    latestRequest.current = requestNumber;
    setLoading(true);
    setError("");
    void fetch(`/api/ozon-delivery/points?query=${encodeURIComponent(search)}`)
      .then(async (response) => {
        const result = await response.json() as PointsResponse;
        if (!response.ok) throw new Error(result.error ?? "Не удалось загрузить пункты выдачи Ozon.");
        if (latestRequest.current !== requestNumber) return;
        setPoints(result.points ?? []);
        setTotal(typeof result.total === "number" ? result.total : null);
      })
      .catch((cause) => {
        if (latestRequest.current !== requestNumber) return;
        setPoints([]);
        setTotal(null);
        setError(cause instanceof Error ? cause.message : "Не удалось загрузить пункты выдачи Ozon.");
      })
      .finally(() => { if (latestRequest.current === requestNumber) setLoading(false); });
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => load(query), query ? 400 : 0);
    return () => clearTimeout(timer);
  }, [load, query]);

  const mapped = useMemo(
    () => points.filter((point) => point.latitude !== null && point.longitude !== null),
    [points],
  );

  // Create the map once, only while the map tab is visible.
  useEffect(() => {
    if (view !== "map" || mapRef.current || !containerRef.current) return;
    let cancelled = false;
    void loadLeaflet()
      .then((L) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        leafletRef.current = L;
        const map = L.map(containerRef.current, { scrollWheelZoom: true }).setView(MOSCOW, 9);
        L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
          attribution: "© OpenStreetMap", maxZoom: 19,
        }).addTo(map);
        layerRef.current = L.layerGroup();
        layerRef.current.addTo(map);
        mapRef.current = map;
        setMapError("");
      })
      .catch(() => { if (!cancelled) setMapError("Карта недоступна — выберите пункт из списка."); });
    return () => { cancelled = true; };
  }, [view]);

  useEffect(() => () => { mapRef.current?.remove(); mapRef.current = null; }, []);

  // Redraw markers whenever the visible points or the selection change.
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    const layer = layerRef.current;
    if (view !== "map" || !L || !map || !layer) return;
    layer.clearLayers();
    const positions: [number, number][] = [];
    for (const point of mapped) {
      const position: [number, number] = [point.latitude!, point.longitude!];
      positions.push(position);
      const marker = L.marker(position, { icon: markerIcon(L, selected?.id === point.id) }).addTo(map);
      marker.bindPopup(
        `<b>${point.name.replace(/</g, "&lt;")}</b><br>${point.address.replace(/</g, "&lt;")}`,
      );
      marker.on("click", () => onSelectRef.current(point));
      layer.addLayer(marker as unknown);
    }
    if (positions.length === 1) map.setView(positions[0], 14);
    else if (positions.length > 1) map.fitBounds(L.latLngBounds(positions), { padding: [30, 30] });
  }, [mapped, selected, view]);

  const emptyMessage = total === 0
    ? "Ozon не вернул ни одного пункта выдачи для вашего договора. Проверьте метод доставки в админке."
    : "Пункты не найдены. Уточните запрос.";

  return <div className="mt-3">
    <label className="block text-sm font-semibold">Поиск пункта Ozon по адресу или названию
      <input value={query} maxLength={120} placeholder="Воронеж, Ленина"
        onChange={(event) => setQuery(event.target.value)}
        className="mt-2 w-full rounded-xl border border-slate-300 px-4 py-3" />
    </label>

    <div className="mt-3 flex gap-2">
      <button type="button" onClick={() => setView("map")}
        className={`rounded-lg border px-3 py-1.5 text-sm ${view === "map" ? "border-blue-700 bg-blue-50 font-semibold text-blue-700" : "border-slate-200"}`}>
        На карте
      </button>
      <button type="button" onClick={() => setView("list")}
        className={`rounded-lg border px-3 py-1.5 text-sm ${view === "list" ? "border-blue-700 bg-blue-50 font-semibold text-blue-700" : "border-slate-200"}`}>
        Списком
      </button>
    </div>

    {loading && <p className="mt-2 text-sm text-slate-600">Загружаем пункты выдачи…</p>}
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
    {!loading && !error && points.length === 0 && <p className="mt-2 text-sm text-slate-600">{emptyMessage}</p>}

    {view === "map" && <>
      {mapError && <p role="alert" className="mt-2 text-sm text-red-700">{mapError}</p>}
      <div ref={containerRef} className="mt-3 h-80 w-full overflow-hidden rounded-xl border border-slate-200" />
      {!loading && !error && points.length > 0 && mapped.length === 0 &&
        <p className="mt-2 text-sm text-slate-600">У найденных пунктов нет координат — выберите пункт списком.</p>}
      {mapped.length > 0 && <p className="mt-2 text-xs text-slate-500">Нажмите на метку, чтобы выбрать пункт выдачи.</p>}
    </>}

    {view === "list" && points.length > 0 && <ul className="mt-3 max-h-72 space-y-2 overflow-y-auto">
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

    {selected && <p className="mt-3 rounded-xl bg-blue-50 px-4 py-3 text-sm">
      Выбран пункт: <b>{selected.address}</b>
      <button type="button" onClick={() => onSelect(null)} className="ml-2 text-blue-700 underline">сбросить</button>
    </p>}
  </div>;
}
