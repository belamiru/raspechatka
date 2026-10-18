"use client";

import { useState } from "react";

type Point = { id: string; title: string; address: string };
type ShipmentMethod = {
  id: string; name: string; phoneNumber: string; dropoffPoint: Point; returnPoint: Point;
  status: string; createdAt: string; updatedAt: string;
};

type PointKind = "dropoff" | "return";

function pointLabel(point: Point) {
  return [point.title, point.address, `ID: ${point.id}`].filter(Boolean).join(" · ");
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    active: "active — метод готов к использованию",
    forming: "forming — Ozon формирует метод",
    inactive: "inactive — метод неактивен",
  };
  return labels[status.toLowerCase()] ?? status;
}

export function OzonShipmentMethodSettings({ initialMethod }: { initialMethod: ShipmentMethod | null }) {
  const [shipmentMethod, setShipmentMethod] = useState(initialMethod);
  const [name, setName] = useState(initialMethod?.name ?? "Распечатка — Ozon");
  const [phoneNumber, setPhoneNumber] = useState(initialMethod?.phoneNumber ?? "+79611909993");
  const [dropoffPoints, setDropoffPoints] = useState<Point[]>([]);
  const [returnPoints, setReturnPoints] = useState<Point[]>([]);
  const [dropoffPoint, setDropoffPoint] = useState<Point | null>(initialMethod?.dropoffPoint ?? null);
  const [returnPoint, setReturnPoint] = useState<Point | null>(initialMethod?.returnPoint ?? null);
  const [loading, setLoading] = useState<"dropoff" | "return" | "create" | "refresh" | null>(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function api(body: Record<string, unknown>) {
    const response = await fetch("/api/admin/ozon-delivery/shipment-method", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
    });
    const result = await response.json().catch(() => null) as { error?: string; points?: Point[]; shipmentMethod?: ShipmentMethod | null } | null;
    if (!response.ok) throw new Error(result?.error ?? "Ozon Delivery API вернул ошибку.");
    return result;
  }

  async function loadPoints(kind: PointKind) {
    setLoading(kind); setError(""); setMessage("");
    try {
      const result = await api({ action: "search-points", kind });
      const points = Array.isArray(result?.points) ? result.points : [];
      if (kind === "dropoff") setDropoffPoints(points);
      else setReturnPoints(points);
      setMessage(points.length ? `Ozon вернул точек: ${points.length}. Выберите одну из списка.` : "Ozon не вернул доступных точек.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось загрузить точки Ozon.");
    } finally { setLoading(null); }
  }

  async function createMethod() {
    if (!dropoffPoint || !returnPoint) { setError("Сначала выберите точку отгрузки и пункт возврата."); return; }
    if (!window.confirm("Создать метод Ozon Delivery? Это действие зарегистрирует постоянный метод отгрузки в кабинете Ozon.")) return;
    setLoading("create"); setError(""); setMessage("");
    try {
      const result = await api({ action: "create", name, phoneNumber, dropoffPoint, returnPoint });
      if (!result?.shipmentMethod) throw new Error("Ozon не вернул созданный метод доставки.");
      setShipmentMethod(result.shipmentMethod);
      setMessage("Метод доставки создан. Ozon может некоторое время формировать его — обновляйте статус кнопкой ниже.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось создать метод доставки.");
    } finally { setLoading(null); }
  }

  async function refreshStatus() {
    setLoading("refresh"); setError(""); setMessage("");
    try {
      const result = await api({ action: "refresh" });
      if (!result?.shipmentMethod) throw new Error("Ozon не вернул состояние метода доставки.");
      setShipmentMethod(result.shipmentMethod);
      setMessage("Статус метода доставки обновлён.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось обновить статус.");
    } finally { setLoading(null); }
  }

  if (shipmentMethod) {
    return <section className="mt-5 rounded-xl border border-slate-200 p-5">
      <h2 className="text-lg font-bold">Метод отгрузки</h2>
      <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[180px_1fr]">
        <dt className="font-medium text-slate-600">Название</dt><dd>{shipmentMethod.name}</dd>
        <dt className="font-medium text-slate-600">Shipment method ID</dt><dd><code>{shipmentMethod.id}</code></dd>
        <dt className="font-medium text-slate-600">Статус</dt><dd className="font-semibold">{statusLabel(shipmentMethod.status)}</dd>
        <dt className="font-medium text-slate-600">Точка отгрузки</dt><dd>{pointLabel(shipmentMethod.dropoffPoint)}</dd>
        <dt className="font-medium text-slate-600">Пункт возврата</dt><dd>{pointLabel(shipmentMethod.returnPoint)}</dd>
      </dl>
      {shipmentMethod.status.toLowerCase() !== "active" && <p className="mt-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-900">Пока статус не <code>active</code>, Ozon не будет добавлен в оформление заказа.</p>}
      <button type="button" onClick={refreshStatus} disabled={loading !== null} className="mt-4 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
        {loading === "refresh" ? "Обновляем статус…" : "Обновить статус"}
      </button>
      {message && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
      {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
    </section>;
  }

  return <section className="mt-5 rounded-xl border border-slate-200 p-5">
    <h2 className="text-lg font-bold">Настройка метода отгрузки</h2>
    <p className="mt-2 text-sm text-slate-600">Сначала Ozon покажет только доступные вашему кабинету точки. Создание метода произойдёт лишь после подтверждения.</p>
    <label className="mt-4 block text-sm font-medium">Название метода
      <input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
    <label className="mt-4 block text-sm font-medium">Телефон для связи с Ozon
      <input value={phoneNumber} onChange={(event) => setPhoneNumber(event.target.value)} inputMode="tel" className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-2" />
    </label>
    <div className="mt-5 grid gap-5 md:grid-cols-2">
      <div>
        <h3 className="font-semibold">1. Точка отгрузки</h3>
        <button type="button" onClick={() => loadPoints("dropoff")} disabled={loading !== null} className="mt-3 rounded-xl border border-blue-600 px-4 py-2 font-semibold text-blue-700 disabled:opacity-60">
          {loading === "dropoff" ? "Загружаем…" : "Показать доступные точки"}
        </button>
        {dropoffPoints.length > 0 && <select value={dropoffPoint?.id ?? ""} onChange={(event) => setDropoffPoint(dropoffPoints.find((point) => point.id === event.target.value) ?? null)} className="mt-3 block w-full rounded-lg border border-slate-300 px-3 py-2">
          <option value="">Выберите точку</option>{dropoffPoints.map((point) => <option key={point.id} value={point.id}>{pointLabel(point)}</option>)}
        </select>}
        {dropoffPoint && <p className="mt-2 text-sm text-green-800">Выбрано: {pointLabel(dropoffPoint)}</p>}
      </div>
      <div>
        <h3 className="font-semibold">2. Пункт возврата</h3>
        <button type="button" onClick={() => loadPoints("return")} disabled={loading !== null} className="mt-3 rounded-xl border border-blue-600 px-4 py-2 font-semibold text-blue-700 disabled:opacity-60">
          {loading === "return" ? "Загружаем…" : "Показать доступные пункты"}
        </button>
        {returnPoints.length > 0 && <select value={returnPoint?.id ?? ""} onChange={(event) => setReturnPoint(returnPoints.find((point) => point.id === event.target.value) ?? null)} className="mt-3 block w-full rounded-lg border border-slate-300 px-3 py-2">
          <option value="">Выберите пункт</option>{returnPoints.map((point) => <option key={point.id} value={point.id}>{pointLabel(point)}</option>)}
        </select>}
        {returnPoint && <p className="mt-2 text-sm text-green-800">Выбрано: {pointLabel(returnPoint)}</p>}
      </div>
    </div>
    <button type="button" onClick={createMethod} disabled={loading !== null || !dropoffPoint || !returnPoint} className="mt-6 rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60">
      {loading === "create" ? "Создаём метод…" : "Создать метод доставки"}
    </button>
    {message && <p className="mt-3 rounded-lg bg-green-50 p-3 text-sm text-green-800">{message}</p>}
    {error && <p role="alert" className="mt-3 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
  </section>;
}
