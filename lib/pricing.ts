export type PaperFormat = "A4" | "A3";

/*
 * Фотопечать 10×15 (A6) считается не по страницам, а по количеству отпечатков.
 * Ступени объёма задаёт типография; 300-й отпечаток уже идёт по нижней цене.
 */
export type PhotoSize = "10x15";

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
export function getPhotoPriceForCount(quantity: number) {
  const validQuantity = Math.max(1, Math.floor(quantity));

  const tier =
    PHOTO_PRICE_TIERS.find(
      (item) =>
        item.to === null ||
        (validQuantity >= item.from && validQuantity <= item.to)
    ) ?? PHOTO_PRICE_TIERS[0];

  return {
    quantity: validQuantity,
    tier,
    unitPrice: tier.pricePerPhoto,
    totalPrice: validQuantity * tier.pricePerPhoto,
  };
}
export type PrintSides = "one-sided" | "two-sided";

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
