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
const DEFAULT_CENTER: [number, number] = [55.7558, 37.6176];

type YandexPlacemark = {
  events: { add: (event: string, handler: () => void) => void };
};

type YandexMap = {
  geoObjects: {
    removeAll: () => void;
    add: (object: unknown) => void;
    getBounds: () => unknown;
  };
  setBounds: (bounds: unknown, options?: unknown) => void;
  setCenter: (center: [number, number], zoom?: number) => void;
  destroy: () => void;
};

type YandexNamespace = {
  ready: (callback: () => void) => void;
  Map: new (element: HTMLElement, options: unknown) => YandexMap;
  Placemark: new (position: [number, number], properties?: unknown, options?: unknown) => YandexPlacemark;
};

declare global {
  interface Window { ymaps?: YandexNamespace }
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

  // Создаём карту, только когда видима вкладка «На карте» и контейнер уже в DOM.
  useEffect(() => {
    if (view !== "map" || mapRef.current || !containerRef.current) return;
    let cancelled = false;
    void loadYandexMaps()
      .then((ymaps) => {
        if (cancelled || !containerRef.current || mapRef.current) return;
        yandexRef.current = ymaps;
        mapRef.current = new ymaps.Map(containerRef.current, {
          center: DEFAULT_CENTER,
          zoom: 9,
          controls: ["zoomControl", "geolocationControl"],
        });
        setMapError("");
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
  }, [view]);

  useEffect(() => () => {
    mapRef.current?.destroy();
    mapRef.current = null;
  }, []);

  // Перерисовываем метки при смене найденных пунктов или выбора.
  useEffect(() => {
    const ymaps = yandexRef.current;
    const map = mapRef.current;
    if (view !== "map" || !ymaps || !map) return;
    map.geoObjects.removeAll();
    for (const point of mapped) {
      const active = selected?.id === point.id;
      const placemark = new ymaps.Placemark(
        [point.latitude as number, point.longitude as number],
        { hintContent: point.name, balloonContent: `${point.name}<br>${point.address}` },
        { preset: active ? "islands#darkBlueIcon" : "islands#blueIcon" },
      );
      placemark.events.add("click", () => onSelectRef.current(point));
      map.geoObjects.add(placemark);
    }
    if (mapped.length === 1) {
      map.setCenter([mapped[0].latitude as number, mapped[0].longitude as number], 15);
    } else if (mapped.length > 1) {
      map.setBounds(map.geoObjects.getBounds(), { checkZoomRange: true, zoomMargin: 40 });
    }
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
