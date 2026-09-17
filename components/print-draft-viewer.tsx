"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import * as pdfjs from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";

pdfjs.GlobalWorkerOptions.workerSrc = new URL(
  "pdfjs-dist/build/pdf.worker.min.mjs",
  import.meta.url
).toString();

type PrintDraftViewerProps = {
  draftId: string;
};

type ViewerStatus = "loading" | "ready" | "error";

const THUMBNAIL_SCALE = 0.28;
const PREVIEW_SCALE = 1.5;

function formatDocumentName(value: string | null) {
  return value?.trim() || "Подготовленный документ";
}

async function renderPageToCanvas(
  pdf: PDFDocumentProxy,
  pageNumber: number,
  canvas: HTMLCanvasElement,
  scale: number
) {
  const page = await pdf.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const context = canvas.getContext("2d", { alpha: false });

  if (!context) {
    throw new Error("Браузер не поддерживает предпросмотр PDF.");
  }

  canvas.width = Math.ceil(viewport.width);
  canvas.height = Math.ceil(viewport.height);
  canvas.style.aspectRatio = `${viewport.width} / ${viewport.height}`;

  await page.render({ canvas, canvasContext: context, viewport }).promise;
}

function PageThumbnail({
  pdf,
  pageNumber,
  selected,
  onSelect,
}: {
  pdf: PDFDocumentProxy;
  pageNumber: number;
  selected: boolean;
  onSelect: (pageNumber: number) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const itemRef = useRef<HTMLButtonElement>(null);
  const [visible, setVisible] = useState(false);
  const [renderError, setRenderError] = useState(false);

  useEffect(() => {
    const element = itemRef.current;

    if (!element) {
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" }
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;

    if (!visible || !canvas) {
      return;
    }

    let cancelled = false;
    setRenderError(false);

    void renderPageToCanvas(pdf, pageNumber, canvas, THUMBNAIL_SCALE).catch(
      () => {
        if (!cancelled) {
          setRenderError(true);
        }
      }
    );

    return () => {
      cancelled = true;
    };
  }, [pdf, pageNumber, visible]);

  return (
    <button
      ref={itemRef}
      type="button"
      onClick={() => onSelect(pageNumber)}
      aria-pressed={selected}
      aria-label={`Открыть страницу ${pageNumber}`}
      className={`group rounded-xl border p-2 text-left transition focus:outline-none focus:ring-4 focus:ring-blue-200 ${
        selected
          ? "border-blue-600 bg-blue-50 shadow-sm"
          : "border-slate-200 bg-white hover:border-blue-300 hover:shadow-sm"
      }`}
    >
      <div className="relative overflow-hidden rounded-lg bg-slate-100">
        <canvas ref={canvasRef} className="block h-auto w-full" />
        {!visible && (
          <div className="absolute inset-0 animate-pulse bg-slate-200" />
        )}
        {visible && renderError && (
          <div className="absolute inset-0 flex items-center justify-center px-2 text-center text-xs font-medium text-slate-500">
            Не удалось показать страницу
          </div>
        )}
      </div>
      <span className="mt-2 block text-center text-xs font-bold text-slate-700">
        Страница {pageNumber}
      </span>
    </button>
  );
}

export function PrintDraftViewer({ draftId }: PrintDraftViewerProps) {
  const [status, setStatus] = useState<ViewerStatus>("loading");
  const [error, setError] = useState("");
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [selectedPage, setSelectedPage] = useState(1);
  const [fileName, setFileName] = useState<string | null>(null);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    let cancelled = false;
    let loadedPdf: PDFDocumentProxy | null = null;

    async function loadPdf() {
      try {
        setStatus("loading");
        setError("");

        const response = await fetch(`/api/print-drafts/${draftId}/preview`, {
          cache: "no-store",
        });

        if (!response.ok) {
          const result = (await response.json().catch(() => null)) as {
            error?: string;
          } | null;
          throw new Error(result?.error ?? "Не удалось открыть документ.");
        }

        const contentDisposition = response.headers.get("content-disposition");
        const encodedName = contentDisposition?.match(/filename\*=UTF-8''([^;]+)/i)?.[1];
        setFileName(encodedName ? decodeURIComponent(encodedName) : null);

        const bytes = await response.arrayBuffer();
        loadedPdf = await pdfjs.getDocument({ data: bytes }).promise;

        if (cancelled) {
          await loadedPdf.destroy();
          return;
        }

        setPdf(loadedPdf);
        setSelectedPage(1);
        setStatus("ready");
      } catch (loadError) {
        if (!cancelled) {
          setError(
            loadError instanceof Error
              ? loadError.message
              : "Не удалось открыть документ."
          );
          setStatus("error");
        }
      }
    }

    void loadPdf();

    return () => {
      cancelled = true;
      if (loadedPdf) {
        void loadedPdf.destroy();
      }
    };
  }, [draftId]);

  const renderSelectedPage = useCallback(async () => {
    if (!pdf || !previewCanvasRef.current) {
      return;
    }

    await renderPageToCanvas(pdf, selectedPage, previewCanvasRef.current, PREVIEW_SCALE);
  }, [pdf, selectedPage]);

  useEffect(() => {
    let cancelled = false;

    void renderSelectedPage().catch(() => {
      if (!cancelled) {
        setError("Не удалось отобразить выбранную страницу.");
      }
    });

    return () => {
      cancelled = true;
    };
  }, [renderSelectedPage]);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 sm:py-10">
        <div>
          <button
            type="button"
            onClick={() => window.close()}
            className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 transition hover:text-blue-900 focus:outline-none focus:ring-4 focus:ring-blue-200"
          >
            <span aria-hidden="true">×</span>
            Закрыть предпросмотр
          </button>

          <p className="mt-2 text-xs text-slate-500">
            Вернитесь к вкладке с заказом: загруженный файл и настройки сохранены там.
          </p>
        </div>

        <header className="mt-5 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
          <p className="text-sm font-bold text-blue-700">Предпросмотр документа</p>
          <h1 className="mt-1 break-words text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            {formatDocumentName(fileName)}
          </h1>
          {pdf && (
            <p className="mt-2 text-sm text-slate-600">
              {pdf.numPages} {pdf.numPages === 1 ? "страница" : "страниц"}
            </p>
          )}
        </header>

        {status === "loading" && (
          <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-600 shadow-sm">
            Подготавливаем предпросмотр документа…
          </div>
        )}

        {status === "error" && (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6 text-red-900 shadow-sm">
            <h2 className="font-black">Предпросмотр недоступен</h2>
            <p className="mt-2 text-sm">{error}</p>
            <button
              type="button"
              onClick={() => window.close()}
              className="mt-4 inline-flex rounded-xl bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800"
            >
              Закрыть предпросмотр
            </button>
          </div>
        )}

        {status === "ready" && pdf && (
          <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
            <section className="order-1 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-5">
              <div className="mb-3 flex items-center justify-between gap-3">
                <h2 className="font-black text-slate-950">Страница {selectedPage}</h2>
                <span className="text-sm text-slate-500">из {pdf.numPages}</span>
              </div>
              <div className="flex min-h-[55vh] items-start justify-center overflow-auto rounded-xl bg-slate-100 p-3 sm:p-5">
                <canvas
                  ref={previewCanvasRef}
                  className="h-auto max-w-none rounded-sm bg-white shadow-lg"
                  aria-label={`Увеличенный предпросмотр страницы ${selectedPage}`}
                />
              </div>
            </section>

            <aside className="order-2 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm lg:sticky lg:top-5 lg:max-h-[calc(100vh-2.5rem)] lg:overflow-y-auto">
              <h2 className="mb-4 font-black text-slate-950">Все страницы</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-2">
                {Array.from({ length: pdf.numPages }, (_, index) => index + 1).map(
                  (pageNumber) => (
                    <PageThumbnail
                      key={pageNumber}
                      pdf={pdf}
                      pageNumber={pageNumber}
                      selected={selectedPage === pageNumber}
                      onSelect={setSelectedPage}
                    />
                  )
                )}
              </div>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
}
