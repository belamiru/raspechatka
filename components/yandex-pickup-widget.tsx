"use client";

import { useEffect, useId, useRef, useState } from "react";

declare global {
  interface Window {
    YaDelivery?: { createWidget: (options: unknown) => void };
  }
}

export type YandexPickupPoint = {
  id: string;
  address: string;
  type: "pickup_point" | "terminal";
};

const WIDGET_URL = "https://widget-pvz.dostavka.yandex.net/widget.js?v=2";
// This is our origin platform station, not the destination selected by a customer.
const SOURCE_PLATFORM_STATION = "019e06631c07764c8cf4bc2ede9c2284";

function readAddress(detail: Record<string, unknown>) {
  const address = detail.address;
  if (!address || typeof address !== "object" || Array.isArray(address)) return "";
  const value = address as Record<string, unknown>;
  if (typeof value.full_address === "string" && value.full_address.trim()) return value.full_address.trim();
  return [value.locality, value.street, value.house]
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(", ");
}

export function YandexPickupWidget({
  weightGrams,
  onSelect,
}: {
  weightGrams: number;
  onSelect: (point: YandexPickupPoint | null) => void;
}) {
  const reactId = useId().replace(/[^a-zA-Z0-9_-]/g, "");
  const containerId = `yandex-pickup-${reactId}`;
  const initialized = useRef(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const onPointSelected = (event: Event) => {
      const detail = (event as CustomEvent<unknown>).detail;
      if (!detail || typeof detail !== "object" || Array.isArray(detail)) return;
      const value = detail as Record<string, unknown>;
      const id = typeof value.id === "string" ? value.id.trim() : "";
      const type = value.type === "pickup_point" || value.type === "terminal" ? value.type : null;
      const address = readAddress(value);
      if (id && type && address) onSelect({ id, type, address });
    };
    const start = () => {
      if (initialized.current || !window.YaDelivery) return;
      initialized.current = true;
      window.YaDelivery.createWidget({
        containerId,
        params: {
          city: "Воронеж",
          size: { height: "450px", width: "100%" },
          source_platform_station: SOURCE_PLATFORM_STATION,
          physical_dims_weight_gross: weightGrams,
          // Delivery API integration will calculate the final price in the next step.
          delivery_price: "уточняется",
          delivery_term: "уточняется",
          show_select_button: true,
          filter: {
            type: ["pickup_point", "terminal"],
            payment_methods: ["already_paid", "card_on_receipt"],
            payment_methods_filter: "or",
          },
        },
      });
    };

    document.addEventListener("YaNddWidgetPointSelected", onPointSelected);
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${WIDGET_URL}"]`);
    if (existing) {
      start();
      existing.addEventListener("load", start);
    } else {
      const script = document.createElement("script");
      script.src = WIDGET_URL;
      script.async = true;
      script.onload = start;
      script.onerror = () => setError("Не удалось загрузить карту ПВЗ. Обновите страницу и попробуйте снова.");
      document.head.appendChild(script);
    }
    return () => {
      document.removeEventListener("YaNddWidgetPointSelected", onPointSelected);
    };
  }, [containerId, onSelect, weightGrams]);

  return <div className="mt-4">
    <div id={containerId} className="min-h-[450px] overflow-hidden rounded-xl border border-slate-200" />
    {error && <p role="alert" className="mt-2 text-sm text-red-700">{error}</p>}
  </div>;
}
