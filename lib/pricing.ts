export type PaperFormat = "A4" | "A3";
export type PrintSides = "one-sided" | "two-sided";

type PriceTier = {
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

/** Calculates an item with a potentially different A4/A3 format per printed page. */
export function getPrintPriceForPages({
  pageFormats,
  printSides,
  copies,
}: {
  pageFormats: PaperFormat[];
  printSides: PrintSides;
  copies: number;
}) {
  const printablePages = Math.max(1, pageFormats.length);
  const quantity = printablePages * Math.max(1, copies);
  const tier = PRICE_TIERS.find((item) => item.to === null || (quantity >= item.from && quantity <= item.to)) ?? PRICE_TIERS[0];
  const baseUnitPrice = tier.a4OneSidedPrice;
  const totalPrice = pageFormats.reduce(
    (total, paperFormat) => total + baseUnitPrice * (paperFormat === "A3" ? 2 : 1),
    0
  ) * Math.max(1, copies);
  const sheetsPerCopy = printSides === "two-sided" ? Math.ceil(printablePages / 2) : printablePages;

  return {
    quantity,
    tier,
    baseUnitPrice,
    effectiveUnitPrice: baseUnitPrice,
    formatMultiplier: 1,
    sidesMultiplier: 1,
    priceMultiplier: 1,
    totalPrice,
    sheetsPerCopy,
    physicalSheetQuantity: sheetsPerCopy * Math.max(1, copies),
    physicalSheetUnitPrice: baseUnitPrice * (printSides === "two-sided" ? 2 : 1),
  };
}
