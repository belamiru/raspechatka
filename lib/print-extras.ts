import type { PaperFormat, PagePrintOption, PrintSides } from "@/lib/pricing";

/*
 * Дополнительные опции печати и их цены.
 *
 * Модуль общий для браузера и сервера: сумма, которую видит клиент, должна
 * совпадать с той, что посчитает /api/orders. Поэтому прайс живёт здесь,
 * а не в компонентах.
 */

export type PaperDensity = "80" | "120" | "250";
export type LaminationType = "none" | "matte" | "gloss";
export type LaminationThickness = "80" | "120";
export type CoverType = "transparent" | "leather";
export type StapleSide = "none" | "left" | "right";

export type PrintExtraOptions = {
  paper: PaperDensity;
  lamination: LaminationType;
  laminationThickness: LaminationThickness;
  binding: boolean;
  frontCover: CoverType;
  backCover: CoverType;
  staple: StapleSide;
};

export const DEFAULT_PRINT_EXTRA_OPTIONS: PrintExtraOptions = {
  paper: "80",
  lamination: "none",
  laminationThickness: "80",
  binding: false,
  frontCover: "transparent",
  backCover: "transparent",
  staple: "none",
};

/* Цена ламинации за лист, руб. Зависит от формата листа и плотности плёнки. */
export const LAMINATION_PRICE_PER_SHEET: Record<PaperFormat, Record<LaminationThickness, number>> = {
  A4: { "80": 85, "120": 95 },
  A3: { "80": 110, "120": 130 },
};

/* Переплёт на металлическую пружину — за документ, независимо от объёма. */
export const BINDING_PRICE = 100;

/* Каждая обложка при переплёте, руб. Прозрачная и тиснение стоят одинаково. */
export const COVER_PRICE = 50;

/* Скрепление степлером в углу, руб. */
export const STAPLE_PRICE = 10;

/*
 * Надбавка к тарифу печати за более плотную бумагу: 120 г/м² — +10%,
 * 250 г/м² — +20% к цене печати на 80 г/м².
 */
export const PAPER_SURCHARGE: Record<PaperDensity, number> = {
  "80": 0,
  "120": 0.1,
  "250": 0.2,
};

export type ExtrasPriceBreakdown = {
  /* Надбавка за плотную бумагу, руб. */
  paperSurcharge: number;
  /* Ламинация: цена за все листы с учётом копий, руб. */
  lamination: number;
  /* Сколько физических листов ламинируется (за одну копию). */
  laminationSheetsPerCopy: number;
  binding: number;
  covers: number;
  staple: number;
  total: number;
};

/*
 * Ламинируется физический лист, а не страница: при двусторонней печати две
 * страницы лежат на одном листе и плёнка нужна одна. Формат листа берём по
 * первой странице пары — так же лист выходит из печати.
 */
export function countLaminationSheets(
  pageOptions: PagePrintOption[],
  printSides: PrintSides
) {
  const sheets: Record<PaperFormat, number> = { A4: 0, A3: 0 };

  if (printSides === "two-sided") {
    for (let index = 0; index < pageOptions.length; index += 2) {
      sheets[pageOptions[index].paperFormat] += 1;
    }
    return sheets;
  }

  for (const page of pageOptions) {
    sheets[page.paperFormat] += 1;
  }

  return sheets;
}

/** Стоимость дополнительных опций для одного файла. */
export function getExtrasPrice({
  extras,
  pageOptions,
  printSides,
  copies,
  printPrice,
}: {
  extras: PrintExtraOptions;
  pageOptions: PagePrintOption[];
  printSides: PrintSides;
  copies: number;
  /* Стоимость печати файла без дополнительных опций. */
  printPrice: number;
}): ExtrasPriceBreakdown {
  const validCopies = Math.max(1, copies);

  const paperSurcharge = Math.round(printPrice * PAPER_SURCHARGE[extras.paper]);

  const sheetsPerCopy = countLaminationSheets(pageOptions, printSides);
  const laminationSheetsPerCopy = sheetsPerCopy.A4 + sheetsPerCopy.A3;

  const lamination =
    extras.lamination === "none"
      ? 0
      : (sheetsPerCopy.A4 * LAMINATION_PRICE_PER_SHEET.A4[extras.laminationThickness] +
          sheetsPerCopy.A3 * LAMINATION_PRICE_PER_SHEET.A3[extras.laminationThickness]) *
        validCopies;

  /* Пружина и обложки имеют смысл только вместе: передняя и задняя по 50 ₽. */
  const binding = extras.binding ? BINDING_PRICE : 0;
  const covers = extras.binding ? COVER_PRICE * 2 : 0;

  /* Степлер несовместим с переплётом. */
  const staple = !extras.binding && extras.staple !== "none" ? STAPLE_PRICE : 0;

  return {
    paperSurcharge,
    lamination,
    laminationSheetsPerCopy,
    binding,
    covers,
    staple,
    total: paperSurcharge + lamination + binding + covers + staple,
  };
}

/** Короткая подпись опций для карточки файла и админки. */
export function getExtrasSummary(extras: PrintExtraOptions) {
  const parts: string[] = [];

  if (extras.paper !== "80") parts.push(`Бумага ${extras.paper} г/м²`);
  if (extras.lamination !== "none") {
    parts.push(`Ламинация ${extras.lamination === "matte" ? "матовая" : "глянцевая"} ${extras.laminationThickness} мкр`);
  }
  if (extras.binding) parts.push("Переплёт на пружину");
  if (extras.staple !== "none") parts.push(`Степлер (${extras.staple === "left" ? "левый" : "правый"} угол)`);

  return parts.join(" · ");
}
