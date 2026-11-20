import { POSTER_PAPERS } from "@/lib/pricing";

export type SummaryItem = {
  id: string;
  name: string;
  kind: string | null;
  pages: number;
  printablePages: number;
  copies: number;
  sides: string;
  format: string;
  extras: Record<string, unknown>;
  pageOverrides?: Record<string, { pageNumber: number; included?: boolean; paperFormat?: string; colorMode?: string }>;
  total: number;
};

function describe(item: SummaryItem) {
  const e = item.extras;
  const kind = item.kind;
  const copies = `${item.copies} ${item.copies === 1 ? "копия" : "копии"}`;
  if (kind === "photo") return ["Фото", typeof e.photoFormat === "string" ? e.photoFormat : null,
    e.photoSurface === "matte" ? "матовая" : e.photoSurface === "gloss" ? "глянцевая" : "поверхность не указана",
    e.photoFit === "contain" ? "кадр целиком" : e.photoFit === "crop" ? "с обрезкой" : null, copies];
  if (kind === "poster") return ["Плакат", typeof e.posterWidthMm === "number" && typeof e.posterHeightMm === "number" ? `${e.posterWidthMm} × ${e.posterHeightMm} мм` : null, typeof e.posterPaper === "string" ? POSTER_PAPERS.find(p => p.id === e.posterPaper)?.label ?? e.posterPaper : null, copies];
  if (kind !== "document") return [`${item.printablePages} из ${item.pages} стр.`, copies];
  const changed = Object.values(item.pageOverrides ?? {}).filter(p => p.included !== false && (p.paperFormat || p.colorMode));
  const excluded = Object.values(item.pageOverrides ?? {}).filter(p => p.included === false).map(p => p.pageNumber).sort((a,b) => a-b);
  return ["Документ", item.format, e.colorMode === "color" ? "цветная" : e.colorMode === "black-and-white" ? "ч/б" : null,
    item.sides === "two-sided" ? "двусторонняя" : "односторонняя", `${item.printablePages} из ${item.pages} стр.`, copies,
    typeof e.paper === "string" && e.paper !== "80" ? `бумага ${e.paper} г/м²` : null,
    e.lamination === "matte" || e.lamination === "gloss" ? `${e.lamination === "matte" ? "матовая" : "глянцевая"} ламинация${e.laminationThickness ? ` ${e.laminationThickness} мкм` : ""}` : null,
    e.binding === true ? `переплёт${e.coverSet === "both" ? " с двумя обложками" : e.coverSet === "front" ? " с передней обложкой" : e.coverSet === "back" ? " с задней обложкой" : " без обложек"}` : null,
    excluded.length ? `исключены стр. ${excluded.join(", ")}` : null,
    ...changed.map(p => `стр. ${p.pageNumber}: ${[p.paperFormat, p.colorMode === "color" ? "цветная" : p.colorMode === "black-and-white" ? "ч/б" : p.colorMode].filter(Boolean).join(", ")}`), e.staple === "left" ? "степлер слева" : e.staple === "right" ? "степлер справа" : null];
}

export function OrderSummaryItems({ items }: { items: SummaryItem[] }) {
  if (!items.length) return null;
  return <ul className="mt-4 space-y-3 border-b border-slate-100 pb-4 text-sm" aria-label="Состав заказа">
    {items.map(item => <li key={item.id}>
      <div className="flex justify-between gap-3"><span className="min-w-0 break-all font-semibold text-slate-900">{item.name}</span><span className="shrink-0 font-semibold">{item.total.toLocaleString("ru-RU")} ₽</span></div>
      <p className="mt-1 text-xs leading-5 text-slate-500">{describe(item).filter(Boolean).join(" · ")}</p>
    </li>)}
  </ul>;
}
