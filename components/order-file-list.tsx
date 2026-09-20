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
};

function getKindLabel(kind: ClientFileKind | null) {
  if (kind === "image") {
    return "Изображение";
  }

  if (kind === "document") {
    return "Документ";
  }

  return "Файл";
}

function getStatusContent(item: OrderFileListItem) {
  if (item.status === "analyzing") {
    return {
      className: "bg-blue-100 text-blue-800",
      label: "Подготавливается…",
    };
  }

  if (item.status === "error") {
    return {
      className: "bg-red-100 text-red-800",
      label: "Ошибка проверки",
    };
  }

  return {
    className: "bg-emerald-100 text-emerald-800",
    label: `${item.pageCount ?? 0} стр.`,
  };
}

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
  const solidColorPages = getPagesWithColorMode(settings, "solid-color");
  return `${settings.defaults.paperFormat} · ${settings.copies} ${settings.copies === 1 ? "копия" : "копии"} · ${getPrintSidesLabel(printSides)}${excluded.length ? ` · печатать ${printable} из ${item.pageCount ?? 0} стр.` : ""}${a3Pages.length ? ` · A3: стр. ${a3Pages.join(", ")}` : ""}${colorPages.length ? ` · Цвет: стр. ${colorPages.join(", ")}` : ""}${solidColorPages.length ? ` · Заливка: стр. ${solidColorPages.join(", ")}` : ""}`;
}

export function OrderFileList({
  items,
  onRemove,
  selectedFileId,
  onSelectFile,
}: OrderFileListProps) {
  if (items.length === 0) {
    return null;
  }

  function selectFile(id: string) {
    onSelectFile?.(id);
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
      <div className="flex flex-col gap-1 border-b border-slate-200 bg-slate-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-3">
        <p className="font-semibold text-slate-800">
          Выбранные файлы: {items.length}
        </p>

        <p className="text-sm text-slate-500">
          Выберите файл, чтобы настроить его печать
        </p>
      </div>

      <ul className="divide-y divide-slate-200">
        {items.map((item, index) => {
          const status = getStatusContent(item);
          const isSelected = selectedFileId === item.id;
          const canSelect = Boolean(onSelectFile);

          return (
            <li
              key={item.id}
              className={`transition ${
                isSelected ? "bg-blue-50/70" : "bg-white"
              }`}
            >
              <div
                className={`flex items-start gap-3 px-4 py-4 transition ${
                  canSelect
                    ? "cursor-pointer hover:bg-slate-50"
                    : ""
                }`}
                onClick={() => selectFile(item.id)}
                onKeyDown={(event) => {
                  if (
                    canSelect &&
                    (event.key === "Enter" || event.key === " ")
                  ) {
                    event.preventDefault();
                    selectFile(item.id);
                  }
                }}
                role={canSelect ? "button" : undefined}
                tabIndex={canSelect ? 0 : undefined}
                aria-current={isSelected ? "true" : undefined}
                aria-label={
                  canSelect
                    ? `Выбрать файл для настройки: ${item.file.name}`
                    : undefined
                }
              >
                <div
                  className={`mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-black transition ${
                    isSelected
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-300 bg-white text-slate-400"
                  }`}
                  aria-hidden="true"
                >
                  {isSelected ? "✓" : index + 1}
                </div>

                  {item.kind === "image" ? (
                  <ImageFileThumbnail file={item.file} />
                ) : (
                  <FileTypeIcon fileName={item.file.name} />
                )}

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p
                      className="max-w-full truncate font-semibold text-slate-800"
                      title={item.file.name}
                    >
                      {item.file.name}
                    </p>

                    <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                      {getKindLabel(item.kind)}
                    </span>

                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-bold ${status.className}`}
                    >
                      {item.status === "analyzing" && (
                        <svg
                          className="h-3.5 w-3.5 animate-spin"
                          viewBox="0 0 24 24"
                          fill="none"
                          aria-hidden="true"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="9"
                            stroke="currentColor"
                            strokeWidth="3"
                          />
                          <path
                            d="M21 12a9 9 0 0 0-9-9"
                            stroke="currentColor"
                            strokeWidth="3"
                            strokeLinecap="round"
                          />
                        </svg>
                      )}
                      {status.label}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {formatFileSize(item.file.size)}
                    {item.status === "ready" && item.kind === "image"
                      ? " · 1 страница"
                      : ""}
                  </p>

                  {item.status === "ready" && (
                    <p className="mt-2 text-sm font-medium text-slate-700">
                      {getFileSettingsSummary(item)}
                    </p>
                  )}

                  {item.status === "ready" && (
                    <p className="mt-1 text-xs text-blue-700">
                      <span className="sm:hidden">Параметры печати…</span>
                      <span className="hidden sm:inline">
                        {isSelected
                          ? "Параметры этого файла отображаются справа."
                          : "Нажмите, чтобы настроить этот файл."}
                      </span>
                    </p>
                  )}

                  {item.error && (
                    <p className="mt-2 text-sm font-medium text-red-700">
                      {item.error}
                    </p>
                  )}
                </div>

                <div className="flex shrink-0 items-center gap-1">
                  {item.status === "ready" &&
                    item.kind === "document" &&
                    item.draftId && (
                      <a
                        href={`/print-drafts/${item.draftId}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(event) => event.stopPropagation()}
                        className="rounded-lg bg-blue-700 px-3 py-2 text-sm font-bold text-white transition hover:bg-blue-800 focus:outline-none focus:ring-4 focus:ring-blue-200"
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
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50 focus:outline-none focus:ring-4 focus:ring-red-100"
                    aria-label={`Удалить файл ${item.file.name}`}
                  >
                    Удалить
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}