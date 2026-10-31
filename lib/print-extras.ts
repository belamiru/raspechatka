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

/*
 * Обложки при переплёте. Их может не быть вовсе, только передняя или только
 * задняя — раньше пара была обязательной, и это расходилось с реальными заказами.
 */
export type CoverSet = "none" | "front" | "back" | "both";

/* Как вписать снимок в лист фотобумаги. */
export type PhotoFit = "crop" | "contain";
export type StapleSide = "none" | "left" | "right";

export type PrintExtraOptions = {
  paper: PaperDensity;
  lamination: LaminationType;
  laminationThickness: LaminationThickness;
  binding: boolean;
  coverSet: CoverSet;
  frontCover: CoverType;
  backCover: CoverType;
  staple: StapleSide;
  /* Влияет только на фотопечать, для документов игнорируется. */
  photoFit: PhotoFit;
};

export const DEFAULT_PRINT_EXTRA_OPTIONS: PrintExtraOptions = {
  paper: "80",
  lamination: "none",
  laminationThickness: "80",
  binding: false,
  coverSet: "none",
  frontCover: "transparent",
  backCover: "transparent",
  staple: "none",
  photoFit: "crop",
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
 * Фотопечать считается отдельно от «страниц»: цена зависит от числа отпечатков.
 * Возвращаем разбивку в том же виде, чтобы UI не ветвился.
 */
export function getPhotoExtrasPrice({
  quantity,
  unitPrice,
}: {
  quantity: number;
  unitPrice: number;
}) {
  return {
    quantity,
    unitPrice,
    total: quantity * unitPrice,
  };
}

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

  /*
   * Пружина нужна всегда, когда включён переплёт. Обложек может быть ноль,
   * одна (передняя или задняя) или две — считается каждая по отдельности.
   */
  const binding = extras.binding ? BINDING_PRICE : 0;
  const coverCount =
    !extras.binding || extras.coverSet === "none"
      ? 0
      : extras.coverSet === "both"
        ? 2
        : 1;
  const covers = coverCount * COVER_PRICE;

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
  if (extras.binding) {
    const covers =
      extras.coverSet === "both"
        ? "две обложки"
        : extras.coverSet === "front"
          ? "передняя обложка"
          : extras.coverSet === "back"
            ? "задняя обложка"
            : "без обложек";
    parts.push(`Переплёт на пружину (${covers})`);
  }
  if (extras.staple !== "none") parts.push(`Степлер (${extras.staple === "left" ? "левый" : "правый"} угол)`);

  return parts.join(" · ");
}
