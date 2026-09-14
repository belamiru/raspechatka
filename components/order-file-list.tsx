"use client";

import {
  formatFileSize,
  type ClientFileKind,
} from "@/lib/client-file-analysis";
import type { PaperFormat, PrintSides } from "@/lib/pricing";

export type OrderFileStatus = "analyzing" | "ready" | "error";

export type FilePrintSettings = {
  paperFormat: PaperFormat;
  copies: number;
  printSides: PrintSides;
};

export type OrderFileListItem = {
  id: string;
  file: File;
  kind: ClientFileKind | null;
  pageCount: number | null;
  status: OrderFileStatus;
  error: string | null;

  /*
   * Пока поле необязательное, чтобы компонент оставался совместимым
   * с текущим app/page.tsx. На следующем шаге настройки станут частью
   * каждого файла при его добавлении.
   */
  printSettings?: FilePrintSettings;
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
      label: "Проверяется…",
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

function getDefaultPrintSettings(): FilePrintSettings {
  return {
    paperFormat: "A4",
    copies: 1,
    printSides: "one-sided",
  };
}

export function OrderFileList({
  items,
  onRemove,
  onPrintSettingsChange,
}: {
  items: OrderFileListItem[];
  onRemove: (id: string) => void;

  /*
   * Необязательный callback нужен для плавного перехода:
   * app/page.tsx подключит его следующим шагом.
   */
  onPrintSettingsChange?: (
    id: string,
    settings: FilePrintSettings
  ) => void;
}) {
  if (items.length === 0) {
    return null;
  }

  function changeSettings(
    item: OrderFileListItem,
    changes: Partial<FilePrintSettings>
  ) {
    if (!onPrintSettingsChange) {
      return;
    }

    const currentSettings = item.printSettings ?? getDefaultPrintSettings();

    const nextSettings: FilePrintSettings = {
      ...currentSettings,
      ...changes,
    };

    /*
     * Изображение — один самостоятельный печатный лист.
     * Двусторонний режим для JPG/JPEG/PNG не предлагаем и не передаём.
     */
    if (item.kind === "image") {
      nextSettings.printSides = "one-sided";
    }

    onPrintSettingsChange(item.id, nextSettings);
  }

  return (
    <div className="mt-5 overflow-hidden rounded-2xl border border-slate-200">
      <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3">
        <p className="font-semibold text-slate-800">
          Выбранные файлы: {items.length}
        </p>

        <p className="text-sm text-slate-500">
          Настройки печати задаются отдельно для каждого файла
        </p>
      </div>

      <ul className="divide-y divide-slate-200">
        {items.map((item) => {
          const status = getStatusContent(item);
          const settings = item.printSettings ?? getDefaultPrintSettings();
          const canEditPrintSettings =
            item.status === "ready" && Boolean(onPrintSettingsChange);
          const isImage = item.kind === "image";

          return (
            <li key={item.id} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
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
                      className={`rounded-full px-2 py-1 text-xs font-bold ${status.className}`}
                    >
                      {status.label}
                    </span>
                  </div>

                  <p className="mt-1 text-sm text-slate-500">
                    {formatFileSize(item.file.size)}
                    {item.status === "ready" && item.kind === "image"
                      ? " · 1 страница"
                      : ""}
                  </p>

                  {item.error && (
                    <p className="mt-2 text-sm font-medium text-red-700">
                      {item.error}
                    </p>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => onRemove(item.id)}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-50"
                  aria-label={`Удалить файл ${item.file.name}`}
                >
                  Удалить
                </button>
              </div>

              {item.status === "ready" && (
                <div className="mt-4 grid gap-3 rounded-xl bg-slate-50 p-3 sm:grid-cols-3">
                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Формат
                    </span>

                    <select
                      value={settings.paperFormat}
                      disabled={!canEditPrintSettings}
                      onChange={(event) =>
                        changeSettings(item, {
                          paperFormat:
                            event.target.value === "A3" ? "A3" : "A4",
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="A4">A4</option>
                      <option value="A3">A3</option>
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Копии
                    </span>

                    <select
                      value={settings.copies}
                      disabled={!canEditPrintSettings}
                      onChange={(event) =>
                        changeSettings(item, {
                          copies: Number(event.target.value),
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {Array.from({ length: 20 }, (_, index) => index + 1).map(
                        (copies) => (
                          <option key={copies} value={copies}>
                            {copies}
                          </option>
                        )
                      )}
                    </select>
                  </label>

                  <label className="block">
                    <span className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-500">
                      Печать
                    </span>

                    <select
                      value={isImage ? "one-sided" : settings.printSides}
                      disabled={!canEditPrintSettings || isImage}
                      onChange={(event) =>
                        changeSettings(item, {
                          printSides:
                            event.target.value === "two-sided"
                              ? "two-sided"
                              : "one-sided",
                        })
                      }
                      className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      <option value="one-sided">Односторонняя</option>

                      {!isImage && (
                        <option value="two-sided">Двусторонняя</option>
                      )}
                    </select>

                    {isImage && (
                      <span className="mt-1 block text-xs leading-4 text-slate-500">
                        Для изображений доступна только односторонняя печать.
                      </span>
                    )}
                  </label>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}