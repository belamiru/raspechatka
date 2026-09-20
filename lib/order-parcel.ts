import type { PagePrintOverride } from "@/lib/print-settings";

export type ParcelItem = {
  pageCount: number;
  copies: number;
  printSides: "one-sided" | "two-sided";
  paperFormat: "A4" | "A3";
  pageOverrides: Record<number, PagePrintOverride>;
};

export type OrderParcel = {
  widthMm: number;
  lengthMm: number;
  heightMm: number;
  weightGrams: number;
  physicalSheetCount: number;
};

const PAPER = {
  A4: { widthMm: 210, lengthMm: 297, weightGrams: 4.9896 },
  A3: { widthMm: 297, lengthMm: 420, weightGrams: 9.9792 },
} as const;
const PACKAGING_MARGIN_MM = 30;
const PACKAGING_HEIGHT_MM = 10;
const PAPER_THICKNESS_MM = 0.104;
const PACKAGING_WEIGHT_GRAMS = 50;

type PaperFormat = keyof typeof PAPER;

function printablePageFormats(item: ParcelItem): PaperFormat[] {
  return Array.from({ length: item.pageCount }, (_, index) => index + 1)
    .filter((pageNumber) => item.pageOverrides[pageNumber]?.included !== false)
    .map((pageNumber) => item.pageOverrides[pageNumber]?.paperFormat ?? item.paperFormat);
}

function physicalSheetFormats(item: ParcelItem): PaperFormat[] {
  const pages = printablePageFormats(item);
  const sheets: PaperFormat[] = [];
  for (let copy = 0; copy < item.copies; copy += 1) {
    if (item.printSides === "one-sided") {
      sheets.push(...pages);
      continue;
    }
    for (let page = 0; page < pages.length; page += 2) {
      sheets.push(pages[page] === "A3" || pages[page + 1] === "A3" ? "A3" : "A4");
    }
  }
  return sheets;
}

/**
 * Parameters for a flat paper shipment. A3 wins for a two-sided sheet that
 * has A3 on either side; this is the agreed packaging rule for mixed formats.
 */
export function calculateOrderParcel(items: ParcelItem[]): OrderParcel | null {
  const sheets = items.flatMap(physicalSheetFormats);
  if (sheets.length === 0) return null;
  const largestFormat: PaperFormat = sheets.includes("A3") ? "A3" : "A4";
  const paperWeight = sheets.reduce((total, format) => total + PAPER[format].weightGrams, 0);
  return {
    widthMm: PAPER[largestFormat].widthMm + PACKAGING_MARGIN_MM,
    lengthMm: PAPER[largestFormat].lengthMm + PACKAGING_MARGIN_MM,
    heightMm: Math.ceil(PACKAGING_HEIGHT_MM + sheets.length * PAPER_THICKNESS_MM),
    weightGrams: Math.ceil(PACKAGING_WEIGHT_GRAMS + paperWeight),
    physicalSheetCount: sheets.length,
  };
}
