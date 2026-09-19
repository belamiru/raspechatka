"use client";

import { useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  DEFAULT_PRINT_SETTINGS,
  getDraftSettingsStorageKey,
  getPagePaperFormat,
  getPrintablePageCount,
  type FilePrintSettings,
} from "@/lib/print-settings";

pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
const THUMBNAIL_SCALE = 0.28;
const PREVIEW_SCALE = 1.5;

async function drawPage(pdf: PDFDocumentProxy, pageNumber: number, canvas: HTMLCanvasElement, scale: number) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("Браузер не поддерживает предпросмотр PDF.");
  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  await page.render({ canvas, canvasContext: context, viewport }).promise;
}

function Thumbnail({ pdf, pageNumber, selected, included, paperFormat, onClick }: {
  pdf: PDFDocumentProxy; pageNumber: number; selected: boolean; included: boolean;
  paperFormat: "A4" | "A3"; onClick: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  useEffect(() => { if (canvasRef.current) void drawPage(pdf, pageNumber, canvasRef.current, THUMBNAIL_SCALE).catch(() => undefined); }, [pdf, pageNumber]);
  return <button type="button" onClick={onClick} aria-pressed={selected} className={`rounded-xl border p-2 text-left transition focus:outline-none focus:ring-4 focus:ring-blue-200 ${selected ? "border-blue-700 bg-blue-50" : "border-slate-200 bg-white hover:border-blue-300"} ${included ? "" : "opacity-50"}`}>
    <div className="relative overflow-hidden rounded-lg bg-slate-100"><canvas ref={canvasRef} className="block h-auto w-full" />
      {!included && <span className="absolute inset-0 flex items-center justify-center bg-slate-900/30 text-xs font-bold text-white">Не печатать</span>}
      {included && paperFormat === "A3" && <span className="absolute right-1 top-1 rounded bg-amber-500 px-1.5 py-0.5 text-xs font-black text-white">A3</span>}
    </div>
    <span className={`mt-2 block text-center text-xs font-bold ${included ? "text-slate-700" : "text-red-700 line-through"}`}>Страница {pageNumber}</span>
  </button>;
}

export function PrintDraftViewer({ draftId }: { draftId: string }) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [error, setError] = useState("");
  const [selectedPage, setSelectedPage] = useState(1);
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
  const [settings, setSettings] = useState<FilePrintSettings>({ ...DEFAULT_PRINT_SETTINGS, defaults: { ...DEFAULT_PRINT_SETTINGS.defaults }, pageOverrides: {} });
  const previewRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    try { const raw = localStorage.getItem(getDraftSettingsStorageKey(draftId)); if (raw) setSettings(JSON.parse(raw)); } catch { /* ignore broken local settings */ }
    let cancelled = false; let loaded: PDFDocumentProxy | null = null;
    void (async () => { try {
      const response = await fetch(`/api/print-drafts/${draftId}/preview`, { cache: "no-store" });
      if (!response.ok) throw new Error((await response.json().catch(() => null))?.error ?? "Не удалось открыть документ.");
      loaded = await pdfjs.getDocument({ data: await response.arrayBuffer() }).promise;
      if (!cancelled) setPdf(loaded);
    } catch (loadError) { if (!cancelled) setError(loadError instanceof Error ? loadError.message : "Не удалось открыть документ."); } })();
    return () => { cancelled = true; if (loaded) void loaded.destroy(); };
  }, [draftId]);

  useEffect(() => { localStorage.setItem(getDraftSettingsStorageKey(draftId), JSON.stringify(settings)); }, [draftId, settings]);
  useEffect(() => { if (pdf && previewRef.current) void drawPage(pdf, selectedPage, previewRef.current, PREVIEW_SCALE).catch(() => setError("Не удалось показать страницу.")); }, [pdf, selectedPage]);

  const updatePages = (pages: number[], changes: { included?: boolean; paperFormat?: "A4" | "A3" | null }) => setSettings((current) => {
    const pageOverrides = { ...current.pageOverrides };
    for (const pageNumber of pages) {
      const existing = pageOverrides[pageNumber] ?? { pageNumber };
      const next = { ...existing };
      if (changes.included !== undefined) next.included = changes.included;
      if (changes.paperFormat === null) delete next.paperFormat;
      else if (changes.paperFormat) next.paperFormat = changes.paperFormat;
      if (next.included !== false && !next.paperFormat) delete pageOverrides[pageNumber]; else pageOverrides[pageNumber] = next;
    }
    return { ...current, pageOverrides };
  });

  if (error) return <main className="min-h-screen bg-slate-50 p-6"><p className="rounded-xl bg-red-50 p-4 font-bold text-red-700">{error}</p></main>;
  if (!pdf) return <main className="min-h-screen bg-slate-50 p-10 text-center font-bold text-slate-600">Подготавливаем предпросмотр…</main>;
  const pages = Array.from({ length: pdf.numPages }, (_, index) => index + 1);
  const included = (pageNumber: number) => settings.pageOverrides[pageNumber]?.included !== false;
  const chosen = selectedPages.size ? [...selectedPages] : [selectedPage];

  return <main className="min-h-screen bg-slate-50 text-slate-900">
    <header className="border-b bg-white"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-3 px-5 py-4"><div><p className="font-black">Предпросмотр печати</p><p className="text-sm text-slate-500">Печатать: {getPrintablePageCount(pdf.numPages, settings)} из {pdf.numPages} стр.</p></div><button type="button" onClick={() => window.close()} className="rounded-xl border px-4 py-2 text-sm font-bold">Сохранить и закрыть</button></div></header>
    <div className="mx-auto grid max-w-7xl gap-6 p-5 lg:grid-cols-[minmax(0,1fr)_360px]"><section>
      <div className="mb-4 flex flex-wrap gap-2"><button type="button" onClick={() => setSelectedPages(new Set(pages))} className="rounded-lg border px-3 py-2 text-sm font-bold">Выбрать все</button><button type="button" onClick={() => setSelectedPages(new Set())} className="rounded-lg border px-3 py-2 text-sm font-bold">Снять выделение</button><button type="button" disabled={!selectedPages.size} onClick={() => updatePages(chosen, { included: false })} className="rounded-lg bg-red-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Не печатать</button><button type="button" disabled={!selectedPages.size} onClick={() => updatePages(chosen, { included: true })} className="rounded-lg bg-emerald-700 px-3 py-2 text-sm font-bold text-white disabled:opacity-50">Вернуть в печать</button></div>
      <div className="mb-4 flex flex-wrap gap-2 rounded-xl bg-white p-3"><span className="self-center text-sm font-bold">Формат выбранных:</span><button type="button" onClick={() => updatePages(chosen, { paperFormat: "A4" })} className="rounded-lg border border-blue-200 px-3 py-2 text-sm font-bold text-blue-800">A4</button><button type="button" onClick={() => updatePages(chosen, { paperFormat: "A3" })} className="rounded-lg border border-amber-300 px-3 py-2 text-sm font-bold text-amber-800">A3</button><button type="button" onClick={() => updatePages(chosen, { paperFormat: null })} className="rounded-lg border px-3 py-2 text-sm font-bold">Вернуть формат файла</button></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">{pages.map((pageNumber) => <Thumbnail key={pageNumber} pdf={pdf} pageNumber={pageNumber} selected={selectedPages.has(pageNumber)} included={included(pageNumber)} paperFormat={getPagePaperFormat(pageNumber, settings)} onClick={() => { setSelectedPages((current) => { const next = new Set(current); next.has(pageNumber) ? next.delete(pageNumber) : next.add(pageNumber); return next; }); setSelectedPage(pageNumber); }} />)}</div>
    </section><aside className="h-fit rounded-2xl bg-white p-4 shadow-sm lg:sticky lg:top-5"><p className="font-bold">Страница {selectedPage}</p><p className="mt-1 text-sm text-slate-500">Формат: {getPagePaperFormat(selectedPage, settings)}</p><canvas ref={previewRef} className="mt-3 block h-auto max-w-full rounded bg-slate-100"/><div className="mt-4 grid grid-cols-2 gap-2"><button type="button" onClick={() => updatePages([selectedPage], { paperFormat: "A4" })} className="rounded-xl border border-blue-200 px-3 py-2 text-sm font-bold text-blue-800">A4</button><button type="button" onClick={() => updatePages([selectedPage], { paperFormat: "A3" })} className="rounded-xl border border-amber-300 px-3 py-2 text-sm font-bold text-amber-800">A3</button></div><button type="button" onClick={() => updatePages([selectedPage], { paperFormat: null })} className="mt-2 w-full rounded-xl border px-3 py-2 text-sm font-bold">Вернуть формат файла</button><button type="button" onClick={() => updatePages([selectedPage], { included: !included(selectedPage) })} className={`mt-3 w-full rounded-xl px-4 py-3 text-sm font-bold text-white ${included(selectedPage) ? "bg-red-700" : "bg-emerald-700"}`}>{included(selectedPage) ? "Не печатать эту страницу" : "Вернуть в печать"}</button></aside></div>
  </main>;
}
