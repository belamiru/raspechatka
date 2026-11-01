import type { PagePrintOverride } from "@/lib/print-settings";
import type { PhotoFormat, PosterPaperId } from "@/lib/pricing";
import type { PrintExtraOptions } from "@/lib/print-extras";

/*
 * ============================================================================
 * ФОРМИРОВАНИЕ ГАБАРИТОВ ПОСЫЛКИ
 * ============================================================================
 *
 * Здесь описаны все правила упаковки. Если правила меняются — правьте только
 * этот файл: остальной код читает результат и ничего не досчитывает сам.
 *
 * Заказ может содержать файлы трёх видов, и упаковываются они по-разному:
 *
 *   1. Документы и фотографии — плоская стопка в пакете или коробке.
 *      Документы и фото можно класть в одно грузоместо.
 *
 *   2. Плакаты — рулон (тубус). Плакаты НИКОГДА не кладутся в одно место
 *      с плоской стопкой: тубус помнёт бумагу. Поэтому плакаты всегда
 *      образуют отдельные грузоместа.
 *
 *   3. Один заказ может дать несколько грузомест: например, документы плюс
 *      два тубуса, если плакатов много.
 *
 * Ниже — конкретные правила по каждому виду.
 */

/* ---------------------------------------------------------------------------
 * РАЗМЕРЫ ЛИСТОВ
 *
 * Миллиметры, книжная ориентация (короткая сторона × длинная сторона).
 * Значения используются и для плоской упаковки, и для расчёта длины тубуса.
 * ------------------------------------------------------------------------- */
const SHEET_MM = {
  A6: { shortMm: 105, longMm: 148 },
  "10x15": { shortMm: 100, longMm: 150 },
  A5: { shortMm: 148, longMm: 210 },
  A4: { shortMm: 210, longMm: 297 },
  A3: { shortMm: 297, longMm: 420 },
  A2: { shortMm: 420, longMm: 594 },
  A1: { shortMm: 594, longMm: 841 },
  A0: { shortMm: 841, longMm: 1189 },
} as const;

type FlatFormat = "A4" | "A3";

/* ---------------------------------------------------------------------------
 * ПЛОСКАЯ УПАКОВКА: ДОКУМЕНТЫ И ФОТОГРАФИИ
 *
 * Правило (согласовано):
 *   - ширина  = ширина самого большого листа в заказе + 10 мм на упаковку;
 *   - длина   = длина самого большого листа в заказе + 10 мм на упаковку;
 *   - высота  = толщина стопки + 10 мм упаковки, где толщина стопки
 *               увеличена на 10% на погрешность (листы не прилегают идеально).
 *
 * Толщина листа зависит от плотности бумаги: 80 / 120 / 250 г/м².
 * Значения — справочные, при смене поставщика бумаги их можно уточнить.
 * ------------------------------------------------------------------------- */
const PAPER_THICKNESS_MM: Record<"80" | "120" | "250", number> = {
  "80": 0.104,
  "120": 0.15,
  "250": 0.3,
};

/* Припуск на упаковку: по 10 мм с каждой стороны (ширина и длина). */
const FLAT_PACKAGING_MARGIN_MM = 10;

/* Плоская упаковка: пакет или коробка поверх стопки. */
const FLAT_PACKAGING_HEIGHT_MM = 10;

/* Запас на погрешность высоты стопки: +10%. */
const STACK_TOLERANCE = 1.1;

/* Вес упаковки плоского места (пакет/коробка), граммы. */
const FLAT_PACKAGING_WEIGHT_GRAMS = 50;

/* Вес одного листа по площади: A4 80 г/м² ≈ 5 г. */
const PAPER_GRAM_PER_SQM: Record<"80" | "120" | "250", number> = {
  "80": 80,
  "120": 120,
  "250": 250,
};

/* ---------------------------------------------------------------------------
 * ТУБУС ДЛЯ ПЛАКАТОВ
 *
 * Правило (согласовано):
 *   - диаметр тубуса всегда 90 мм → ширина и высота места = 90 мм;
 *   - длина тубуса = короткая сторона плаката + 20 мм (по 10 мм с каждого края).
 *
 * Для стандартных форматов длина получается такой:
 *   A2 → 420 + 20 = 440 мм
 *   A1 → 594 + 20 = 614 мм
 *   A0 → 841 + 20 = 861 мм
 *
 * Для произвольного размера правило другое:
 *   - если короткая сторона меньше 841 мм (то есть меньше A0), тубус берётся
 *     из ближайшего стандартного размера A2 / A1 / A0 — так на складе не надо
 *     держать нестандартные тубы;
 *   - если короткая сторона 841 мм и больше, туба хватает только под реальный
 *     размер: длина = короткая сторона + 20 мм.
 * ------------------------------------------------------------------------- */
const TUBE_DIAMETER_MM = 90;
const TUBE_LENGTH_MARGIN_MM = 20;

/* Длины тубуса для стандартных форматов — используются как «полки» при подборе. */
const TUBE_LENGTHS_MM = {
  A2: SHEET_MM.A2.shortMm + TUBE_LENGTH_MARGIN_MM,
  A1: SHEET_MM.A1.shortMm + TUBE_LENGTH_MARGIN_MM,
  A0: SHEET_MM.A0.shortMm + TUBE_LENGTH_MARGIN_MM,
} as const;

/*
 * Вес плаката в тубусе.
 * Согласовано: A2 — 100 г, A1 — 150 г, A0 и больше — 200 г.
 * Плюс сам тубус: он весит примерно 150 г и не зависит от длины,
 * поэтому прибавляется отдельно к весу места.
 */
const TUBE_WEIGHT_GRAMS = 150;
const POSTER_WEIGHT_GRAMS = {
  A2: 100,
  A1: 150,
  /* A0 и всё, что больше */
  A0: 200,
} as const;

/*
 * Ограничения одного грузоместа с плакатами:
 *   - не больше 5 плакатов в тубе;
 *   - либо общая длина плакатов не больше 5000 мм (5 метров).
 * Что наступит раньше — то и закрывает место.
 */
const MAX_POSTERS_PER_PLACE = 5;
const MAX_POSTERS_LENGTH_MM = 5000;

/* ---------------------------------------------------------------------------
 * ТИПЫ
 * ------------------------------------------------------------------------- */

export type ParcelItemKind = "document" | "photo" | "poster";

export type ParcelItem = {
  kind: ParcelItemKind;
  pageCount: number;
  copies: number;
  printSides: "one-sided" | "two-sided";
  paperFormat: FlatFormat;
  pageOverrides: Record<number, PagePrintOverride>;
  /* Плотность бумаги: влияет на толщину стопки и вес. */
  paper: "80" | "120" | "250";
  /* Только для фотопечати. */
  photoFormat?: PhotoFormat;
  /* Только для плакатов. */
  poster?: {
    paperId: PosterPaperId;
    /* Реальный размер листа в миллиметрах, как его ввёл пользователь. */
    widthMm: number;
    heightMm: number;
  };
};

/** Одно грузоместо: то, что физически поедет одной коробкой или тубой. */
export type ParcelPlace = {
  kind: "flat" | "tube";
  widthMm: number;
  lengthMm: number;
  heightMm: number;
  weightGrams: number;
  /* Сколько листов или плакатов внутри — для админки и накладной. */
  items: number;
};

export type OrderParcel = {
  /* Все места заказа. Одно место — самый частый случай. */
  places: ParcelPlace[];
  /*
   * Габариты для служб доставки, которые принимают только одну посылку.
   * Берём максимум по каждому измерению и суммарный вес: так стоимость
   * не занижается. Яндекс Доставка получает все места отдельно.
   */
  widthMm: number;
  lengthMm: number;
  heightMm: number;
  weightGrams: number;
  physicalSheetCount: number;
};

/* ---------------------------------------------------------------------------
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 * ------------------------------------------------------------------------- */

/** Форматы всех печатаемых страниц файла с учётом исключённых страниц. */
function printablePageFormats(item: ParcelItem): FlatFormat[] {
  return Array.from({ length: item.pageCount }, (_, index) => index + 1)
    .filter((pageNumber) => item.pageOverrides[pageNumber]?.included !== false)
    .map((pageNumber) => item.pageOverrides[pageNumber]?.paperFormat ?? item.paperFormat);
}

/**
 * Физические листы файла.
 *
 * При двусторонней печати две страницы лежат на одном листе, поэтому лист
 * получает формат большей из двух страниц. Копии умножают число листов.
 */
function physicalSheetFormats(item: ParcelItem): FlatFormat[] {
  const pages = printablePageFormats(item);
  const sheets: FlatFormat[] = [];

  for (let copy = 0; copy < Math.max(1, item.copies); copy += 1) {
    if (item.printSides === "one-sided") {
      sheets.push(...pages);
      continue;
    }

    for (let page = 0; page < pages.length; page += 2) {
      sheets.push(
        pages[page] === "A3" || pages[page + 1] === "A3" ? "A3" : "A4"
      );
    }
  }

  return sheets;
}

/** Площадь листа в квадратных метрах — для расчёта веса бумаги. */
function sheetAreaSqm(format: FlatFormat) {
  const sheet = SHEET_MM[format];
  return (sheet.shortMm / 1000) * (sheet.longMm / 1000);
}

/**
 * Длина тубуса для плаката.
 *
 * Стандартный формат (A2 / A1 / A0) — фиксированная длина из таблицы.
 * Произвольный размер подбирается по короткой стороне: до A0 округляем
 * вверх до ближайшего стандартного тубуса, от A0 — режем под реальный размер.
 */
export function getTubeLengthMm({
  widthMm,
  heightMm,
}: {
  widthMm: number;
  heightMm: number;
}) {
  const shortSideMm = Math.min(widthMm, heightMm);
  const standardLength = shortSideMm + TUBE_LENGTH_MARGIN_MM;

  /* Ровно стандартный формат — берём готовую длину. */
  if (shortSideMm <= SHEET_MM.A2.shortMm) {
    return TUBE_LENGTHS_MM.A2;
  }
  if (shortSideMm <= SHEET_MM.A1.shortMm) {
    return TUBE_LENGTHS_MM.A1;
  }
  if (shortSideMm <= SHEET_MM.A0.shortMm) {
    return TUBE_LENGTHS_MM.A0;
  }

  /* Больше A0 — только реальный размер. */
  return standardLength;
}

/** Вес одного плаката по его формату: A2, A1, A0 и больше. */
export function getPosterWeightGrams({
  widthMm,
  heightMm,
}: {
  widthMm: number;
  heightMm: number;
}) {
  const shortSideMm = Math.min(widthMm, heightMm);

  if (shortSideMm <= SHEET_MM.A2.shortMm) return POSTER_WEIGHT_GRAMS.A2;
  if (shortSideMm <= SHEET_MM.A1.shortMm) return POSTER_WEIGHT_GRAMS.A1;
  return POSTER_WEIGHT_GRAMS.A0;
}

/**
 * Размеры листа фотобумаги. Фото печатается целиком, поэтому берём
 * максимальные габариты выбранного формата.
 */
function photoSheetMm(format: PhotoFormat = "10x15") {
  return SHEET_MM[format as keyof typeof SHEET_MM] ?? SHEET_MM["10x15"];
}

/* ---------------------------------------------------------------------------
 * ПЛОСКОЕ ГРУЗОМЕСТО: ДОКУМЕНТЫ И ФОТО
 * ------------------------------------------------------------------------- */

/**
 * Одно плоское место на все документы и фотографии заказа.
 *
 * Высота складывается из толщины листов: документы берут толщину своей
 * плотности, фото — фиксированную толщину фотобумаги. Сумма умножается на
 * 1.1 (погрешность укладки) и дополняется 10 мм упаковки.
 */
function buildFlatPlace(items: ParcelItem[]): ParcelPlace | null {
  let maxShortMm = 0;
  let maxLongMm = 0;
  let stackHeightMm = 0;
  let sheetCount = 0;
  let paperWeightGrams = 0;

  for (const item of items) {
    if (item.kind === "photo") {
      const sheet = photoSheetMm(item.photoFormat);
      maxShortMm = Math.max(maxShortMm, sheet.shortMm);
      maxLongMm = Math.max(maxLongMm, sheet.longMm);

      /* Фотография печатается по одной на лист: копии = листы. */
      const photos = Math.max(1, item.copies);
      sheetCount += photos;
      /* Фотобумага примерно 200 г/м² — берём как плотную. */
      stackHeightMm += photos * PAPER_THICKNESS_MM["250"];
      paperWeightGrams +=
        photos *
        (sheet.shortMm / 1000) *
        (sheet.longMm / 1000) *
        PAPER_GRAM_PER_SQM["250"];
      continue;
    }

    const sheets = physicalSheetFormats(item);
    sheetCount += sheets.length;

    for (const format of sheets) {
      const sheet = SHEET_MM[format];
      maxShortMm = Math.max(maxShortMm, sheet.shortMm);
      maxLongMm = Math.max(maxLongMm, sheet.longMm);
      stackHeightMm += PAPER_THICKNESS_MM[item.paper];
      paperWeightGrams += sheetAreaSqm(format) * PAPER_GRAM_PER_SQM[item.paper];
    }
  }

  if (sheetCount === 0) return null;

  return {
    kind: "flat",
    widthMm: Math.ceil(maxShortMm + FLAT_PACKAGING_MARGIN_MM),
    lengthMm: Math.ceil(maxLongMm + FLAT_PACKAGING_MARGIN_MM),
    heightMm: Math.ceil(
      FLAT_PACKAGING_HEIGHT_MM + stackHeightMm * STACK_TOLERANCE
    ),
    weightGrams: Math.ceil(FLAT_PACKAGING_WEIGHT_GRAMS + paperWeightGrams),
    items: sheetCount,
  };
}

/* ---------------------------------------------------------------------------
 * ТУБУСЫ: ПЛАКАТЫ
 * ------------------------------------------------------------------------- */

/**
 * Раскладывает плакаты по тубусам.
 *
 * В один тубус входит не больше MAX_POSTERS_PER_PLACE штук и не больше
 * MAX_POSTERS_LENGTH_MM суммарной длины. Как только лимит достигается,
 * открывается следующее грузоместо.
 *
 * Длина тубуса — это максимум длин плакатов внутри: один тубус режется
 * по самому длинному листу.
 */
function buildTubePlaces(items: ParcelItem[]): ParcelPlace[] {
  const places: ParcelPlace[] = [];

  /* Плакаты разворачиваем: каждая копия — отдельный лист. */
  const posters = items.flatMap((item) =>
    Array.from({ length: Math.max(1, item.copies) }, () => ({
      widthMm: item.poster?.widthMm ?? SHEET_MM.A2.shortMm,
      heightMm: item.poster?.heightMm ?? SHEET_MM.A2.longMm,
    }))
  );

  if (posters.length === 0) return places;

  let current: { lengthMm: number; count: number; weightGrams: number; totalLengthMm: number } | null =
    null;

  const flush = () => {
    if (!current) return;

    places.push({
      kind: "tube",
      widthMm: TUBE_DIAMETER_MM,
      heightMm: TUBE_DIAMETER_MM,
      lengthMm: current.lengthMm,
      weightGrams: Math.ceil(TUBE_WEIGHT_GRAMS + current.weightGrams),
      items: current.count,
    });

    current = null;
  };

  for (const poster of posters) {
    const tubeLengthMm = getTubeLengthMm(poster);
    const weightGrams = getPosterWeightGrams(poster);

    const fitsCount = (current?.count ?? 0) + 1 <= MAX_POSTERS_PER_PLACE;
    const fitsLength =
      (current?.totalLengthMm ?? 0) + tubeLengthMm <= MAX_POSTERS_LENGTH_MM;

    if (!current || !fitsCount || !fitsLength) {
      flush();
      current = {
        lengthMm: tubeLengthMm,
        count: 1,
        weightGrams,
        totalLengthMm: tubeLengthMm,
      };
      continue;
    }

    current.count += 1;
    current.weightGrams += weightGrams;
    current.totalLengthMm += tubeLengthMm;
    current.lengthMm = Math.max(current.lengthMm, tubeLengthMm);
  }

  flush();

  return places;
}

/* ---------------------------------------------------------------------------
 * ИТОГОВЫЙ РАСЧЁТ
 * ------------------------------------------------------------------------- */

/**
 * Считает грузоместа заказа.
 *
 * Порядок:
 *   1. Плакаты всегда выносятся в отдельные тубусы — они не смешиваются
 *      с плоской стопкой.
 *   2. Документы и фотографии складываются в одно плоское место.
 *   3. Если заказ состоит только из плакатов, плоского места не будет.
 *
 * Возвращает null, только если печатать нечего.
 */
export function calculateOrderParcel(items: ParcelItem[]): OrderParcel | null {
  const posterItems = items.filter((item) => item.kind === "poster");
  const flatItems = items.filter((item) => item.kind !== "poster");

  const places: ParcelPlace[] = [];

  const flatPlace = buildFlatPlace(flatItems);
  if (flatPlace) places.push(flatPlace);

  places.push(...buildTubePlaces(posterItems));

  if (places.length === 0) return null;

  const physicalSheetCount = flatPlace?.items ?? 0;

  return {
    places,
    /* Для служб, принимающих одну посылку: максимум по габаритам. */
    widthMm: Math.max(...places.map((place) => place.widthMm)),
    lengthMm: Math.max(...places.map((place) => place.lengthMm)),
    heightMm: Math.max(...places.map((place) => place.heightMm)),
    weightGrams: places.reduce((total, place) => total + place.weightGrams, 0),
    physicalSheetCount,
  };
}
