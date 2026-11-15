import { getPhotoPriceForCount, getPosterPaper, getPosterPrice, getPrintPriceForPages, type PrintSides } from "@/lib/pricing";
import { DEFAULT_PRINT_EXTRA_OPTIONS, getExtrasPrice, type PrintExtraOptions } from "@/lib/print-extras";
import { getPrintablePageOptions, type FilePrintSettings } from "@/lib/print-settings";

export type OrderPrintKind = "document" | "photo" | "poster";

// Hidden options from the previous mode must never silently affect a new mode.
export function extrasForKind(kind: OrderPrintKind, extras: PrintExtraOptions): PrintExtraOptions {
  if (kind === "document") {
    return {
      ...DEFAULT_PRINT_EXTRA_OPTIONS,
      paper: extras.paper,
      lamination: extras.lamination,
      laminationThickness: extras.laminationThickness,
      binding: extras.binding,
      coverSet: extras.coverSet,
      frontCover: extras.frontCover,
      backCover: extras.backCover,
      staple: extras.staple,
    };
  }
  if (kind === "photo") return { ...DEFAULT_PRINT_EXTRA_OPTIONS, photoFormat: extras.photoFormat, photoFit: extras.photoFit };
  return { ...DEFAULT_PRINT_EXTRA_OPTIONS, posterPaper: extras.posterPaper, posterFormat: extras.posterFormat,
    posterWidthMm: extras.posterWidthMm, posterHeightMm: extras.posterHeightMm };
}

/** Persist only options that belong to the selected print mode. */
export function serializeOrderExtras(
  kind: OrderPrintKind,
  extras: PrintExtraOptions,
  colorMode: "black-and-white" | "color"
) {
  const selected = extrasForKind(kind, extras);

  if (kind === "photo") {
    return { printKind: kind, colorMode, photoFormat: selected.photoFormat, photoFit: selected.photoFit };
  }

  if (kind === "poster") {
    return {
      printKind: kind,
      colorMode,
      posterPaper: selected.posterPaper,
      posterFormat: selected.posterFormat,
      posterWidthMm: selected.posterWidthMm,
      posterHeightMm: selected.posterHeightMm,
      lamination: selected.lamination,
      laminationThickness: selected.laminationThickness,
    };
  }

  return {
    printKind: kind,
    colorMode,
    paper: selected.paper,
    lamination: selected.lamination,
    laminationThickness: selected.laminationThickness,
    binding: selected.binding,
    coverSet: selected.coverSet,
    frontCover: selected.frontCover,
    backCover: selected.backCover,
    staple: selected.staple,
  };
}

export function priceOrderItem({ kind, pageCount, settings, extras }: {
  kind: OrderPrintKind; pageCount: number; settings: FilePrintSettings; extras: PrintExtraOptions;
}) {
  const options = getPrintablePageOptions(pageCount, kind === "document" ? settings : { ...settings, pageOverrides: {} });
  const selectedExtras = extrasForKind(kind, extras);
  const sides: PrintSides = kind === "document" ? settings.printSides : "one-sided";
  const pricing = getPrintPriceForPages({ pageOptions: options, copies: settings.copies, printSides: sides });
  // Each included page printed as a photo or poster is a separate physical print.
  const sheets = options.length * settings.copies;
  if (kind === "photo") {
    const photo = getPhotoPriceForCount(sheets, selectedExtras.photoFormat);
    Object.assign(pricing, { totalPrice: photo.totalPrice, effectiveUnitPrice: photo.unitPrice,
      quantity: sheets, physicalSheetQuantity: sheets, sheetsPerCopy: options.length });
  } else if (kind === "poster") {
    const poster = getPosterPrice({ widthMm: selectedExtras.posterWidthMm, heightMm: selectedExtras.posterHeightMm,
      pricePerSqm: getPosterPaper(selectedExtras.posterPaper).pricePerSqm, copies: sheets });
    Object.assign(pricing, { totalPrice: poster.totalPrice, quantity: sheets, physicalSheetQuantity: sheets,
      sheetsPerCopy: options.length, effectiveUnitPrice: sheets ? poster.totalPrice / sheets : 0 });
  }
  const extrasPricing = getExtrasPrice({ extras: selectedExtras, pageOptions: options, printSides: sides,
    copies: settings.copies, printPrice: pricing.totalPrice });
  return { pricing, extrasPricing, extras: selectedExtras, printablePages: options.length };
}
