import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import {
  COLOR_PRICE_TIERS,
  PHOTO_FORMATS,
  PHOTO_PRICE_TIERS,
  POSTER_FORMATS,
  POSTER_PAPERS,
  PRINT_PRICE_TIERS,
  getPhotoPriceForCount,
  getPosterPrice,
  getRequiredPixels,
} from "@/lib/pricing";
import {
  BINDING_PRICE,
  COVER_PRICE,
  LAMINATION_PRICE_PER_SHEET,
  STAPLE_PRICE,
} from "@/lib/print-extras";

export const metadata: Metadata = {
  title: "Цены на печать — таблица тарифов",
  description:
    "Полный прайс типографии: чёрно-белая и цветная печать A4 и A3 по объёму, ламинация, переплёт на пружину, обложки, скрепление степлером и плотность бумаги.",
  alternates: { canonical: "/prices" },
};

const siteUrl = "https://xn--80aaas0a1afjm2c.xn--e1afffngyp.xn--p1ai";

/* Ступени объёма общие для обоих разделов печати — берём из калькулятора. */
function tierLabel(from: number, to: number | null) {
  return to === null ? `от ${from} стр.` : `${from}–${to} стр.`;
}

type PrintRow = {
  label: string;
  bw: number;
  color: number;
};

const PRINT_ROWS: PrintRow[] = PRINT_PRICE_TIERS.map((tier, index) => {
  const colorTier = COLOR_PRICE_TIERS[index];

  return {
    label: tierLabel(tier.from, tier.to),
    bw: tier.a4OneSidedPrice,
    color: colorTier?.colorA4 ?? tier.a4OneSidedPrice * 2,
  };
});

const LAMINATION_ROWS = [
  {
    label: "80 мкр — тонкая",
    note: "Справки, документы, меню",
    a4: LAMINATION_PRICE_PER_SHEET.A4["80"],
    a3: LAMINATION_PRICE_PER_SHEET.A3["80"],
  },
  {
    label: "120 мкр — жёсткая",
    note: "Удостоверения, карточки, обложки",
    a4: LAMINATION_PRICE_PER_SHEET.A4["120"],
    a3: LAMINATION_PRICE_PER_SHEET.A3["120"],
  },
];

/* Надбавки за плотность бумаги: считаются от цены печати на 80 г/м². */
const PAPER_ROWS = [
  { label: "80 г/м²", note: "Обычная офисная бумага", surcharge: "базовый тариф" },
  { label: "120 г/м²", note: "Плотнее, меньше просвечивает", surcharge: "+10% к тарифу" },
  { label: "250 г/м²", note: "Картон: обложки, грамоты, визитки", surcharge: "+20% к тарифу" },
];

function PriceTable({
  title,
  description,
  columns,
  rows,
}: {
  title: string;
  description: string;
  columns: string[];
  rows: { cells: (string | number)[]; note?: string; highlight?: boolean }[];
}) {
  return (
    <section className="mt-10" aria-label={title}>
      <h2 className="text-xl font-black tracking-tight text-slate-950 sm:text-2xl">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">{description}</p>

      <div className="mt-4 overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              {columns.map((column, index) => (
                <th key={column} className={`px-4 py-3 font-bold sm:px-5 ${index === 0 ? "" : "text-right"}`}>
                  {column}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={String(row.cells[0])} className={row.highlight ? "bg-blue-50/50" : undefined}>
                {row.cells.map((cell, index) => (
                  <td
                    key={index}
                    className={
                      index === 0
                        ? "px-4 py-3 sm:px-5"
                        : "px-4 py-3 text-right font-semibold tabular-nums text-slate-900 sm:px-5"
                    }
                  >
                    {index === 0 ? (
                      <span className="block">
                        <span className={`block font-bold ${row.highlight ? "text-blue-800" : "text-slate-900"}`}>
                          {cell}
                        </span>
                        {row.note && <span className="mt-0.5 block text-xs font-normal text-slate-500">{row.note}</span>}
                      </span>
                    ) : (
                      cell
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export default function PricesPage() {
  const priceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Печать документов, фото и плакатов",
    description:
      "Прайс на чёрно-белую и цветную печать, ламинацию, переплёт на пружину, обложки и скрепление степлером.",
    url: `${siteUrl}/prices`,
    areaServed: { "@type": "City", name: "Воронеж" },
    provider: {
      "@type": "LocalBusiness",
      name: "Типография Copyleft",
      url: siteUrl,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Воронеж",
        streetAddress: "ул. Шукшина, д. 21, офис 8",
        addressCountry: "RU",
      },
    },
  };

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(priceSchema) }} />

      <SiteHeader />

      <section className="border-b border-slate-100 bg-gradient-to-b from-blue-50/60 to-white">
        <div className="mx-auto max-w-[1200px] px-5 py-10 sm:py-14">
          <nav className="text-sm text-slate-500" aria-label="Навигация">
            <Link href="/" className="hover:text-blue-700">Главная</Link> / <span className="text-slate-700">Цены</span>
          </nav>

          <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
            Цены на печать
          </h1>

          <p className="mt-3 max-w-2xl text-lg leading-8 text-slate-600">
            Все тарифы в одном месте: печать по объёму, плотность бумаги и дополнительные услуги.
            Цена в заказе считается по этим же правилам — сюрпризов при оформлении нет.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/order"
              className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-600"
            >
              Рассчитать заказ
            </Link>
            <Link
              href="/#how-to-order"
              className="rounded-xl border border-slate-300 px-5 py-3 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
            >
              Как мы работаем
            </Link>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-5 pb-14">
        <PriceTable
          title="Печать документов"
          description="Цена за одну печатную страницу A4. Чем больше страниц в заказе, тем ниже тариф — скидка считается по количеству страниц с учётом копий."
          columns={["Объём заказа", "Чёрно-белая, A4", "Цветная, A4"]}
          rows={PRINT_ROWS.map((row) => ({
            cells: [row.label, `${row.bw} ₽`, `${row.color} ₽`],
          }))}
        />

        <PriceTable
          title="Формат A3"
          description="Лист A3 вдвое больше A4, поэтому цена за страницу удваивается. Надбавка действует и для чёрно-белой, и для цветной печати."
          columns={["Объём заказа", "Чёрно-белая, A3", "Цветная, A3"]}
          rows={PRINT_ROWS.map((row) => ({
            cells: [row.label, `${row.bw * 2} ₽`, `${row.color * 2} ₽`],
          }))}
        />

        <PriceTable
          title="Плотность бумаги"
          description="Надбавка считается от стоимости печати этого документа. Плотная бумага лучше держит форму и меньше просвечивает при двусторонней печати."
          columns={["Плотность", "Надбавка к тарифу"]}
          rows={PAPER_ROWS.map((row) => ({
            cells: [row.label, row.surcharge],
            note: row.note,
          }))}
        />

        <PriceTable
          title="Фотопечать"
          description="Цена за один отпечаток. Чем больше отпечатков в заказе, тем ниже цена — скидка считается по общему количеству. Матовая и глянцевая поверхность стоят одинаково."
          columns={["Количество", "10×15", "A5", "A4", "A3"]}
          rows={PHOTO_PRICE_TIERS.map((tier) => ({
            cells: [
              tier.label,
              ...PHOTO_FORMATS.map((format) => `${getPhotoPriceForCount(tier.from, format.id).unitPrice} ₽`),
            ],
          }))}
        />

        <PriceTable
          title="Форматы фотобумаги"
          description="Чем больше лист, тем выше цена за отпечаток. Цена формата считается от 10×15 по множителю и зависит от объёма заказа."
          columns={["Формат", "Множитель к 10×15"]}
          rows={PHOTO_FORMATS.map((format) => ({
            cells: [format.label, format.multiplier === 1 ? "базовый" : `×${String(format.multiplier).replace(".", ",")}`],
            note: format.note === "A6" ? "A6 — самый маленький формат" : undefined,
          }))}
        />

        <PriceTable
          title="Плакаты и чертежи"
          description="Широкоформатная печать считается по площади листа. Цена за м² зависит от материала, а итог — от размера: A2 примерно 0,25 м², A1 — 0,5 м², A0 — 1 м²."
          columns={["Материал", "Цена за м²", "Макс. ширина"]}
          rows={POSTER_PAPERS.map((paper) => ({
            cells: [paper.label, `${paper.pricePerSqm} ₽`, `${paper.maxWidthMm} мм`],
            note: `${paper.group} · ${paper.note}`,
          }))}
        />

        <PriceTable
          title="Плакаты по форматам"
          description="Примерная стоимость одного отпечатка. Точную цену показывает калькулятор: она зависит от выбранного материала и размера."
          columns={["Формат", ...POSTER_PAPERS.map((paper) => paper.label.replace(/ \d+ г\/м²| \d+ мкр/, ""))]}
          rows={POSTER_FORMATS.filter((format) => format.id !== "custom").map((format) => ({
            cells: [
              format.label,
              ...POSTER_PAPERS.map(
                (paper) =>
                  `${getPosterPrice({
                    widthMm: format.widthMm,
                    heightMm: format.heightMm,
                    pricePerSqm: paper.pricePerSqm,
                  }).unitPrice} ₽`
              ),
            ],
            note: `${format.widthMm}×${format.heightMm} мм`,
          }))}
        />

        <PriceTable
          title="Разрешение для больших форматов"
          description="Для широкоформатной печати нужно не меньше 150 пикселей на дюйм. Если файл меньше, изображение напечатается мутным или пикселизованным."
          columns={["Формат", "Минимальный размер файла"]}
          rows={POSTER_FORMATS.filter((format) => format.id !== "custom").map((format) => {
            const px = getRequiredPixels(format.widthMm, format.heightMm);
            return {
              cells: [format.label, `${px.width}×${px.height} px`],
              note: `${format.widthMm}×${format.heightMm} мм при 150 dpi`,
            };
          })}
        />

        <PriceTable
          title="Ламинация"
          description="Ламинируется каждый физический лист. При двусторонней печати две страницы лежат на одном листе — плёнка нужна одна."
          columns={["Плотность плёнки", "A4, за лист", "A3, за лист"]}
          rows={LAMINATION_ROWS.map((row) => ({
            cells: [row.label, `${row.a4} ₽`, `${row.a3} ₽`],
            note: row.note,
          }))}
        />

        <PriceTable
          title="Переплёт и скрепление"
          description="Переплёт на пружину раскрывается на 180° и подходит для документов любого объёма. Степлер — для небольших документов до 30 листов."
          columns={["Услуга", "Цена"]}
          rows={[
            { cells: ["Переплёт на металлическую пружину", `${BINDING_PRICE} ₽`], note: "За документ, объём не важен" },
            { cells: ["Обложка, передняя или задняя", `${COVER_PRICE} ₽`], note: "Прозрачная или тиснение под кожу" },
            { cells: ["Пружина без обложек", `${BINDING_PRICE} ₽`], note: "Листы на пружине, обложек нет" },
            { cells: ["Пружина и одна обложка", `${BINDING_PRICE + COVER_PRICE} ₽`], note: "Передняя или задняя — на выбор" },
            { cells: ["Комплект: пружина и две обложки", `${BINDING_PRICE + COVER_PRICE * 2} ₽`], note: "Самый частый вариант", highlight: true },
            { cells: ["Скрепление степлером в углу", `${STAPLE_PRICE} ₽`], note: "Левый или правый угол, до 30 листов" },
          ]}
        />

        <section className="mt-10 rounded-2xl border border-blue-200 bg-blue-50/60 p-5 sm:p-6">
          <h2 className="text-lg font-black text-slate-950">Как считается итог</h2>
          <ol className="mt-3 space-y-2 text-sm leading-6 text-slate-700">
            <li><span className="font-bold">1.</span> Печать: страницы × тариф по объёму × копии. Для A3 тариф удваивается.</li>
            <li><span className="font-bold">1а.</span> Фото 10×15: количество отпечатков × цена за штуку по объёму.</li>
            <li><span className="font-bold">2.</span> Бумага: к печати добавляется 10% за 120 г/м² или 20% за 250 г/м².</li>
            <li><span className="font-bold">3.</span> Ламинация: число физических листов × цена плёнки × копии.</li>
            <li><span className="font-bold">4.</span> Переплёт и обложки: фиксированная сумма за документ.</li>
            <li><span className="font-bold">5.</span> Степлер: 10 ₽ за документ.</li>
          </ol>

          <p className="mt-4 text-sm leading-6 text-slate-600">
            Каждый файл в заказе считается отдельно — можно смешивать документы, фото и плакаты в одной корзине.
            Скидка по объёму тоже считается для каждого файла.
          </p>

          <Link
            href="/order"
            className="mt-5 inline-flex rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-600"
          >
            Перейти к оформлению
          </Link>
        </section>
      </div>

      <SiteFooter />
    </main>
  );
}
