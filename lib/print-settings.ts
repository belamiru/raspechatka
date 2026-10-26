import type { PaperFormat, PrintColorMode, PrintSides, PagePrintOption } from "@/lib/pricing";

export type ColorMode = PrintColorMode;
export type PagePrintOverride = { pageNumber: number; included?: boolean; paperFormat?: PaperFormat; colorMode?: ColorMode };
export type FilePrintSettings = { copies: number; printSides: PrintSides; defaults: { paperFormat: PaperFormat; colorMode: ColorMode }; pageOverrides: Record<number, PagePrintOverride> };
export const DEFAULT_PRINT_SETTINGS: FilePrintSettings = { copies: 1, printSides: "one-sided", defaults: { paperFormat: "A4", colorMode: "black-and-white" }, pageOverrides: {} };
export function getPagePaperFormat(pageNumber: number, settings: FilePrintSettings) { return settings.pageOverrides[pageNumber]?.paperFormat ?? settings.defaults.paperFormat; }
export function getPageColorMode(pageNumber: number, settings: FilePrintSettings): PrintColorMode { const value = settings.pageOverrides[pageNumber]?.colorMode ?? settings.defaults.colorMode; /* В настройках, сохранённых в браузере до отказа от «заливки», может остаться это значение. */ return (value as string) === "solid-color" ? "color" : value; }
export function getPrintablePageOptions(pageCount: number, settings: FilePrintSettings): PagePrintOption[] { return Array.from({ length: Math.max(0, pageCount) }, (_, index) => index + 1).filter((pageNumber) => settings.pageOverrides[pageNumber]?.included !== false).map((pageNumber) => ({ paperFormat: getPagePaperFormat(pageNumber, settings), colorMode: getPageColorMode(pageNumber, settings) })); }
export function getPrintablePageCount(pageCount: number, settings: FilePrintSettings) { return getPrintablePageOptions(pageCount, settings).length; }
export function getExcludedPages(settings: FilePrintSettings) { return Object.values(settings.pageOverrides).filter((item) => item.included === false).map((item) => item.pageNumber).sort((a,b) => a-b); }
export function getPagesWithFormat(settings: FilePrintSettings, paperFormat: PaperFormat) { return Object.values(settings.pageOverrides).filter((item) => item.included !== false && item.paperFormat === paperFormat).map((item) => item.pageNumber).sort((a,b) => a-b); }
export function getPagesWithColorMode(settings: FilePrintSettings, colorMode: ColorMode) { return Object.values(settings.pageOverrides).filter((item) => item.included !== false && item.colorMode === colorMode).map((item) => item.pageNumber).sort((a,b) => a-b); }
export function getDraftSettingsStorageKey(draftId: string) { return `raspechatka:print-draft-settings:${draftId}`; }

export const MAX_COPIES = 1000;

/** Приводит количество копий к целому числу в допустимом диапазоне 1–MAX_COPIES. */
export function clampCopies(value: number) {
  if (!Number.isFinite(value)) return 1;
  return Math.min(MAX_COPIES, Math.max(1, Math.trunc(value)));
}

/**
 * Очищает то, что пользователь печатает в поле «Количество»: оставляет только цифры
 * (не больше четырёх) и сообщает, можно ли применять значение сразу.
 * value === null означает «пока не применять» (пусто, 0 или больше лимита): такое
 * значение исправляется после выхода из поля.
 */
export function parseCopiesDraft(raw: string): { draft: string; value: number | null } {
  const draft = raw.replace(/\D/g, "").slice(0, 4);
  if (draft === "") return { draft, value: null };
  const parsed = Number(draft);
  return { draft, value: parsed >= 1 && parsed <= MAX_COPIES ? parsed : null };
}
