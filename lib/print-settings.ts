import type { PaperFormat, PrintColorMode, PrintSides, PagePrintOption } from "@/lib/pricing";

export type ColorMode = PrintColorMode;
export type PagePrintOverride = { pageNumber: number; included?: boolean; paperFormat?: PaperFormat; colorMode?: ColorMode };
export type FilePrintSettings = { copies: number; printSides: PrintSides; defaults: { paperFormat: PaperFormat; colorMode: ColorMode }; pageOverrides: Record<number, PagePrintOverride> };
export const DEFAULT_PRINT_SETTINGS: FilePrintSettings = { copies: 1, printSides: "one-sided", defaults: { paperFormat: "A4", colorMode: "black-and-white" }, pageOverrides: {} };
export function getPagePaperFormat(pageNumber: number, settings: FilePrintSettings) { return settings.pageOverrides[pageNumber]?.paperFormat ?? settings.defaults.paperFormat; }
export function getPageColorMode(pageNumber: number, settings: FilePrintSettings) { return settings.pageOverrides[pageNumber]?.colorMode ?? settings.defaults.colorMode; }
export function getPrintablePageOptions(pageCount: number, settings: FilePrintSettings): PagePrintOption[] { return Array.from({ length: Math.max(0, pageCount) }, (_, index) => index + 1).filter((pageNumber) => settings.pageOverrides[pageNumber]?.included !== false).map((pageNumber) => ({ paperFormat: getPagePaperFormat(pageNumber, settings), colorMode: getPageColorMode(pageNumber, settings) })); }
export function getPrintablePageCount(pageCount: number, settings: FilePrintSettings) { return getPrintablePageOptions(pageCount, settings).length; }
export function getExcludedPages(settings: FilePrintSettings) { return Object.values(settings.pageOverrides).filter((item) => item.included === false).map((item) => item.pageNumber).sort((a,b) => a-b); }
export function getPagesWithFormat(settings: FilePrintSettings, paperFormat: PaperFormat) { return Object.values(settings.pageOverrides).filter((item) => item.included !== false && item.paperFormat === paperFormat).map((item) => item.pageNumber).sort((a,b) => a-b); }
export function getPagesWithColorMode(settings: FilePrintSettings, colorMode: ColorMode) { return Object.values(settings.pageOverrides).filter((item) => item.included !== false && item.colorMode === colorMode).map((item) => item.pageNumber).sort((a,b) => a-b); }
export function getDraftSettingsStorageKey(draftId: string) { return `raspechatka:print-draft-settings:${draftId}`; }
