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

/**
 * Яндекс Карты: подробнее, чем OpenStreetMap, и привычнее покупателю.
 * Ключ помечен NEXT_PUBLIC_, поэтому его и должно быть видно в браузере.
 */
const YANDEX_MAPS_KEY = process.env.NEXT_PUBLIC_YANDEX_MAPS_API_KEY ?? "";
const YANDEX_MAPS_JS = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(YANDEX_MAPS_KEY)}&lang=ru_RU`;
// Воронеж — город, где работает типография.
const DEFAULT_CENTER: [number, number] = [51.6608, 39.2003];
const DEFAULT_ZOOM = 12;
const SELECTED_ZOOM = 16;
const MAX_FIT_ZOOM = 16;

type Bounds = [[number, number], [number, number]];

type YandexEvent = { get: (key: string) => unknown };

type YandexObjectManager = {
  add: (collection: unknown) => void;
  removeAll: () => void;
  objects: {
    events: { add: (event: string, handler: (event: YandexEvent) => void) => void };
    setObjectOptions: (id: string, options: unknown) => void;
  };
};

type YandexBounds = { get: (index: number) => [number, number] };

type YandexMap = {
  geoObjects: { add: (object: unknown) => void };
  events: { add: (event: string, handler: () => void) => void };
  setBounds: (bounds: Bounds, options?: unknown) => Promise<unknown>;
  setCenter: (center: [number, number], zoom?: number, options?: unknown) => Promise<unknown>;
  getBounds: () => YandexBounds | null;
  getZoom: () => number;
  setZoom: (zoom: number) => Promise<unknown>;
  container: { fitToViewport: () => void };
  destroy: () => void;
};

type YandexNamespace = {
  ready: (callback: () => void) => void;
  Map: new (element: HTMLElement, options: unknown) => YandexMap;
  ObjectManager: new (options: unknown) => YandexObjectManager;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] as string));
}

/**
 * Границы без выбросов: берём 5–95 перцентили. Иначе один пункт области,
 * попавший в поиск «воронеж», растягивает карту на весь ЦФО.
 */
function robustBounds(points: OzonPickupPoint[]): Bounds | null {
  if (!points.length) return null;
  const lats = points.map((point) => point.latitude as number).sort((a, b) => a - b);
  const lons = points.map((point) => point.longitude as number).sort((a, b) => a - b);
  const pick = (values: number[], share: number) => values[Math.min(values.length - 1, Math.floor(values.length * share))];
  const trim = points.length >= 20;
  return [
    [trim ? pick(lats, 0.05) : lats[0], trim ? pick(lons, 0.05) : lons[0]],
    [trim ? pick(lats, 0.95) : lats[lats.length - 1], trim ? pick(lons, 0.95) : lons[lons.length - 1]],
  ];
}

declare global {
  interface Window { ymaps?: YandexNamespace }
}

type Viewport = { minLat: number; maxLat: number; minLon: number; maxLon: number };

function viewportOf(bounds: YandexBounds | null): Viewport | null {
  if (!bounds) return null;
  try {
    const [[minLat, minLon], [maxLat, maxLon]] = [bounds.get(0), bounds.get(1)];
    if ([minLat, minLon, maxLat, maxLon].every((value) => Number.isFinite(value))) {
      return { minLat, maxLat, minLon, maxLon };
    }
  } catch {
    /* границы недоступны до первой отрисовки */
  }
  return null;
}

function boundsOfViewport(viewport: Viewport): Bounds {
  return [[viewport.minLat, viewport.minLon], [viewport.maxLat, viewport.maxLon]];
}

const MAP_UNAVAILABLE = "Карта недоступна — выберите пункт из списка.";

function loadYandexMaps() {
  return new Promise<YandexNamespace>((resolve, reject) => {
    if (!YANDEX_MAPS_KEY) {
      reject(new Error("Не задан NEXT_PUBLIC_YANDEX_MAPS_API_KEY."));
      return;
    }
    if (window.ymaps) {
      window.ymaps.ready(() => resolve(window.ymaps as YandexNamespace));
      return;
    }
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${YANDEX_MAPS_JS}"]`);
    const script = existing ?? document.createElement("script");
    script.addEventListener("load", () => {
      if (!window.ymaps) {
        reject(new Error("Яндекс Карты загрузились без API."));
        return;
      }
      window.ymaps.ready(() => resolve(window.ymaps as YandexNamespace));
    });
    script.addEventListener("error", () => reject(new Error("Не удалось загрузить Яндекс Карты.")));
    if (!existing) {
      script.src = YANDEX_MAPS_JS;
      script.async = true;
      document.head.appendChild(script);
    }
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
  // Без ключа карта не построится, поэтому по умолчанию сразу показываем список.
  const [view, setView] = useState<"map" | "list">(YANDEX_MAPS_KEY ? "map" : "list");
  const latestRequest = useRef(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<YandexMap | null>(null);
  const yandexRef = useRef<YandexNamespace | null>(null);
  const managerRef = useRef<YandexObjectManager | null>(null);
  const highlightedRef = useRef<string | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [viewport, setViewport] = useState<Viewport | null>(null);
  const viewportRef = useRef<Viewport | null>(null);
  viewportRef.current = viewport;
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const load = useCallback((search: string, area: Viewport | null) => {
    const requestNumber = latestRequest.current + 1;
    latestRequest.current = requestNumber;
    setLoading(true);
    setError("");
    const params = new URLSearchParams({ query: search });
    // Без области (текстовый поиск) сервер отдаёт пункты по всей стране.
    if (area && !search) {
      params.set("minLat", String(area.minLat));
      params.set("maxLat", String(area.maxLat));
      params.set("minLon", String(area.minLon));
      params.set("maxLon", String(area.maxLon));
    }
    void fetch(`/api/ozon-delivery/points?${params.toString()}`)
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

  // Текст ищется с задержкой, область карты — сразу: она меняется редко.
  useEffect(() => {
    const timer = setTimeout(() => load(query, viewport), query ? 400 : 0);
    return () => clearTimeout(timer);
  }, [load, query, viewport]);

  const mapped = useMemo(
    () => points.filter((point) => point.latitude !== null && point.longitude !== null),
    [points],
  );
  const pointsByIdRef = useRef(new Map<string, OzonPickupPoint>());
  pointsByIdRef.current = new Map(mapped.map((point) => [point.id, point]));

  // Создаём карту, только когда видима вкладка «На карте» и контейнер уже в DOM.
  useEffect(() => {
    if (view !== "map" || mapRef.current || !containerRef.current) return;
    let cancelled = false;
    void loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        yandexRef.current = ymaps;
        const map = new ymaps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          controls: ["zoomControl", "geolocationControl"],
        });
        // ObjectManager с кластерами держит тысячи меток без тормозов.
        const manager = new ymaps.ObjectManager({ clusterize: true, gridSize: 64, clusterDisableClickZoom: false });
        manager.objects.events.add("click", (event) => {
          const id = String(event.get("objectId"));
          const point = pointsByIdRef.current.get(id);
          if (point) onSelectRef.current(point);
        });
        map.geoObjects.add(manager);
        mapRef.current = map;
        managerRef.current = manager;
        setMapReady(true);
        setMapError("");
        // Покупатель двигает карту — подгружаем пункты новой области.
        map.events.add("boundschange", () => {
          const next = viewportOf(map.getBounds());
          if (!next) return;
          const previous = viewportRef.current;
          const moved = !previous
            || Math.abs(next.minLat - previous.minLat) > 0.01
            || Math.abs(next.maxLat - previous.maxLat) > 0.01
            || Math.abs(next.minLon - previous.minLon) > 0.01
            || Math.abs(next.maxLon - previous.maxLon) > 0.01;
          if (moved) setViewport(next);
        });
        setViewport(viewportOf(map.getBounds()));
      })
      .catch(() => {
        if (cancelled) return;
        setMapError(MAP_UNAVAILABLE);
        setView("list");
      });
    return () => { cancelled = true; };
  }, [view]);

  // Уничтожаем карту, когда контейнер уходит из разметки: иначе ymaps держит
  // ссылку на удалённый DOM и не даёт создать карту заново при возврате.
  useEffect(() => {
    if (view === "map") return;
    mapRef.current?.destroy();
    mapRef.current = null;
    managerRef.current = null;
    highlightedRef.current = null;
    setMapReady(false);
  }, [view]);

  useEffect(() => () => {
    mapRef.current?.destroy();
    mapRef.current = null;
    managerRef.current = null;
  }, []);

  // Метки и масштаб — только при новом результате поиска. Выбор пункта
  // больше не перерисовывает всё и не отдаляет карту.
  useEffect(() => {
    const map = mapRef.current;
    const manager = managerRef.current;
    if (!mapReady || !map || !manager) return;
    manager.removeAll();
    highlightedRef.current = null;
    manager.add({
      type: "FeatureCollection",
      features: mapped.map((point) => ({
        type: "Feature",
        id: point.id,
        geometry: { type: "Point", coordinates: [point.latitude, point.longitude] },
        properties: {
          hintContent: escapeHtml(point.name),
          balloonContentHeader: escapeHtml(point.name),
          balloonContentBody: escapeHtml(point.address),
        },
        options: { preset: "islands#blueDotIcon" },
      })),
    });
    // Если карта уже показывает свой участок, подгонять её под метки нельзя:
    // это и вызывало отдаление на весь ЦФО.
    if (viewportRef.current) return;
    const bounds = robustBounds(mapped);
    if (!bounds) {
      void map.setCenter(DEFAULT_CENTER, DEFAULT_ZOOM);
    } else if (mapped.length === 1) {
      void map.setCenter([mapped[0].latitude as number, mapped[0].longitude as number], SELECTED_ZOOM);
    } else {
      void map.setBounds(bounds, { checkZoomRange: true, zoomMargin: 24 }).then(() => {
        if (map.getZoom() > MAX_FIT_ZOOM) void map.setZoom(MAX_FIT_ZOOM);
      });
    }
  }, [mapped, mapReady]);

  // Выбор: подсвечиваем метку и приближаемся к ней, остальное не трогаем.
  useEffect(() => {
    const map = mapRef.current;
    const manager = managerRef.current;
    if (!mapReady || !map || !manager) return;
    if (highlightedRef.current && pointsByIdRef.current.has(highlightedRef.current)) {
      manager.objects.setObjectOptions(highlightedRef.current, { preset: "islands#blueDotIcon" });
    }
    highlightedRef.current = null;
    if (!selected || selected.latitude === null || selected.longitude === null) return;
    if (!pointsByIdRef.current.has(selected.id)) return;
    manager.objects.setObjectOptions(selected.id, { preset: "islands#redDotIcon" });
    highlightedRef.current = selected.id;
    void map.setCenter([selected.latitude, selected.longitude], Math.max(map.getZoom(), SELECTED_ZOOM), { duration: 300 });
  }, [selected, mapReady, mapped]);

  const shownMessage = total !== null && points.length > 0
    ? `Показано ${points.length.toLocaleString("ru-RU")} из ${total.toLocaleString("ru-RU")} пунктов Ozon${query ? " по вашему запросу" : " в видимой области карты"}.`
    : "";

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
      <button type="button" onClick={() => setView("map")} disabled={!YANDEX_MAPS_KEY}
        className={`rounded-lg border px-3 py-1.5 text-sm disabled:opacity-50 ${view === "map" ? "border-blue-700 bg-blue-50 font-semibold text-blue-700" : "border-slate-200"}`}>
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
    {!loading && !error && shownMessage && <p className="mt-2 text-xs text-slate-500">{shownMessage}</p>}

    {view === "map" && <>
      {mapError && <p role="alert" className="mt-2 text-sm text-red-700">{mapError}</p>}
      <div ref={containerRef} className="mt-3 h-96 w-full overflow-hidden rounded-xl border border-slate-200" />
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
