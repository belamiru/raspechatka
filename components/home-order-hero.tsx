"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { FileTypeIcon } from "@/components/file-type-icon";
import {
  analyzeClientFile,
  formatFileSize,
  MAX_FILE_SIZE,
  validateClientFile,
} from "@/lib/client-file-analysis";
import { reachMetrikaGoal } from "@/lib/metrika";
import { setPendingOrderFiles } from "@/lib/pending-order-files";
import { getPrintPriceForPages, type PaperFormat, type PrintColorMode, type PrintSides } from "@/lib/pricing";

const TELEGRAM_URL = "https://t.me/belami_ru";

/*
 * Вкладки категорий. Кроме «Документов» остальные пока выключены: включить их
 * можно, поставив available: true, — разметка и состояние уже готовы.
 */
const CATEGORY_TABS = [
  { id: "documents", label: "Документы", available: true },
  { id: "photo", label: "Фото", available: false },
  { id: "large-format", label: "Плакаты и чертежи", available: false },
] as const;

type CategoryId = (typeof CATEGORY_TABS)[number]["id"];

/* Плотности бумаги: пока одна, список готов к расширению вместе с прайсом. */
const PAPER_OPTIONS = [
  { value: "80", label: "Обычная (80 г/м²)", available: true },
  { value: "200", label: "Плотная (200 г/м²)", available: false },
] as const;

const COPY_OPTIONS = Array.from({ length: 50 }, (_, index) => index + 1);

function getCopiesLabel(copies: number) {
  const mod10 = copies % 10;
  const mod100 = copies % 100;
  if (mod10 === 1 && mod100 !== 11) return "копия";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "копии";
  return "копий";
}

function getPagesLabel(pages: number) {
  const mod10 = pages % 10;
  const mod100 = pages % 100;
  if (mod10 === 1 && mod100 !== 11) return "страница";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "страницы";
  return "страниц";
}

type UploadedFile = {
  /* fileId нужен серверу, чтобы сопоставить настройки с файлом заказа. */
  id: string;
  file: File;
  kind: "document" | "image";
  /* draftId документа обязателен: без него /api/orders отклонит заказ. */
  draftId: string | null;
  name: string;
  size: number;
  pages: number | null;
  status: "analyzing" | "ready" | "error";
  error: string | null;
};

function makeFileId() {
  return `file-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function Spinner({ className = "" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}

export function HomeOrderHero() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [category, setCategory] = useState<CategoryId>("documents");
  const [uploaded, setUploaded] = useState<UploadedFile | null>(null);
  const [paperFormat, setPaperFormat] = useState<PaperFormat>("A4");
  const [colorMode, setColorMode] = useState<PrintColorMode>("black-and-white");
  const [printSides, setPrintSides] = useState<PrintSides>("one-sided");
  const [copies, setCopies] = useState(2);
  const [paper, setPaper] = useState<string>("80");
  const [isDragging, setIsDragging] = useState(false);

  /* Согласия: те же три галочки, что были в прежней форме заказа. */
  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [fileRulesAccepted, setFileRulesAccepted] = useState(false);

  const [website, setWebsite] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");

  const isReady = uploaded?.status === "ready" && (uploaded.pages ?? 0) > 0;
  const isAnalyzing = uploaded?.status === "analyzing";
  const pageCount = uploaded?.pages ?? 0;
  const isImage = uploaded?.kind === "image";

  /*
   * Для изображений формат фиксирован на A4, поэтому и цена, и то, что уходит
   * на сервер, должны совпадать — используем одно значение.
   */
  const effectivePaperFormat: PaperFormat = isImage ? "A4" : paperFormat;

  const totalPrice = isReady
    ? getPrintPriceForPages({
        pageOptions: Array.from({ length: pageCount }, () => ({ paperFormat: effectivePaperFormat, colorMode })),
        printSides,
        copies,
      }).totalPrice
    : 0;

  async function handleFiles(file: File | null) {
    if (!file) return;

    setFormError("");

    const validation = validateClientFile(file);
    if (!validation.valid) {
      setUploaded({
        id: makeFileId(),
        file,
        kind: "document",
        draftId: null,
        name: file.name,
        size: file.size,
        pages: null,
        status: "error",
        error: validation.error,
      });
      return;
    }

    setUploaded({
      id: makeFileId(),
      file,
      kind: validation.kind,
      draftId: null,
      name: file.name,
      size: file.size,
      pages: null,
      status: "analyzing",
      error: null,
    });

    if (validation.kind === "image") {
      // Изображения печатаются только односторонне.
      setPrintSides("one-sided");
    }

    try {
      const analysis = await analyzeClientFile(file);

      setUploaded((current) =>
        current && current.file === file
          ? {
              ...current,
              kind: analysis.kind,
              draftId: analysis.draftId,
              pages: analysis.pageCount,
              status: "ready",
              error: null,
            }
          : current
      );
    } catch (error) {
      setUploaded((current) =>
        current && current.file === file
          ? {
              ...current,
              status: "error",
              error: error instanceof Error ? error.message : "Не удалось проверить файл.",
            }
          : current
      );
    }
  }

  async function handleSubmit() {
    setFormError("");

    if (!uploaded || uploaded.status !== "ready" || !uploaded.pages) {
      setFormError("Сначала загрузите файл для печати.");
      return;
    }

    if (!personalDataConsent) {
      setFormError("Для оформления заказа необходимо согласие на обработку персональных данных.");
      return;
    }

    if (!offerAccepted || !fileRulesAccepted) {
      setFormError("Для оформления заказа необходимо принять оферту и правила загрузки файлов.");
      return;
    }

    setIsSubmitting(true);

    try {
      const formData = new FormData();

      if (uploaded.kind === "image") {
        formData.append("imageFiles", uploaded.file, uploaded.file.name);
      }

      formData.append(
        "orderItems",
        JSON.stringify([
          {
            fileId: uploaded.id,
            kind: uploaded.kind,
            ...(uploaded.kind === "document" ? { draftId: uploaded.draftId } : {}),
          },
        ])
      );

      /*
       * Формат настроек повторяет прежнюю рабочую форму: сервер читает
       * формат и цвет из defaults и ждёт pageOverrides для каждого файла.
       */
      formData.append(
        "fileSettings",
        JSON.stringify([
          {
            fileId: uploaded.id,
            copies,
            printSides: uploaded.kind === "image" ? "one-sided" : printSides,
            defaults: {
              paperFormat: effectivePaperFormat,
              colorMode,
            },
            pageOverrides: {},
          },
        ])
      );

      formData.append("website", website);
      formData.append("personalDataConsent", personalDataConsent ? "true" : "false");
      formData.append("offerAccepted", offerAccepted ? "true" : "false");
      formData.append("fileRulesAccepted", fileRulesAccepted ? "true" : "false");

      const response = await fetch("/api/orders", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json().catch(() => null)) as {
        orderNumber?: string;
        checkoutUrl?: string;
        error?: string;
        requestId?: string;
      } | null;

      if (!response.ok) {
        const requestNote = result?.requestId ? ` Номер ошибки: ${result.requestId}` : "";
        setFormError(`${result?.error ?? "Не удалось создать заказ."}${requestNote}`);
        return;
      }

      if (result?.checkoutUrl && /^\/orders\/[1-9][0-9]*\/checkout$/.test(result.checkoutUrl)) {
        reachMetrikaGoal("order_form_submit");
        window.location.assign(result.checkoutUrl);
        return;
      }

      setFormError(
        "Не удалось открыть оформление заказа. Обновите страницу и попробуйте снова."
      );
    } catch {
      setFormError(
        "Не удалось связаться с сервером. Проверьте интернет и повторите попытку."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  const controlClass =
    "flex h-11 w-full items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-semibold text-slate-800 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-400";

  return (
    <section className="bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto grid max-w-[1200px] items-start gap-10 px-5 py-10 lg:grid-cols-[minmax(0,1fr)_minmax(380px,440px)] lg:gap-12 lg:py-14">
        {/* Левая колонка: заголовок и преимущества */}
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 lg:hidden">
            Печать онлайн в Воронеже
          </span>

          <h1 className="mt-3 text-[2rem] font-black leading-[1.1] tracking-tight text-slate-950 sm:text-5xl lg:mt-0 lg:text-[3.4rem]">
            Печать документов, фото и плакатов в Воронеже онлайн
          </h1>

          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Загрузите файл, выберите параметры и сразу увидите цену. Заберите заказ сегодня или оформите доставку.
          </p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {[
              { icon: "⚡", text: "Без регистрации" },
              { icon: "₽", text: "Цена до оплаты" },
              { icon: "🔒", text: "Файлы защищены" },
            ].map((item) => (
              <li
                key={item.text}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
              >
                <span aria-hidden="true" className="text-blue-600">{item.icon}</span>
                {item.text}
              </li>
            ))}
          </ul>

          <div className="mt-8 hidden lg:block">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/hero-printing-documents.webp?v=2"
              alt="Распечатанные документы с пружинным переплётом"
              className="h-auto w-full max-w-[520px] object-contain drop-shadow-xl"
              width={520}
              height={380}
            />
          </div>
        </div>

        {/* Правая колонка: виджет заказа */}
        <div id="upload" className="min-w-0 scroll-mt-24">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-lg shadow-slate-200/60">
            <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-3 pt-3">
              {CATEGORY_TABS.map((tab) => {
                const isActive = tab.id === category;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    disabled={!tab.available}
                    aria-pressed={isActive}
                    onClick={() => setCategory(tab.id)}
                    className={`shrink-0 whitespace-nowrap rounded-t-lg px-3 pb-3 pt-1 text-sm font-semibold transition ${
                      isActive
                        ? "border-b-2 border-blue-600 text-blue-700"
                        : tab.available
                          ? "border-b-2 border-transparent text-slate-600 hover:text-slate-900"
                          : "cursor-not-allowed border-b-2 border-transparent text-slate-300"
                    }`}
                    title={tab.available ? undefined : "Скоро"}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            <div className="space-y-3 p-4 sm:p-5">
              {/* Ловушка для ботов: скрытое поле, которое заполняют только роботы. */}
              <div aria-hidden="true" className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden">
                <label>
                  Не заполняйте это поле
                  <input
                    type="text"
                    tabIndex={-1}
                    autoComplete="off"
                    value={website}
                    onChange={(event) => setWebsite(event.target.value)}
                  />
                </label>
              </div>

              {!uploaded && (
                <label
                  onDragOver={(event) => {
                    event.preventDefault();
                    setIsDragging(true);
                  }}
                  onDragLeave={() => setIsDragging(false)}
                  onDrop={(event) => {
                    event.preventDefault();
                    setIsDragging(false);
                    void handleFiles(event.dataTransfer.files?.[0] ?? null);
                  }}
                  className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition ${
                    isDragging ? "border-blue-600 bg-blue-100" : "border-blue-300 bg-blue-50/60 hover:border-blue-500 hover:bg-blue-50"
                  }`}
                >
                  <svg viewBox="0 0 24 24" width="34" height="34" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600" aria-hidden="true">
                    <path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" />
                    <path d="M4 15v3.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V15" />
                  </svg>

                  <p className="mt-2 text-base font-bold text-slate-900">Загрузите файл</p>
                  <p className="mt-0.5 text-xs text-slate-500">PDF, Word, JPG, PNG</p>

                  <span className="mt-3 inline-flex rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white">
                    Выбрать файл
                  </span>

                  <input
                    ref={inputRef}
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odt,.ods,.rtf,.jpg,.jpeg,.png"
                    onChange={(event) => {
                      const file = event.currentTarget.files?.[0] ?? null;
                      event.currentTarget.value = "";
                      void handleFiles(file);
                    }}
                    className="sr-only"
                  />
                </label>
              )}

              {uploaded && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-3">
                  <FileTypeIcon fileName={uploaded.name} className="h-9 w-9 shrink-0" />

                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-slate-900" title={uploaded.name}>
                      {uploaded.name}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {uploaded.status === "analyzing" && "Проверяем файл…"}
                      {uploaded.status === "error" && (uploaded.error ?? "Не удалось проверить файл")}
                      {uploaded.status === "ready" &&
                        [uploaded.pages ? `${uploaded.pages} ${getPagesLabel(uploaded.pages)}` : null, formatFileSize(uploaded.size)]
                          .filter(Boolean)
                          .join(" · ")}
                    </p>
                  </div>

                  {uploaded.status === "analyzing" ? (
                    <Spinner className="h-4 w-4 shrink-0 text-blue-600" />
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setUploaded(null);
                        setFormError("");
                      }}
                      aria-label="Убрать файл"
                      className="shrink-0 rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                        <path d="M6 6l12 12M18 6 6 18" />
                      </svg>
                    </button>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <label className="sr-only" htmlFor="hero-format">Формат бумаги</label>
                <select
                  id="hero-format"
                  value={paperFormat}
                  disabled={isImage}
                  onChange={(event) => setPaperFormat(event.target.value as PaperFormat)}                  className={controlClass}
                >
                  <option value="A4">A4</option>
                  <option value="A3">A3 (×2)</option>
                </select>

                <label className="sr-only" htmlFor="hero-copies">Количество копий</label>
                <select
                  id="hero-copies"
                  value={copies}
                  onChange={(event) => setCopies(Number(event.target.value))}
                  className={controlClass}
                >
                  {COPY_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value} {getCopiesLabel(value)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                <span className="text-sm font-semibold text-slate-800">Двусторонняя</span>

                <button
                  type="button"
                  role="switch"
                  aria-checked={printSides === "two-sided"}
                  disabled={isImage}
                  onClick={() => setPrintSides((current) => (current === "two-sided" ? "one-sided" : "two-sided"))}
                  className={`relative h-6 w-11 shrink-0 rounded-full transition ${
                    printSides === "two-sided" ? "bg-blue-600" : "bg-slate-300"
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  <span className="sr-only">Двусторонняя печать</span>
                  <span
                    className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${
                      printSides === "two-sided" ? "left-[1.375rem]" : "left-0.5"
                    }`}
                  />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <label className="sr-only" htmlFor="hero-paper">Бумага</label>
                <select
                  id="hero-paper"
                  value={paper}
                  onChange={(event) => setPaper(event.target.value)}
                  className={controlClass}
                >
                  {PAPER_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value} disabled={!option.available}>
                      {option.label}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-1 rounded-xl bg-slate-100 p-1">
                  {([
                    ["black-and-white", "Ч/б"],
                    ["color", "Цветная"],
                  ] as const).map(([value, label]) => {
                    const isSelected = colorMode === value;
                    return (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => setColorMode(value)}
                        className={`rounded-lg px-2 py-2 text-sm font-bold transition ${
                          isSelected ? "bg-white text-blue-700 shadow-sm ring-1 ring-blue-200" : "text-slate-600 hover:text-slate-900"
                        }`}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {uploaded && (
                <div className="space-y-2 border-t border-slate-100 pt-3">
                  <label className="flex cursor-pointer gap-2 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={personalDataConsent}
                      onChange={(event) => setPersonalDataConsent(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    <span>
                      Согласен на{" "}
                      <a
                        href="/personal-data-consent"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-700 underline underline-offset-2"
                      >
                        обработку персональных данных
                      </a>
                      .
                    </span>
                  </label>

                  <label className="flex cursor-pointer gap-2 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={offerAccepted}
                      onChange={(event) => setOfferAccepted(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    <span>
                      Принимаю условия{" "}
                      <a
                        href="/offer"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-700 underline underline-offset-2"
                      >
                        публичной оферты
                      </a>
                      .
                    </span>
                  </label>

                  <label className="flex cursor-pointer gap-2 text-xs leading-5 text-slate-600">
                    <input
                      type="checkbox"
                      checked={fileRulesAccepted}
                      onChange={(event) => setFileRulesAccepted(event.target.checked)}
                      className="mt-0.5 h-4 w-4 shrink-0 rounded border-slate-300"
                    />
                    <span>
                      Ознакомился с{" "}
                      <a
                        href="/file-rules"
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-blue-700 underline underline-offset-2"
                      >
                        требованиями к файлам
                      </a>
                      .
                    </span>
                  </label>
                </div>
              )}

              {formError && (
                <p role="alert" className="rounded-xl bg-red-50 p-3 text-xs font-medium leading-5 text-red-700 ring-1 ring-red-100">
                  {formError}
                </p>
              )}

              {isReady && (
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
                  <p className="text-sm text-slate-500">
                    Итого: <span className="text-xl font-black text-slate-900">{totalPrice} ₽</span>
                  </p>

                  <button
                    type="button"
                    onClick={() => void handleSubmit()}
                    disabled={isSubmitting || isAnalyzing}
                    className="rounded-xl bg-amber-500 px-5 py-3 text-sm font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isSubmitting ? "Оформляем…" : "Оформить заказ"}
                  </button>
                </div>
              )}

              <p className="text-center text-xs leading-5 text-slate-500">
                Нет файла?{" "}
                <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" className="font-semibold text-blue-700 underline underline-offset-2">
                  Напишите нам в Telegram
                </a>
              </p>
            </div>
          </div>

          {/* Серая зона: переход на страницу заказа с настройками */}
          <Link
            href="/order"
            /*
             * Передаём уже подготовленный файл на страницу заказа. Документ к
             * этому моменту лежит на сервере как черновик, поэтому повторный
             * анализ там не нужен и только создал бы второй черновик.
             */
            onClick={() => {
              if (uploaded && uploaded.status === "ready" && uploaded.pages) {
                setPendingOrderFiles([
                  {
                    id: makeFileId(),
                    file: uploaded.file,
                    kind: uploaded.kind,
                    pageCount: uploaded.pages,
                    draftId: uploaded.draftId,
                    previewUrl: null,
                    printSettings: {
                      copies,
                      printSides: uploaded.kind === "image" ? "one-sided" : printSides,
                      defaults: { paperFormat: effectivePaperFormat, colorMode },
                      pageOverrides: {},
                    },
                  },
                ]);
                return;
              }

              /* Файла нет — очищаем, чтобы не перенести устаревший. */
              setPendingOrderFiles([]);
            }}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-300 bg-slate-100 px-4 py-3 text-sm font-semibold text-slate-600 transition hover:border-slate-400 hover:bg-slate-200"
          >
            <span aria-hidden="true" className="text-lg leading-none">+</span>
            Добавить ещё файлы
          </Link>

          <p className="mt-3 text-center text-xs leading-5 text-slate-500">
            Максимальный размер файла — {Math.round(MAX_FILE_SIZE / (1024 * 1024))} МБ.
          </p>
        </div>
      </div>
    </section>
  );
}
