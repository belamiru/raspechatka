"use client";

import { useState } from "react";
import type { OrderFileListItem } from "@/components/order-file-list";
import {
  clampCopies,
  DEFAULT_PRINT_SETTINGS,
  MAX_COPIES,
  parseCopiesDraft,
  type FilePrintSettings,
} from "@/lib/print-settings";

type PrintSettingsPanelProps = {
  selectedFile: OrderFileListItem | null;
  selectedFilePrice: number | null;
  onPrintSettingsChange: (
    fileId: string,
    settings: FilePrintSettings
  ) => void;
  onApplyToAll: (settings: FilePrintSettings) => void;

  /*
   * inline — панель встроена в карточку файла: без своей рамки, без
   * повторного названия файла и без цены (они уже есть в карточке).
   */
  variant?: "card" | "inline";
};

function getFileKindLabel(item: OrderFileListItem) {
  if (item.kind === "image") return "Изображение";
  if (item.kind === "document") return "Документ";
  return "Файл";
}

/** Переключатель из нескольких вариантов в одну строку. */
function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string; disabled?: boolean }[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{label}</p>
      <div
        className="mt-1.5 grid gap-1 rounded-xl bg-slate-100 p-1"
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
      >
        {options.map((option) => {
          const isSelected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              disabled={option.disabled}
              aria-pressed={isSelected}
              onClick={() => onChange(option.value)}
              className={`rounded-lg px-2 py-2 text-sm font-bold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                isSelected
                  ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200"
                  : "text-slate-600 hover:text-slate-900"
              }`}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Количество копий: можно печатать цифрами или нажимать − / +.
 * Пока пользователь печатает, поле хранит собственный текст, поэтому его можно
 * полностью стереть и набрать заново. Недопустимое значение (пусто, 0, больше
 * лимита) исправляется, когда пользователь выходит из поля.
 */
function CopiesInput({
  value,
  disabled,
  onChange,
}: {
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const [draft, setDraft] = useState<string | null>(null);

  function handleType(raw: string) {
    const parsed = parseCopiesDraft(raw);
    setDraft(parsed.draft);
    if (parsed.value !== null) onChange(parsed.value);
  }

  function finishTyping() {
    if (draft === null) return;
    const parsed = parseCopiesDraft(draft);
    // Пусто — возвращаем прежнее значение, 0 и «слишком много» — подтягиваем к границе.
    if (draft === "") onChange(value);
    else if (parsed.value === null) onChange(clampCopies(Number(draft)));
    setDraft(null);
  }

  function step(delta: number) {
    setDraft(null);
    onChange(clampCopies(value + delta));
  }

  const buttonClass =
    "flex h-10 w-10 items-center justify-center text-lg font-bold text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:text-slate-300";

  return (
    <div className="flex items-center overflow-hidden rounded-xl border border-slate-300 bg-white">
      <button
        type="button"
        onClick={() => step(-1)}
        disabled={disabled || value <= 1}
        aria-label="Уменьшить количество копий"
        className={`${buttonClass} border-r border-slate-300`}
      >
        −
      </button>
      <input
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        aria-label="Количество копий"
        disabled={disabled}
        value={draft ?? String(value)}
        onFocus={(event) => event.currentTarget.select()}
        onChange={(event) => handleType(event.target.value)}
        onBlur={finishTyping}
        onKeyDown={(event) => {
          // Enter в поле не должен отправлять форму заказа.
          if (event.key === "Enter") {
            event.preventDefault();
            event.currentTarget.blur();
          }
        }}
        className="h-10 w-16 min-w-0 bg-white text-center text-base font-bold text-slate-900 outline-none focus:bg-blue-50 disabled:bg-slate-50 disabled:text-slate-400"
      />
      <button
        type="button"
        onClick={() => step(1)}
        disabled={disabled || value >= MAX_COPIES}
        aria-label="Увеличить количество копий"
        className={`${buttonClass} border-l border-slate-300`}
      >
        +
      </button>
    </div>
  );
}

export function PrintSettingsPanel({
  selectedFile,
  selectedFilePrice,
  onPrintSettingsChange,
  onApplyToAll,
  variant = "card",
}: PrintSettingsPanelProps) {
  const isInline = variant === "inline";
  const shellClass = isInline
    ? "min-w-0"
    : "h-fit min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm";
  if (!selectedFile) {
    return (
      <aside className="h-fit min-w-0 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Параметры печати</p>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          Выберите файл в списке, чтобы настроить формат, цвет и количество копий.
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
      defaults: { ...settings.defaults, ...(changes.defaults ?? {}) },
      pageOverrides: changes.pageOverrides ?? settings.pageOverrides,
    };

    // JPG/JPEG/PNG не печатаются в двустороннем режиме (то же ограничение есть в app/page.tsx и на сервере).
    if (isImage) nextSettings.printSides = "one-sided";

    onPrintSettingsChange(selectedFile!.id, nextSettings);
  }

  function applyCurrentSettingsToAll() {
    onApplyToAll({
      ...settings,
      printSides: isImage ? "one-sided" : settings.printSides,
    });
  }

  return (
    <div className={shellClass}>
      {!isInline && (
      <>
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-wider text-blue-700">Параметры печати</p>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
          {getFileKindLabel(selectedFile)}
        </span>
      </div>

      <div className="mt-3 min-w-0 rounded-xl bg-slate-50 px-3 py-2">
        <p className="truncate font-bold text-slate-900" title={selectedFile.file.name}>
          {selectedFile.file.name}
        </p>
        <p className="text-xs text-slate-500">
          {selectedFile.status === "ready"
            ? `${selectedFile.pageCount ?? 0} стр.`
            : selectedFile.status === "analyzing"
              ? "Файл проверяется…"
              : "Не удалось проверить файл"}
        </p>
      </div>
      </>
      )}

      {!isReady && (
        <p className="mt-3 rounded-xl bg-amber-50 p-3 text-xs leading-5 text-amber-900">
          Параметры будут доступны после завершения проверки файла.
        </p>
      )}

      <fieldset disabled={!isReady} className={`${isInline ? "" : "mt-4"} grid min-w-0 gap-4 border-0 p-0 ${isInline ? "sm:grid-cols-2" : ""}`}>
        <Segmented
          label="Формат"
          value={settings.defaults.paperFormat}
          options={[
            { value: "A4", label: "A4" },
            { value: "A3", label: "A3 (×2)" },
          ]}
          onChange={(paperFormat) => changeSettings({ defaults: { ...settings.defaults, paperFormat } })}
        />

        <Segmented
          label="Цвет"
          value={settings.defaults.colorMode}
          options={[
            { value: "black-and-white", label: "Чёрно-белая" },
            { value: "color", label: "Цветная" },
          ]}
          onChange={(colorMode) => changeSettings({ defaults: { ...settings.defaults, colorMode } })}
        />

        <Segmented
          label="Стороны"
          value={settings.printSides}
          options={[
            { value: "one-sided", label: "Односторонняя" },
            { value: "two-sided", label: "Двусторонняя", disabled: isImage },
          ]}
          onChange={(printSides) => changeSettings({ printSides })}
        />

        <div className="flex items-center justify-between gap-3">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400">Количество</p>
          <CopiesInput
            key={selectedFile.id}
            value={settings.copies}
            disabled={!isReady}
            onChange={(copies) => changeSettings({ copies })}
          />
        </div>
      </fieldset>

      <p className="mt-3 text-xs leading-5 text-slate-500">
        {isImage
          ? "Изображения печатаются только односторонне."
          : "Двусторонняя печать уменьшает число листов, но не меняет цену страницы."}{" "}
        Цвет можно задать отдельно для страниц в предпросмотре.
      </p>

      {!isInline && (
      <div className="mt-4 flex items-center justify-between gap-4 rounded-xl bg-slate-900 px-4 py-3 text-white">
        <span className="text-sm text-slate-300">Стоимость файла</span>
        <span className="text-2xl font-black">{selectedFilePrice ?? 0} ₽</span>
      </div>
      )}

      <button
        type="button"
        disabled={!isReady}
        onClick={applyCurrentSettingsToAll}
        className="mt-3 w-full rounded-xl border border-blue-200 px-4 py-2.5 text-sm font-bold text-blue-700 transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:border-slate-200 disabled:text-slate-400"
      >
        Применить ко всем файлам
      </button>
    </div>
  );
}
