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
  const quantity = Math.max(1, pageCount * copies);

  const tier =
    PRICE_TIERS.find(
      (item) => item.to === null || (quantity >= item.from && quantity <= item.to)
    ) ?? PRICE_TIERS[0];

  const formatMultiplier = paperFormat === "A3" ? 2 : 1;
  const sidesMultiplier = printSides === "two-sided" ? 2 : 1;
  const priceMultiplier = formatMultiplier * sidesMultiplier;

  const baseUnitPrice = tier.a4OneSidedPrice;
  const effectiveUnitPrice = baseUnitPrice * priceMultiplier;
  const totalPrice = quantity * effectiveUnitPrice;

  return {
    quantity,
    tier,
    baseUnitPrice,
    effectiveUnitPrice,
    formatMultiplier,
    sidesMultiplier,
    priceMultiplier,
    totalPrice,
  };
}