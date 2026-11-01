export type PaperFormat = "A4" | "A3";

/*
 * Фотопечать 10×15 (A6) считается не по страницам, а по количеству отпечатков.
 * Ступени объёма задаёт типография; 300-й отпечаток уже идёт по нижней цене.
 */
/*
 * Форматы фотобумаги. Цена за отпечаток растёт от площади листа:
 * A5 — в 2,5 раза дороже 10×15, A4 — в 5 раз, A3 — вдвое дороже A4.
 * Матовая и глянцевая плёнка стоят одинаково, поэтому тип поверхности
 * на цену не влияет и в расчёте не участвует.
 */
export type PhotoFormat = "10x15" | "A5" | "A4" | "A3";

export const PHOTO_FORMATS: {
  id: PhotoFormat;
  label: string;
  note: string;
  /* Множитель к цене отпечатка 10×15. */
  multiplier: number;
}[] = [
  { id: "10x15", label: "10×15", note: "A6", multiplier: 1 },
  { id: "A5", label: "A5", note: "×2,5", multiplier: 2.5 },
  { id: "A4", label: "A4", note: "×5", multiplier: 5 },
  { id: "A3", label: "A3", note: "×10", multiplier: 10 },
];

export const DEFAULT_PHOTO_FORMAT: PhotoFormat = "10x15";

/** Множитель формата к цене отпечатка 10×15. */
export function getPhotoFormatMultiplier(format: PhotoFormat) {
  return PHOTO_FORMATS.find((item) => item.id === format)?.multiplier ?? 1;
}

/** Цена одного отпечатка в выбранном формате по тарифной ступени. */
export function getPhotoUnitPrice(tier: PhotoPriceTier, format: PhotoFormat) {
  /* Округляем вверх до рубля: полкопейки в чеке выглядели бы странно. */
  return Math.ceil(tier.pricePerPhoto * getPhotoFormatMultiplier(format));
}

export type PhotoPriceTier = {
  from: number;
  to: number | null;
  pricePerPhoto: number;
  label: string;
};

export const PHOTO_PRICE_TIERS: PhotoPriceTier[] = [
  { from: 1, to: 9, pricePerPhoto: 27, label: "1\u20139 фото" },
  { from: 10, to: 49, pricePerPhoto: 22, label: "10\u201349 фото" },
  { from: 50, to: 99, pricePerPhoto: 15, label: "50\u201399 фото" },
  { from: 100, to: 299, pricePerPhoto: 12, label: "100\u2013299 фото" },
  { from: 300, to: null, pricePerPhoto: 10, label: "\u043e\u0442 300 фото" },
];

/** Цена фотопечати за указанное количество отпечатков. */
export function getPhotoPriceForCount(
  quantity: number,
  format: PhotoFormat = DEFAULT_PHOTO_FORMAT
) {
  const validQuantity = Math.max(1, Math.floor(quantity));

  const tier =
    PHOTO_PRICE_TIERS.find(
      (item) =>
        item.to === null ||
        (validQuantity >= item.from && validQuantity <= item.to)
    ) ?? PHOTO_PRICE_TIERS[0];

  const unitPrice = getPhotoUnitPrice(tier, format);

  return {
    quantity: validQuantity,
    tier,
    format,
    unitPrice,
    totalPrice: validQuantity * unitPrice,
  };
}
export type PrintSides = "one-sided" | "two-sided";

/*
 * Широкоформатная печать считается по площади, а не по страницам: цена
 * зависит от материала и размера листа. Рулон ограничивает только ширину —
 * длина может быть любой, поэтому достаточно, чтобы одна сторона
 * укладывалась в лимит материала.
 */

export type PosterPaperId = "vatman-120" | "lokipix-135" | "lokipix-200" | "pvc-80";

export type PosterPaper = {
  id: PosterPaperId;
  label: string;
  /* Группа в интерфейсе: бумага без покрытия, постерная, плёнка. */
  group: string;
  note: string;
  pricePerSqm: number;
  /* Максимальная ширина рулона в миллиметрах. */
  maxWidthMm: number;
};

export const POSTER_PAPERS: PosterPaper[] = [
  {
    id: "vatman-120",
    label: "Ватман 120 г/м²",
    group: "Бумага без покрытия",
    note: "Матовая, для чертежей",
    pricePerSqm: 750,
    maxWidthMm: 914,
  },
  {
    id: "lokipix-135",
    label: "Lokipix 135 г/м²",
    group: "Постерная бумага",
    note: "Глянцевая, для постеров",
    pricePerSqm: 780,
    maxWidthMm: 1200,
  },
  {
    id: "lokipix-200",
    label: "Lokipix 200 г/м²",
    group: "Постерная бумага",
    note: "Плотная, не просвечивает",
    pricePerSqm: 820,
    maxWidthMm: 1200,
  },
  {
    id: "pvc-80",
    label: "ПВХ 80 мкр",
    group: "Самоклеящаяся плёнка",
    note: "Клеится на поверхность",
    pricePerSqm: 790,
    maxWidthMm: 1200,
  },
];

export const DEFAULT_POSTER_PAPER: PosterPaperId = "lokipix-135";

export function getPosterPaper(id: PosterPaperId) {
  return POSTER_PAPERS.find((item) => item.id === id) ?? POSTER_PAPERS[0];
}

export type PosterFormat = "A2" | "A1" | "A0" | "custom";

/* Стандартные форматы в миллиметрах, книжная ориентация. */
export const POSTER_FORMATS: { id: PosterFormat; label: string; note: string; widthMm: number; heightMm: number }[] = [
  { id: "A2", label: "A2", note: "420×594", widthMm: 420, heightMm: 594 },
  { id: "A1", label: "A1", note: "594×841", widthMm: 594, heightMm: 841 },
  { id: "A0", label: "A0", note: "841×1189", widthMm: 841, heightMm: 1189 },
  { id: "custom", label: "Свой размер", note: "Ш × В, мм", widthMm: 0, heightMm: 0 },
];

export function getPosterFormat(id: PosterFormat) {
  return POSTER_FORMATS.find((item) => item.id === id) ?? POSTER_FORMATS[0];
}

/* Минимальное разрешение для широкоформатной печати. */
export const POSTER_MIN_DPI = 150;

/* Минимальная сторона собственного размера: мельче печатать смысла нет. */
export const POSTER_MIN_SIDE_MM = 100;

/** Сколько пикселей нужно, чтобы отпечатать отрезок в `mm` миллиметров без потери резкости. */
export function mmToPixels(mm: number, dpi: number = POSTER_MIN_DPI) {
  return Math.ceil((mm / 25.4) * dpi);
}

/** Требуемый размер файла в пикселях для листа заданного размера. */
export function getRequiredPixels(widthMm: number, heightMm: number) {
  return {
    width: mmToPixels(widthMm),
    height: mmToPixels(heightMm),
  };
}

/** Проверка размера: хотя бы одна сторона должна укладываться в ширину рулона. */
export function validatePosterSize({
  widthMm,
  heightMm,
  maxWidthMm,
}: {
  widthMm: number;
  heightMm: number;
} & { maxWidthMm: number }):
  | { valid: true }
  | { valid: false; error: string } {
  if (!Number.isFinite(widthMm) || !Number.isFinite(heightMm) || widthMm <= 0 || heightMm <= 0) {
    return { valid: false, error: "Укажите ширину и высоту в миллиметрах." };
  }

  if (widthMm < POSTER_MIN_SIDE_MM || heightMm < POSTER_MIN_SIDE_MM) {
    return { valid: false, error: `Минимальный размер — ${POSTER_MIN_SIDE_MM} мм по каждой стороне.` };
  }

  if (Math.min(widthMm, heightMm) > maxWidthMm) {
    return {
      valid: false,
      error: `Хотя бы одна сторона должна быть не больше ${maxWidthMm} мм — это ширина рулона.`,
    };
  }

  return { valid: true };
}

/** Стоимость широкоформатной печати: площадь × цена материала × копии. */
export function getPosterPrice({
  widthMm,
  heightMm,
  pricePerSqm,
  copies = 1,
}: {
  widthMm: number;
  heightMm: number;
  pricePerSqm: number;
  copies?: number;
}) {
  const validCopies = Math.max(1, copies);
  const areaSqm = (widthMm / 1000) * (heightMm / 1000);

  /* Округляем вверх до рубля: сумма в чеке должна быть целой. */
  const unitPrice = Math.ceil(areaSqm * pricePerSqm);

  return {
    areaSqm,
    unitPrice,
    copies: validCopies,
    totalPrice: unitPrice * validCopies,
  };
}

export type PriceTier = {
  from: number;
  to: number | null;
  a4OneSidedPrice: number;
  label: string;
};

const PRICE_TIERS: PriceTier[] = [
  {
    from: 1,
    to: 10,
    a4OneSidedPrice: 20,
    label: "1–10 страниц",
  },
  {
    from: 11,
    to: 25,
    a4OneSidedPrice: 18,
    label: "11–25 страниц",
  },
  {
    from: 26,
    to: 75,
    a4OneSidedPrice: 16,
    label: "26–75 страниц",
  },
  {
    from: 76,
    to: 200,
    a4OneSidedPrice: 14,
    label: "76–200 страниц",
  },
  {
    from: 201,
    to: 500,
    a4OneSidedPrice: 11,
    label: "201–500 страниц",
  },
  {
    from: 501,
    to: null,
    a4OneSidedPrice: 8,
    label: "от 501 страницы",
  },
];

export const PRINT_PRICE_TIERS = PRICE_TIERS;

export function getPrintPrice({
  paperFormat,
  printSides,
  pageCount,
  copies,
}: {
  paperFormat: PaperFormat;
  printSides: PrintSides;
  pageCount: number;
  copies: number;
}) {
  /*
   * quantity — число печатаемых сторон, то есть страниц с учётом копий.
   * Именно оно определяет объёмную скидку и итоговую стоимость.
   *
   * Двусторонняя печать не должна повышать стоимость: лист стоит в два раза
   * дороже, но вмещает две печатаемые стороны. Поэтому цена каждой страницы
   * остаётся той же, что и при односторонней печати.
   */
  const quantity = Math.max(1, pageCount * copies);

  const tier =
    PRICE_TIERS.find(
      (item) =>
        item.to === null ||
        (quantity >= item.from && quantity <= item.to)
    ) ?? PRICE_TIERS[0];

  const formatMultiplier = paperFormat === "A3" ? 2 : 1;
  const sidesMultiplier = 1;
  const priceMultiplier = formatMultiplier;

  const baseUnitPrice = tier.a4OneSidedPrice;
  const effectiveUnitPrice = baseUnitPrice * formatMultiplier;
  const totalPrice = quantity * effectiveUnitPrice;

  /*
   * Физические листы важны для производства и отображения в админке,
   * но не влияют на итоговую сумму при текущей политике цен.
   *
   * Например, 5-страничный PDF в двухстороннем режиме:
   * 5 печатаемых сторон → 3 физических листа на одну копию.
   */
  const sheetsPerCopy =
    printSides === "two-sided"
      ? Math.ceil(pageCount / 2)
      : pageCount;

  const physicalSheetQuantity = Math.max(1, sheetsPerCopy * copies);

  /*
   * Справочная цена физического листа:
   * - односторонний лист содержит одну печатаемую сторону;
   * - двухсторонний лист содержит две стороны, поэтому стоит ×2.
   *
   * physicalSheetQuantity × physicalSheetUnitPrice всегда соответствует
   * totalPrice для чётного числа страниц. Для нечётного числа страниц
   * последний лист используется с одной стороны, но цена заказа всё равно
   * считается по количеству печатаемых страниц.
   */
  const physicalSheetUnitPrice =
    effectiveUnitPrice * (printSides === "two-sided" ? 2 : 1);

  return {
    /*
     * Сохраняем прежние поля, чтобы не сломать текущий серверный код.
     * quantity — печатаемые стороны / страницы с учётом копий.
     */
    quantity,
    tier,
    baseUnitPrice,
    effectiveUnitPrice,
    formatMultiplier,
    sidesMultiplier,
    priceMultiplier,
    totalPrice,

    /*
     * Новые поля для интерфейса и админки.
     */
    sheetsPerCopy,
    physicalSheetQuantity,
    physicalSheetUnitPrice,
  };
}

export type PrintColorMode = "black-and-white" | "color";
/** Old orders could retain this value; it is normalized to ordinary color. */
type LegacyPrintColorMode = PrintColorMode | "solid-color";
export type PagePrintOption = { paperFormat: PaperFormat; colorMode: LegacyPrintColorMode };

export type ColorPriceTier = PriceTier & { colorA4: number };

/*
 * All print categories use the same volume breaks as black-and-white printing.
 * A3 remains exactly twice the A4 price. Keep these ranges in sync with
 * PRICE_TIERS and the public tables on the home page.
 */
/*
 * Тарифы цветной печати публикуются на /prices, поэтому список экспортируется.
 * Любое изменение здесь сразу меняет и калькулятор, и страницу цен.
 */
export const COLOR_PRICE_TIERS: ColorPriceTier[] = [
  { from: 1, to: 10, a4OneSidedPrice: 20, colorA4: 40, label: "1–10 страниц" },
  { from: 11, to: 25, a4OneSidedPrice: 18, colorA4: 36, label: "11–25 страниц" },
  { from: 26, to: 75, a4OneSidedPrice: 16, colorA4: 32, label: "26–75 страниц" },
  { from: 76, to: 200, a4OneSidedPrice: 14, colorA4: 28, label: "76–200 страниц" },
  { from: 201, to: 500, a4OneSidedPrice: 11, colorA4: 22, label: "201–500 страниц" },
  { from: 501, to: null, a4OneSidedPrice: 8, colorA4: 16, label: "от 501 страницы" },
];

/** Calculates an item with per-page format and colour categories. */
export function getPrintPriceForPages({ pageOptions, printSides, copies }: {
  pageOptions: PagePrintOption[];
  printSides: PrintSides;
  copies: number;
}) {
  const printablePages = Math.max(1, pageOptions.length);
  const validCopies = Math.max(1, copies);
  const quantity = printablePages * validCopies;
  const tier = COLOR_PRICE_TIERS.find((item) => item.to === null || (quantity >= item.from && quantity <= item.to)) ?? COLOR_PRICE_TIERS[0];
  const priceForPage = ({ paperFormat, colorMode }: PagePrintOption) => {
    const a4Price = colorMode === "black-and-white" ? tier.a4OneSidedPrice : tier.colorA4;
    return a4Price * (paperFormat === "A3" ? 2 : 1);
  };
  const totalPrice = pageOptions.reduce((total, page) => total + priceForPage(page), 0) * validCopies;
  const sheetsPerCopy = printSides === "two-sided" ? Math.ceil(printablePages / 2) : printablePages;
  return { quantity, tier, baseUnitPrice: tier.a4OneSidedPrice, effectiveUnitPrice: tier.a4OneSidedPrice, formatMultiplier: 1, sidesMultiplier: 1, priceMultiplier: 1, totalPrice, sheetsPerCopy, physicalSheetQuantity: sheetsPerCopy * validCopies, physicalSheetUnitPrice: tier.a4OneSidedPrice * (printSides === "two-sided" ? 2 : 1) };
}
