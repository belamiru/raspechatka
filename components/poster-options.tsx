"use client";

import { useMemo } from "react";
import {
  POSTER_FORMATS,
  POSTER_MIN_DPI,
  POSTER_PAPERS,
  getPosterPaper,
  getPosterPrice,
  getRequiredPixels,
  validatePosterSize,
  type PosterFormat,
} from "@/lib/pricing";
import type { PrintExtraOptions } from "@/lib/print-extras";

/* Размер загруженного изображения в пикселях, если удалось прочитать. */
export type ImagePixels = { width: number; height: number };

export type PosterOptionsProps = {
  value: PrintExtraOptions;
  onChange: (nextValue: PrintExtraOptions) => void;
  copies: number;
  imagePixels: ImagePixels | null;
};

/*
 * Опции широкоформатной печати: материал, формат и размер.
 *
 * Цена считается по площади, поэтому при своём размере она пересчитывается
 * на каждый ввод. Рулон ограничивает ширину, а не длину: проверяем, что
 * хотя бы одна сторона укладывается в лимит материала.
 */
export function PosterOptions({ value, onChange, copies, imagePixels }: PosterOptionsProps) {
  const { posterPaper, posterFormat, posterWidthMm, posterHeightMm } = value;

  function change(changes: Partial<PrintExtraOptions>) {
    onChange({ ...value, ...changes });
  }

  /* При выборе стандартного формата размеры подставляются из таблицы. */
  function changeFormat(next: PosterFormat) {
    if (next === "custom") {
      change({ posterFormat: next });
      return;
    }

    const format = POSTER_FORMATS.find((item) => item.id === next);

    change({
      posterFormat: next,
      posterWidthMm: format?.widthMm ?? posterWidthMm,
      posterHeightMm: format?.heightMm ?? posterHeightMm,
    });
  }

  const paper = getPosterPaper(posterPaper);
  const validation = validatePosterSize({
    widthMm: posterWidthMm,
    heightMm: posterHeightMm,
    maxWidthMm: paper.maxWidthMm,
  });

  const price = useMemo(
    () =>
      getPosterPrice({
        widthMm: posterWidthMm,
        heightMm: posterHeightMm,
        pricePerSqm: paper.pricePerSqm,
        copies,
      }),
    [posterWidthMm, posterHeightMm, paper.pricePerSqm, copies]
  );

  const required = getRequiredPixels(posterWidthMm, posterHeightMm);

  /*
   * Часть снимков не дотягивает до 150 dpi на большом листе. Предупреждаем
   * конкретными числами: так понятно, чего не хватает и насколько.
   */
  const resolutionWarning = useMemo(() => {
    if (!imagePixels || !validation.valid) return null;

    const widthEnough = imagePixels.width >= required.width;
    const heightEnough = imagePixels.height >= required.height;

    if (widthEnough && heightEnough) return null;

    /* Сколько dpi реально получится при текущем размере снимка. */
    const actualDpi = Math.min(
      (imagePixels.width / (posterWidthMm / 25.4)),
      (imagePixels.height / (posterHeightMm / 25.4))
    );

    return { actualDpi: Math.max(1, Math.floor(actualDpi)) };
  }, [imagePixels, required, validation.valid, posterWidthMm, posterHeightMm]);

  return (
    <div className="space-y-4 border-t border-slate-200 pt-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Плакат</p>
        {validation.valid && (
          <p className="text-xs font-semibold text-slate-600">{price.totalPrice} ₽</p>
        )}
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Материал</p>
        <div className="mt-1.5 space-y-1.5">
          {POSTER_PAPERS.map((item) => {
            const isSelected = item.id === posterPaper;

            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => change({ posterPaper: item.id })}
                className={`flex w-full items-start justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${
                  isSelected
                    ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-200"
                    : "border-slate-200 bg-white hover:bg-slate-50"
                }`}
              >
                <span className="min-w-0">
                  <span className={`block text-sm font-bold ${isSelected ? "text-blue-800" : "text-slate-900"}`}>
                    {item.label}
                  </span>
                  <span className="mt-0.5 block text-xs leading-4 text-slate-500">
                    {item.group} · {item.note} · до {item.maxWidthMm} мм
                  </span>
                </span>

                <span className="shrink-0 text-sm font-bold text-slate-900">
                  {item.pricePerSqm} ₽/м²
                </span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Размер</p>
        <div className="mt-1.5 grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1 sm:grid-cols-4">
          {POSTER_FORMATS.map((format) => {
            const isSelected = posterFormat === format.id;

            return (
              <button
                key={format.id}
                type="button"
                aria-pressed={isSelected}
                onClick={() => changeFormat(format.id)}
                className={`rounded-lg px-2 py-2 text-sm font-bold transition ${
                  isSelected
                    ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                    : "text-slate-600 hover:text-slate-900"
                }`}
              >
                {format.label}
                <span className="mt-0.5 block text-[10px] font-medium leading-3 text-slate-500">
                  {format.note}
                </span>
              </button>
            );
          })}
        </div>

        {posterFormat === "custom" && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <label className="block text-xs font-semibold text-slate-700">
              Ширина, мм
              <input
                type="number"
                inputMode="numeric"
                min={100}
                max={paper.maxWidthMm}
                step={1}
                value={posterWidthMm || ""}
                onChange={(event) => change({ posterWidthMm: Number(event.target.value) })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </label>

            <label className="block text-xs font-semibold text-slate-700">
              Высота, мм
              <input
                type="number"
                inputMode="numeric"
                min={100}
                step={1}
                value={posterHeightMm || ""}
                onChange={(event) => change({ posterHeightMm: Number(event.target.value) })}
                className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold text-slate-900 outline-none focus:border-blue-500"
              />
            </label>
          </div>
        )}

        {!validation.valid && (
          <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs leading-5 text-red-800">
            {validation.error}
          </p>
        )}
      </div>

      {validation.valid && (
        <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-600">
          <p>
            Площадь {price.areaSqm.toFixed(2)} м² · {paper.pricePerSqm} ₽/м²
            {copies > 1 ? ` · копий: ${copies}` : ""}
          </p>
          <p className="mt-1 font-bold text-slate-900">
            {price.totalPrice} ₽
            {copies > 1 ? ` (${price.unitPrice} ₽ × ${copies})` : ""}
          </p>
        </div>
      )}

      {validation.valid && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/70 px-3 py-2.5">
          <p className="text-xs font-bold text-amber-900">
            Для печати нужно не меньше {required.width}×{required.height} px
          </p>
          <p className="mt-1 text-xs leading-5 text-amber-900">
            Это {POSTER_MIN_DPI} пикселей на дюйм при размере {posterWidthMm}×{posterHeightMm} мм.
            Файл меньшего размера напечатается мутным или пикселизованным.
          </p>

          {resolutionWarning && (
            <p className="mt-2 rounded-lg bg-white/70 px-2.5 py-2 text-xs font-semibold leading-5 text-red-800">
              Ваш файл {imagePixels?.width}×{imagePixels?.height} px — это примерно{" "}
              {resolutionWarning.actualDpi} dpi. Для этого размера разрешения не хватает:
              изображение может получиться нерезким. Уменьшите размер или загрузите файл крупнее.
            </p>
          )}

          {imagePixels && !resolutionWarning && (
            <p className="mt-2 text-xs font-semibold leading-5 text-emerald-800">
              Ваш файл {imagePixels.width}×{imagePixels.height} px — разрешения достаточно.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
