"use client";

import {
  formatFileSize,
  type ClientFileKind,
} from "@/lib/client-file-analysis";
import { DEFAULT_PRINT_SETTINGS, getExcludedPages, getPagesWithFormat, getPagesWithColorMode, getPrintablePageCount, type FilePrintSettings } from "@/lib/print-settings";
export type { FilePrintSettings } from "@/lib/print-settings";
import { FileTypeIcon } from "@/components/file-type-icon";
import { ImageFileThumbnail } from "@/components/image-file-thumbnail";

export type OrderFileStatus = "analyzing" | "ready" | "error";

export type OrderFileListItem = {
  id: string;
  file: File;
  kind: ClientFileKind | null;
  pageCount: number | null;
  status: OrderFileStatus;
  error: string | null;
  draftId?: string | null;
  previewUrl?: string | null;
  printSettings?: FilePrintSettings;
};

type OrderFileListProps = {
  items: OrderFileListItem[];
  onRemove: (id: string) => void;

  /*
   * Временно сохраняем prop, чтобы этот компонент оставался совместимым
   * с текущим app/page.tsx. Настройки теперь редактируются в правой панели,
   * поэтому внутри списка этот callback больше не используется.
   */
  onPrintSettingsChange?: (
    id: string,
    settings: FilePrintSettings
  ) => void;

  /*
   * Эти props подключим следующим шагом в app/page.tsx.
   * Пока они необязательны, поэтому промежуточная версия собирается.
   */
  selectedFileId?: string | null;
  onSelectFile?: (id: string) => void;

  /*
   * Стоимость каждого файла в рублях для карточки: считается
   * в app/order/page.tsx той же функцией, что и итог заказа.
   */
  prices?: Record<string, number>;

  /* Кнопка «Настроить»: на мобильном прокручивает к панели параметров. */
  onConfigure?: (id: string) => void;
};

function getPrintSidesLabel(
  printSides: FilePrintSettings["printSides"]
) {
  return printSides === "two-sided"
    ? "Двусторонняя"
    : "Односторонняя";
}

function getFileSettingsSummary(item: OrderFileListItem) {
  const settings = item.printSettings ?? DEFAULT_PRINT_SETTINGS;

  /*
   * Защита не только интерфейса, но и отображения:
   * изображения всегда показываем как односторонние.
   */
  const printSides =
    item.kind === "image" ? "one-sided" : settings.printSides;

  const excluded = getExcludedPages(settings);
  const printable = getPrintablePageCount(item.pageCount ?? 0, settings);
  const a3Pages = getPagesWithFormat(settings, "A3");
  const colorPages = getPagesWithColorMode(settings, "color");
  return `${settings.defaults.paperFormat} · ${settings.copies} ${settings.copies === 1 ? "копия" : "копии"} · ${getPrintSidesLabel(printSides)}${excluded.length ? ` · печатать ${printable} из ${item.pageCount ?? 0} стр.` : ""}${a3Pages.length ? ` · A3: стр. ${a3Pages.join(", ")}` : ""}${colorPages.length ? ` · Цвет: стр. ${colorPages.join(", ")}` : ""}`;
}

export function OrderFileList({
  items,
  onRemove,
  selectedFileId,
  onSelectFile,
  prices,
  onConfigure,
}: OrderFileListProps) {
  if (items.length === 0) {
    return null;
  }

  function selectFile(id: string) {
    onSelectFile?.(id);
  }

  function configureFile(id: string) {
    onSelectFile?.(id);
    onConfigure?.(id);
  }

  return (
    <ul className="mt-6 space-y-3">
      {items.map((item) => {
        const isSelected = selectedFileId === item.id;
        const isReady = item.status === "ready";
        const isError = item.status === "error";
        const isAnalyzing = item.status === "analyzing";
        const filePrice = prices?.[item.id];

        return (
          <li
            key={item.id}
            className={`overflow-hidden rounded-2xl border bg-white transition ${
              isError
                ? "border-red-200 bg-red-50/60"
                : isSelected
                  ? "border-blue-600 shadow-sm ring-1 ring-blue-200"
                  : "border-slate-200 hover:border-slate-300"
            }`}
          >
            <div
              className={`flex items-start gap-3 p-4 transition ${
                isError ? "" : "cursor-pointer hover:bg-slate-50/70"
              }`}
              onClick={isError ? undefined : () => selectFile(item.id)}
              onKeyDown={(event) => {
                if (!isError && (event.key === "Enter" || event.key === " ")) {
                  event.preventDefault();
                  selectFile(item.id);
                }
              }}
              role={isError ? undefined : "button"}
              tabIndex={isError ? undefined : 0}
              aria-current={isSelected ? "true" : undefined}
              aria-label={isError ? undefined : `Выбрать файл для настройки: ${item.file.name}`}
            >
              {!isError && (
                <span
                  className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-black transition ${
                    isSelected
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  }`}
                  aria-hidden="true"
                >
                  ✓
                </span>
              )}

              {item.kind === "image" ? (
                <ImageFileThumbnail file={item.file} />
              ) : (
                <FileTypeIcon fileName={item.file.name} />
              )}

              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <p
                    className="min-w-0 max-w-full flex-1 basis-40 truncate font-bold text-slate-900"
                    title={item.file.name}
                  >
                    {item.file.name}
                  </p>

                  {isReady && (
                    <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                      <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                      Настроено
                    </span>
                  )}

                  {isAnalyzing && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-700">
                      <svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                        <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
                        <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
                      </svg>
                      Проверяем…
                    </span>
                  )}

                  {isError && (
                    <span className="rounded-full bg-red-600 px-2 py-0.5 text-xs font-bold text-white">Ошибка</span>
                  )}
                </div>

                <p className="mt-1 text-sm text-slate-500">
                  {[
                    item.status === "ready"
                      ? `${item.pageCount ?? 0} ${getPagesWord(item.pageCount ?? 0)}`
                      : null,
                    formatFileSize(item.file.size),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </p>

                {isReady && (
                  <p className="mt-1 text-sm text-slate-700">{getFileSettingsSummary(item)}</p>
                )}

                {item.error && (
                  <p className="mt-1.5 text-sm font-medium text-red-700">{item.error}</p>
                )}

                {!isReady && !isError && (
                  <p className="mt-1.5 text-xs text-amber-800">
                    Параметры станут доступны после проверки файла.
                  </p>
                )}
              </div>

              {isReady && filePrice !== undefined && (
                <span className="shrink-0 self-start text-base font-black text-slate-900">{filePrice} ₽</span>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 px-4 py-2.5">
              {!isError && (
                <button
                  type="button"
                  disabled={!isReady}
                  onClick={(event) => {
                    event.stopPropagation();
                    configureFile(item.id);
                  }}
                  className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Настроить
                </button>
              )}

              {/* Предпросмотр с выбором опций для каждой страницы: только документы. */}
              {isReady && item.kind === "document" && item.draftId && (
                <a
                  href={`/print-drafts/${item.draftId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(event) => event.stopPropagation()}
                  className="rounded-lg bg-blue-700 px-3 py-1.5 text-sm font-bold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"
                  aria-label={`Открыть предпросмотр файла ${item.file.name} в новой вкладке`}
                >
                  Предпросмотр
                </a>
              )}

              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  onRemove(item.id);
                }}
                className="rounded-lg px-3 py-1.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100"
                aria-label={`Удалить файл ${item.file.name}`}
              >
                Удалить
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Склонение слова «страница» для подписи под названием файла. */
function getPagesWord(pages: number) {
  const mod10 = pages % 10;
  const mod100 = pages % 100;
  if (mod10 === 1 && mod100 !== 11) return "страница";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "страницы";
  return "страниц";
}
