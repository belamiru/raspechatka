"use client";

import type {
  FilePrintSettings,
  OrderFileListItem,
} from "@/components/order-file-list";

type PrintSettingsPanelProps = {
  selectedFile: OrderFileListItem | null;
  selectedFilePrice: number | null;
  onPrintSettingsChange: (
    fileId: string,
    settings: FilePrintSettings
  ) => void;
  onApplyToAll: (settings: FilePrintSettings) => void;
};

const DEFAULT_PRINT_SETTINGS: FilePrintSettings = {
  paperFormat: "A4",
  copies: 1,
  printSides: "one-sided",
};

function getFileKindLabel(item: OrderFileListItem) {
  if (item.kind === "image") {
    return "Изображение";
  }

  if (item.kind === "document") {
    return "Документ";
  }

  return "Файл";
}

function getPrintSidesLabel(
  printSides: FilePrintSettings["printSides"]
) {
  return printSides === "two-sided"
    ? "Двусторонняя"
    : "Односторонняя";
}

export function PrintSettingsPanel({
  selectedFile,
  selectedFilePrice,
  onPrintSettingsChange,
  onApplyToAll,
}: PrintSettingsPanelProps) {
  if (!selectedFile) {
    return (
      <aside className="h-fit min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
          Параметры печати
        </p>

        <h2 className="mt-2 text-xl font-bold text-slate-900">
          Выберите файл
        </h2>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Нажмите на файл в списке слева, чтобы настроить его формат,
          количество копий и режим печати.
        </p>
      </aside>
    );
  }

  const settings = selectedFile.printSettings ?? DEFAULT_PRINT_SETTINGS;
  const isImage = selectedFile.kind === "image";
  const isReady = selectedFile.status === "ready";

  function changeSettings(changes: Partial<FilePrintSettings>) {
    const nextSettings: FilePrintSettings = {
      ...settings,
      ...changes,
    };

    /*
     * JPG/JPEG/PNG не печатаются в двустороннем режиме.
     * Такое же ограничение есть в app/page.tsx и на сервере.
     */
    if (isImage) {
      nextSettings.printSides = "one-sided";
    }

      onPrintSettingsChange(selectedFile!.id, nextSettings);
  }

  function changeCopies(direction: "increase" | "decrease") {
    const nextCopies =
      direction === "increase"
        ? Math.min(1000, settings.copies + 1)
        : Math.max(1, settings.copies - 1);

    changeSettings({
      copies: nextCopies,
    });
  }

  function applyCurrentSettingsToAll() {
    onApplyToAll({
      ...settings,
      printSides: isImage ? "one-sided" : settings.printSides,
    });
  }

  return (
    <aside className="h-fit min-w-0 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
            Параметры печати
          </p>

          <h2 className="mt-2 text-xl font-bold text-slate-900">
            Настройка файла
          </h2>
        </div>

        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {getFileKindLabel(selectedFile)}
        </span>
      </div>

      <div className="mt-5 rounded-2xl bg-slate-50 p-4">
        <p
          className="truncate font-bold text-slate-900"
          title={selectedFile.file.name}
        >
          {selectedFile.file.name}
        </p>

        <p className="mt-1 text-sm text-slate-500">
          {selectedFile.status === "ready"
            ? `${selectedFile.pageCount ?? 0} стр.`
            : selectedFile.status === "analyzing"
              ? "Файл проверяется…"
              : "Не удалось проверить файл"}
        </p>
      </div>

      {!isReady && (
        <p className="mt-5 rounded-xl bg-amber-50 p-3 text-sm leading-5 text-amber-900">
          Параметры будут доступны после завершения проверки файла.
        </p>
      )}

      <fieldset disabled={!isReady} className="mt-6 space-y-6">
        <div>
          <p className="text-sm font-bold text-slate-800">
            Формат бумаги
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["A4", "A3"] as const).map((paperFormat) => {
              const isSelected = settings.paperFormat === paperFormat;

              return (
                <button
                  key={paperFormat}
                  type="button"
                  onClick={() => changeSettings({ paperFormat })}
                  className={`rounded-xl border px-4 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-50 ${
                    isSelected
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                  aria-pressed={isSelected}
                >
                  {paperFormat}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            A3 стоит в два раза дороже A4.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-800">
            Количество копий
          </p>

          <div className="mt-3 flex overflow-hidden rounded-xl border border-slate-300 bg-white">
            <button
              type="button"
              onClick={() => changeCopies("decrease")}
              disabled={!isReady || settings.copies <= 1}
              className="flex h-12 w-12 items-center justify-center border-r border-slate-300 text-xl font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Уменьшить количество копий"
            >
              −
            </button>

            <span className="flex h-12 flex-1 items-center justify-center text-base font-bold text-slate-900">
              {settings.copies}
            </span>

            <button
              type="button"
              onClick={() => changeCopies("increase")}
              disabled={!isReady || settings.copies >= 1000}
              className="flex h-12 w-12 items-center justify-center border-l border-slate-300 text-xl font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300"
              aria-label="Увеличить количество копий"
            >
              +
            </button>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-800">
            Стороны печати
          </p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            {(["one-sided", "two-sided"] as const).map((printSides) => {
              const isSelected = settings.printSides === printSides;
              const isDisabled = isImage && printSides === "two-sided";

              return (
                <button
                  key={printSides}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => changeSettings({ printSides })}
                  className={`rounded-xl border px-3 py-3 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    isSelected
                      ? "border-blue-700 bg-blue-700 text-white"
                      : "border-slate-300 bg-white text-slate-700 hover:border-blue-400 hover:bg-blue-50"
                  }`}
                  aria-pressed={isSelected}
                >
                  {getPrintSidesLabel(printSides)}
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            {isImage
              ? "Для изображений доступна только односторонняя печать."
              : "Двусторонняя печать уменьшает число листов, но не меняет стоимость страниц."}
          </p>
        </div>
      </fieldset>

      <div className="mt-6 rounded-2xl bg-slate-900 p-4 text-white">
        <div className="flex items-end justify-between gap-4">
          <span className="text-sm text-slate-300">Стоимость файла</span>

          <span className="text-2xl font-black">
            {selectedFilePrice ?? 0} ₽
          </span>
        </div>
      </div>

      <button
        type="button"
        disabled={!isReady}
        onClick={applyCurrentSettingsToAll}
        className="mt-4 w-full rounded-xl border border-blue-700 px-4 py-3 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      >
        Применить эти параметры ко всем файлам
      </button>

      <p className="mt-2 text-xs leading-5 text-slate-500">
        Формат и копии будут применены ко всем файлам. Изображения всегда
        останутся односторонними.
      </p>
    </aside>
  );
}