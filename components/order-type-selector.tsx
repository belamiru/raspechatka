"use client";

import { useState } from "react";

/*
 * Выбор типа заказа. Пока активен только «Документы»: остальные типы
 * появятся вместе со своими опциями и ценами, поэтому кнопки заблокированы
 * и подписаны «Скоро». Разметка уже готова к переключению.
 */
const ORDER_TYPES = [
  {
    id: "documents",
    label: "Документы",
    description: "Рефераты, договоры, справки, презентации",
    available: true,
  },
  {
    id: "photo",
    label: "Фотографии",
    description: "Печать фото 10×15, A4 и других форматов",
    available: false,
  },
  {
    id: "posters",
    label: "Плакаты и чертежи",
    description: "Печать до A0, цветная и ч/б",
    available: false,
  },
] as const;

type OrderTypeId = (typeof ORDER_TYPES)[number]["id"];

export function OrderTypeSelector() {
  const [selected, setSelected] = useState<OrderTypeId>("documents");

  return (
    <section
      className="mb-6 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5"
      aria-labelledby="order-type-heading"
    >
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="order-type-heading" className="text-sm font-bold uppercase tracking-wider text-slate-500">
          Тип заказа
        </h2>
        <p className="text-xs text-slate-500">От типа зависят доступные опции печати</p>
      </div>

      <div className="mt-3 grid gap-2 sm:grid-cols-3" role="radiogroup" aria-labelledby="order-type-heading">
        {ORDER_TYPES.map((type) => {
          const isSelected = selected === type.id;

          return (
            <button
              key={type.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              disabled={!type.available}
              onClick={() => setSelected(type.id)}
              title={type.available ? undefined : "Появится позже"}
              className={`rounded-xl border p-3 text-left transition ${
                isSelected
                  ? "border-blue-600 bg-blue-50/70 ring-1 ring-blue-200"
                  : type.available
                    ? "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50"
                    : "cursor-not-allowed border-slate-200 bg-slate-50 opacity-70"
              }`}
            >
              <span className="flex items-center justify-between gap-2">
                <span className={`text-sm font-bold ${isSelected ? "text-blue-800" : "text-slate-800"}`}>
                  {type.label}
                </span>

                {!type.available && (
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                    Скоро
                  </span>
                )}

                {isSelected && (
                  <span className="h-2 w-2 shrink-0 rounded-full bg-blue-600" aria-hidden="true" />
                )}
              </span>

              <span className="mt-1 block text-xs leading-5 text-slate-500">{type.description}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
