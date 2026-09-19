import type { PaperFormat, PrintSides } from "@/lib/pricing";

export type ColorMode = "black-and-white" | "color";

export type PagePrintOverride = {
  pageNumber: number;
  included?: boolean;
  paperFormat?: PaperFormat;
};

export type FilePrintSettings = {
  copies: number;
  printSides: PrintSides;
  defaults: { paperFormat: PaperFormat; colorMode: ColorMode };
  pageOverrides: Record<number, PagePrintOverride>;
};

export const DEFAULT_PRINT_SETTINGS: FilePrintSettings = {
  copies: 1,
  printSides: "one-sided",
  defaults: { paperFormat: "A4", colorMode: "black-and-white" },
  pageOverrides: {},
};

export function getPrintablePageCount(pageCount: number, settings: FilePrintSettings) {
  return getPrintablePageFormats(pageCount, settings).length;
}

export function getPrintablePageFormats(pageCount: number, settings: FilePrintSettings) {
  return Array.from({ length: Math.max(0, pageCount) }, (_, index) => index + 1)
    .filter((pageNumber) => settings.pageOverrides[pageNumber]?.included !== false)
    .map((pageNumber) => settings.pageOverrides[pageNumber]?.paperFormat ?? settings.defaults.paperFormat);
}

export function getExcludedPages(settings: FilePrintSettings) {
  return Object.values(settings.pageOverrides)
    .filter((override) => override.included === false)
    .map((override) => override.pageNumber)
    .sort((a, b) => a - b);
}

export function getPagesWithFormat(settings: FilePrintSettings, paperFormat: PaperFormat) {
  return Object.values(settings.pageOverrides)
    .filter((override) => override.included !== false && override.paperFormat === paperFormat)
    .map((override) => override.pageNumber)
    .sort((a, b) => a - b);
}

export function getDraftSettingsStorageKey(draftId: string) {
  return `raspechatka:print-draft-settings:${draftId}`;
}


export function getPagePaperFormat(pageNumber: number, settings: FilePrintSettings) {
  return settings.pageOverrides[pageNumber]?.paperFormat ?? settings.defaults.paperFormat;
}

export function getPagesWithPaperFormat(
  pageCount: number,
  settings: FilePrintSettings,
  paperFormat: PaperFormat
) {
  return Array.from({ length: Math.max(0, pageCount) }, (_, index) => index + 1)
    .filter((pageNumber) =>
      settings.pageOverrides[pageNumber]?.included !== false &&
      getPagePaperFormat(pageNumber, settings) === paperFormat
    );
}
