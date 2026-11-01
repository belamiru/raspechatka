"use client";

import { getDeliveryProgress, formatDeliveryPrice } from "@/lib/delivery";

/*
 * Шкала «до бесплатной доставки».
 *
 * Показывается на странице заказа и при оформлении. Когда порог достигнут,
 * полоса становится зелёной и текст меняется на поздравление — так покупатель
 * видит результат, а не просто исчезнувшую подсказку.
 */
export function FreeDeliveryProgress({
  printPrice,
  className = "",
}: {
  printPrice: number;
  className?: string;
}) {
  const progress = getDeliveryProgress(printPrice);

  return (
    <section
      className={`rounded-2xl border p-4 transition ${
        progress.isFree ? "border-emerald-200 bg-emerald-50/70" : "border-slate-200 bg-white"
      } ${className}`}
      aria-label="Прогресс до бесплатной доставки"
    >
      {progress.isFree ? (
        <p className="flex flex-wrap items-baseline gap-x-2 text-sm font-bold text-emerald-800">
          <span aria-hidden="true">✓</span>
          Доставка бесплатная
          <span className="text-xs font-semibold text-emerald-700">
            — заказ от {progress.threshold.toLocaleString("ru-RU")} ₽
          </span>
        </p>
      ) : (
        <p className="text-sm text-slate-700">
          До бесплатной доставки —{" "}
          <span className="font-black text-slate-950">{progress.remaining.toLocaleString("ru-RU")} ₽</span>
        </p>
      )}

      <div
        className="mt-3 h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={progress.threshold}
        aria-valuenow={progress.printPrice}
        aria-valuetext={`${progress.percent}% до бесплатной доставки`}
      >
        <div
          className={`h-full rounded-full transition-all duration-500 ${
            progress.isFree ? "bg-emerald-500" : "bg-blue-600"
          }`}
          style={{ width: `${progress.percent}%` }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between gap-3 text-xs text-slate-500">
        <span>{progress.printPrice.toLocaleString("ru-RU")} ₽</span>
        <span className="font-semibold">
          {progress.isFree
            ? formatDeliveryPrice(0)
            : `${progress.threshold.toLocaleString("ru-RU")} ₽ — бесплатно`}
        </span>
      </div>
    </section>
  );
}
