"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { OrderFileDropzone } from "@/components/order-file-dropzone";
import {
  OrderFileList,
  type FilePrintSettings,
  type OrderFileListItem,
} from "@/components/order-file-list";
import {
  analyzeClientFile,
  MAX_FILES_PER_ORDER,
  MAX_TOTAL_FILE_SIZE,
  validateClientFile,
} from "@/lib/client-file-analysis";
import { SiteFooter } from "@/components/site-footer";
import { reachMetrikaGoal } from "@/lib/metrika";
import { getPrintPriceForPages } from "@/lib/pricing";
import { DEFAULT_PRINT_SETTINGS, getDraftSettingsStorageKey, getPrintablePageFormats } from "@/lib/print-settings";
import { PrintSettingsPanel } from "@/components/print-settings-panel";


type PriceTab = "black-and-white" | "color" | "solid-color";

type PriceTable = {
  label: string;
  shortLabel: string;
  description: string;
  accent: string;
  tiers: { quantity: string; a4: number }[];
};

const PRICE_TABLES: Record<PriceTab, PriceTable> = {
  "black-and-white": {
    label: "Чёрно-белая печать",
    shortLabel: "Ч/б печать",
    description:
      "Цена рассчитывается отдельно для каждого файла с учётом формата, числа страниц и копий. Для A3 цена ×2.",
    accent: "blue",
    tiers: [
      { quantity: "1–10", a4: 20 },
      { quantity: "11–25", a4: 18 },
      { quantity: "26–75", a4: 16 },
      { quantity: "76–200", a4: 14 },
      { quantity: "201–500", a4: 11 },
      { quantity: "От 501", a4: 8 },
    ],
  },
  color: {
    label: "Цветная печать",
    shortLabel: "Цветная",
    description:
      "Для документов, презентаций, таблиц, графиков и макетов с обычной цветной насыщенностью. Для A3 цена ×2.",
    accent: "violet",
    tiers: [
      { quantity: "1–9", a4: 60 },
      { quantity: "10–24", a4: 55 },
      { quantity: "25–49", a4: 50 },
      { quantity: "50–99", a4: 45 },
      { quantity: "100–249", a4: 40 },
      { quantity: "250–499", a4: 35 },
      { quantity: "От 500", a4: 30 },
    ],
  },
  "solid-color": {
    label: "Цветная печать — сплошная заливка",
    shortLabel: "Сплошная заливка",
    description:
      "Для макетов с плотным цветным фоном, крупными фотографиями и насыщенными рекламными изображениями. Для A3 цена ×2.",
    accent: "fuchsia",
    tiers: [
      { quantity: "1–9", a4: 120 },
      { quantity: "10–24", a4: 110 },
      { quantity: "25–49", a4: 100 },
      { quantity: "50–99", a4: 90 },
      { quantity: "100–249", a4: 80 },
      { quantity: "250–499", a4: 70 },
      { quantity: "От 500", a4: 60 },
    ],
  },
};

const PRICE_TABS: PriceTab[] = ["black-and-white", "color", "solid-color"];

function makeFileId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }

  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function makeFileKey(file: File) {
  return `${file.name}-${file.size}-${file.lastModified}`;
}

export default function Home() {
  const [files, setFiles] = useState<OrderFileListItem[]>([]);
  const [activePriceTab, setActivePriceTab] = useState<PriceTab>("black-and-white");
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerComment, setCustomerComment] = useState("");
  const [website, setWebsite] = useState("");

  const [personalDataConsent, setPersonalDataConsent] = useState(false);
  const [offerAccepted, setOfferAccepted] = useState(false);
  const [fileRulesAccepted, setFileRulesAccepted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdOrderNumber, setCreatedOrderNumber] = useState("");

  const isAnalyzingFiles = files.some(
    (file) => file.status === "analyzing"
  );

  const analyzingFileCount = files.filter(
    (file) => file.status === "analyzing"
  ).length;

  const hasFileErrors = files.some((file) => file.status === "error");

  const readyFiles = files.filter((file) => file.status === "ready");

  const totalPages = readyFiles.reduce(
    (total, file) => total + (file.pageCount ?? 0),
    0
  );

  /*
  /*
   * Каждый файл рассчитывается отдельно: формат, число копий и режим
   * печати принадлежат именно файлу, а не всему заказу.
   *
   * Для изображений режим всегда односторонний — даже если браузерный
   * запрос был бы искусственно изменён.
   */
  const itemPricings = useMemo(
    () =>
      readyFiles.map((file) => {
        const settings = file.printSettings ?? DEFAULT_PRINT_SETTINGS;

        return {
          file,
          pricing: getPrintPriceForPages({
            pageFormats: file.kind === "document"
              ? getPrintablePageFormats(file.pageCount ?? 0, settings)
              : [settings.defaults.paperFormat],
            printSides: file.kind === "image" ? "one-sided" : settings.printSides,
            copies: settings.copies,
          }),
        };
      }),
    [readyFiles]
  );

  const price = itemPricings.reduce(
    (total, item) => total + item.pricing.totalPrice,
    0
  );

  const totalPrintQuantity = itemPricings.reduce(
    (total, item) => total + item.pricing.quantity,
    0
  );

  const totalPhysicalSheetQuantity = itemPricings.reduce(
    (total, item) => total + item.pricing.physicalSheetQuantity,
    0
  );


  const selectedFile =
    files.find((file) => file.id === selectedFileId) ?? null;

  const selectedFilePrice =
    itemPricings.find((item) => item.file.id === selectedFile?.id)?.pricing
      .totalPrice ?? null;

  const totalSourceFileSize = files.reduce(
    (total, item) => total + item.file.size,
    0
  );

  function removeFile(id: string) {
    setFiles((currentFiles) =>
      currentFiles.filter((file) => file.id !== id)
    );

    setSelectedFileId((currentFileId) => {
      if (currentFileId !== id) {
        return currentFileId;
      }

      return files.find((file) => file.id !== id)?.id ?? null;
    });

    setFormError("");
    setCreatedOrderNumber("");
  }
    function changeFilePrintSettings(
    id: string,
    nextSettings: FilePrintSettings
  ) {
    setFiles((currentFiles) =>
      currentFiles.map((file) => {
        if (file.id !== id) {
          return file;
        }

        return {
          ...file,
          printSettings: {
            ...nextSettings,

            /*
             * Изображения никогда не отправляем на двустороннюю печать.
             */
            printSides:
              file.kind === "image"
                ? "one-sided"
                : nextSettings.printSides,
          },
        };
      })
    );

    setFormError("");
    setCreatedOrderNumber("");
  }
  function applyPrintSettingsToAll(settings: FilePrintSettings) {
    setFiles((currentFiles) =>
      currentFiles.map((file) => ({
        ...file,
        printSettings: {
          ...settings,
          printSides:
            file.kind === "image" ? "one-sided" : settings.printSides,
        },
      }))
    );

    setFormError("");
    setCreatedOrderNumber("");
  }

  async function analyzeAddedFile(id: string, file: File) {
    try {
      const analysis = await analyzeClientFile(file);

      setFiles((currentFiles) =>
        currentFiles.map((currentFile) =>
          currentFile.id === id
            ? {
                ...currentFile,
                kind: analysis.kind,
                pageCount: analysis.pageCount,
                status: "ready",
                error: null,
                draftId: analysis.draftId,
                previewUrl: analysis.previewUrl,
              }
            : currentFile
        )
      );
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Не удалось проверить файл. Удалите его и попробуйте добавить снова.";

      setFiles((currentFiles) =>
        currentFiles.map((currentFile) =>
          currentFile.id === id
            ? {
                ...currentFile,
                status: "error",
                error: message,
              }
            : currentFile
        )
      );
    }
  }

  function addFiles(nextFiles: File[]) {
    if (nextFiles.length === 0) {
      return;
    }

    setFormError("");
    setCreatedOrderNumber("");

    const existingFileKeys = new Set(files.map((item) => makeFileKey(item.file)));

    const uniqueFiles = nextFiles.filter((file) => {
      const key = makeFileKey(file);

      if (existingFileKeys.has(key)) {
        return false;
      }

      existingFileKeys.add(key);
      return true;
    });

    if (uniqueFiles.length === 0) {
      setFormError("Все выбранные файлы уже добавлены в заказ.");
      return;
    }

    if (files.length + uniqueFiles.length > MAX_FILES_PER_ORDER) {
      setFormError(
        `За один заказ можно добавить не больше ${MAX_FILES_PER_ORDER} файлов.`
      );
      return;
    }

    const validationErrors: string[] = [];

    for (const file of uniqueFiles) {
      const validation = validateClientFile(file);

      if (!validation.valid) {
        validationErrors.push(`${file.name}: ${validation.error}`);
      }
    }

    if (validationErrors.length > 0) {
      setFormError(validationErrors.join(" "));
      return;
    }

    const addedFilesSize = uniqueFiles.reduce(
      (total, file) => total + file.size,
      0
    );

    if (totalSourceFileSize + addedFilesSize > MAX_TOTAL_FILE_SIZE) {
      setFormError(
        "Общий размер файлов в одном заказе не должен превышать 200 МБ."
      );
      return;
    }

    const newItems: OrderFileListItem[] = uniqueFiles.map((file) => {
      const validation = validateClientFile(file);

      if (!validation.valid) {
        throw new Error("Не удалось проверить выбранный файл.");
      }

            return {
        id: makeFileId(),
        file,
        kind: validation.kind,
        pageCount: null,
        status: "analyzing",
        error: null,
        draftId: null,
        previewUrl: null,
        printSettings: {
          ...DEFAULT_PRINT_SETTINGS,
          defaults: { ...DEFAULT_PRINT_SETTINGS.defaults },
          pageOverrides: {},
        },
      };
    });

    setFiles((currentFiles) => [...currentFiles, ...newItems]);
    setSelectedFileId((currentFileId) => currentFileId ?? newItems[0].id);
    reachMetrikaGoal("file_selected");

    for (const item of newItems) {
      void analyzeAddedFile(item.id, item.file);
    }
  }

  useEffect(() => {
    const sync = () => setFiles((current) => current.map((file) => {
      if (file.kind !== "document" || !file.draftId) return file;
      try {
        const raw = window.localStorage.getItem(getDraftSettingsStorageKey(file.draftId));
        return raw ? { ...file, printSettings: JSON.parse(raw) } : file;
      } catch { return file; }
    }));
    window.addEventListener("storage", sync);
    window.addEventListener("focus", sync);
    return () => { window.removeEventListener("storage", sync); window.removeEventListener("focus", sync); };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");
    setCreatedOrderNumber("");

    if (files.length === 0) {
      setFormError("Сначала выберите хотя бы один файл для печати.");
      return;
    }

    if (isAnalyzingFiles) {
      setFormError(
        "Подождите: файлы ещё проверяются. Заказ можно оформить после завершения проверки."
      );
      return;
    }

    if (hasFileErrors) {
      setFormError(
        "В списке есть файлы с ошибками проверки. Удалите их или добавьте заново."
      );
      return;
    }

    if (readyFiles.length !== files.length) {
      setFormError(
        "Не все файлы готовы к печати. Проверьте список файлов и попробуйте ещё раз."
      );
      return;
    }

    if (!personalDataConsent) {
      setFormError(
        "Для оформления заказа необходимо согласие на обработку персональных данных."
      );
      return;
    }

    if (!offerAccepted || !fileRulesAccepted) {
      setFormError(
        "Для оформления заказа необходимо принять оферту и правила загрузки файлов."
      );
      return;
    }

    reachMetrikaGoal("order_form_submit");
    setIsSubmitting(true);

    try {
      const formData = new FormData();

      for (const item of readyFiles) {
        if (item.kind === "image") {
          formData.append("imageFiles", item.file, item.file.name);
        }
      }

      formData.append(
        "orderItems",
        JSON.stringify(
          readyFiles.map((item) => ({
            fileId: item.id,
            kind: item.kind,
            ...(item.kind === "document" ? { draftId: item.draftId } : {}),
          }))
        )
      );

      formData.append(
        "fileSettings",
        JSON.stringify(
          readyFiles.map((item) => ({
            fileId: item.id,
            copies: item.printSettings?.copies ?? 1,
            printSides: item.kind === "image" ? "one-sided" : (item.printSettings?.printSides ?? "one-sided"),
            defaults: item.printSettings?.defaults ?? DEFAULT_PRINT_SETTINGS.defaults,
            pageOverrides: item.kind === "document" ? (item.printSettings?.pageOverrides ?? {}) : {},
          }))
        )
      );
      formData.append("customerName", customerName);
      formData.append("customerPhone", customerPhone);
      formData.append("customerEmail", customerEmail);
      formData.append("customerComment", customerComment);
      formData.append("website", website);

      formData.append(
        "personalDataConsent",
        personalDataConsent ? "true" : "false"
      );
      formData.append("offerAccepted", offerAccepted ? "true" : "false");
      formData.append(
        "fileRulesAccepted",
        fileRulesAccepted ? "true" : "false"
      );

      const response = await fetch("/api/orders", {
        method: "POST",
        body: formData,
      });

      const result = (await response.json().catch(() => null)) as {
        orderNumber?: string;
        error?: string;
        requestId?: string;
      } | null;

      if (!response.ok) {
        const requestNote = result?.requestId
          ? ` Номер ошибки: ${result.requestId}`
          : "";

        setFormError(
          `${result?.error ?? "Не удалось создать заказ."}${requestNote}`
        );
        return;
      }

      setCreatedOrderNumber(result?.orderNumber ?? "");
      reachMetrikaGoal("order_created");
    } catch {
      setFormError(
        "Не удалось связаться с сервером. Проверьте интернет и повторите попытку."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <a
            href="/"
            className="text-xl font-black tracking-tight text-blue-700"
          >
            РАСПЕЧАТКА
          </a>

          <nav className="hidden items-center gap-5 text-sm sm:flex">
            <a
              href="/services"
              className="font-semibold text-slate-600 transition hover:text-blue-700"
            >
              Услуги
            </a>

            <span className="text-slate-500">
              Чёрно-белая печать документов в Воронеже
            </span>
          </nav>

          <a
            href="#order"
            className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Оформить заказ
          </a>
        </div>
      </header>

      <section className="mx-auto max-w-6xl px-5 pb-16 pt-12 sm:pt-16">
        <div className="mb-10 max-w-3xl">
          <p className="mb-3 text-sm font-bold uppercase tracking-wider text-blue-700">
            Печать документов онлайн
          </p>

          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Загрузите файлы — мы распечатаем их
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            Чёрно-белая печать форматов A4 и A3. Добавьте документы или
            изображения, выберите параметры, узнайте предварительную стоимость
            и оформите заказ.
          </p>
        </div>

        <section
          aria-labelledby="other-services-heading"
          className="mb-10 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
        >
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
                Типография Copyleft
              </p>

              <h2
                id="other-services-heading"
                className="mt-2 text-2xl font-bold"
              >
                Другие услуги печати
              </h2>

              <p className="mt-2 max-w-2xl leading-7 text-slate-600">
                Цветная печать, фотопечать, ламинация и переплёт уже доступны
                в типографии. Онлайн-калькуляторы для этих услуг готовятся.
              </p>
            </div>

            <a
              href="/services"
              className="shrink-0 font-semibold text-blue-700 underline underline-offset-4 hover:text-blue-800"
            >
              Все услуги →
            </a>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <a
              href="/color-printing"
              className="rounded-2xl bg-slate-50 p-4 font-semibold text-slate-800 transition hover:bg-blue-50 hover:text-blue-700"
            >
              Цветная печать
            </a>

            <a
              href="/photo-printing"
              className="rounded-2xl bg-slate-50 p-4 font-semibold text-slate-800 transition hover:bg-blue-50 hover:text-blue-700"
            >
              Фотопечать
            </a>

            <a
              href="/lamination"
              className="rounded-2xl bg-slate-50 p-4 font-semibold text-slate-800 transition hover:bg-blue-50 hover:text-blue-700"
            >
              Ламинация
            </a>

            <a
              href="/metal-binding"
              className="rounded-2xl bg-slate-50 p-4 font-semibold text-slate-800 transition hover:bg-blue-50 hover:text-blue-700"
            >
              Переплёт документов
            </a>
          </div>
        </section>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"
        >
          <div
            aria-hidden="true"
            className="absolute -left-[10000px] top-auto h-px w-px overflow-hidden"
          >
            <label>
              Не заполняйте это поле
              <input
                type="text"
                name="website"
                value={website}
                onChange={(event) => setWebsite(event.target.value)}
                tabIndex={-1}
                autoComplete="off"
              />
            </label>
          </div>

          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">1. Загрузите файлы</h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Можно добавить до 8 файлов: документы PDF, DOC, DOCX, XLS, XLSX,
              PPT, PPTX, ODT, ODS, RTF и изображения JPG, JPEG, PNG.
            </p>

            <OrderFileDropzone
              disabled={isSubmitting}
              isProcessing={isAnalyzingFiles}
              onFilesSelected={addFiles}
            />

            <OrderFileList
              items={files}
              onRemove={removeFile}
              selectedFileId={selectedFileId}
              onSelectFile={setSelectedFileId}
            />

            {isAnalyzingFiles && (
              <div
                className="mt-4 flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-950"
                role="status"
                aria-live="polite"
              >
                <svg
                  className="h-5 w-5 shrink-0 animate-spin text-blue-700"
                  viewBox="0 0 24 24"
                  fill="none"
                  aria-hidden="true"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="9"
                    stroke="currentColor"
                    strokeWidth="3"
                  />
                  <path
                    d="M21 12a9 9 0 0 0-9-9"
                    stroke="currentColor"
                    strokeWidth="3"
                    strokeLinecap="round"
                  />
                </svg>
                <span>
                  Подготавливаем файлы: {analyzingFileCount} из {files.length}.
                  Подождите, пока завершится проверка.
                </span>
              </div>
            )}

            <div className="mt-6 lg:hidden">
              <PrintSettingsPanel
                selectedFile={selectedFile}
                selectedFilePrice={selectedFilePrice}
                onPrintSettingsChange={changeFilePrintSettings}
                onApplyToAll={applyPrintSettingsToAll}
              />
            </div>

            {files.length > 0 && (
              <p className="mt-4 text-sm text-slate-500">
                Добавлено файлов: {files.length} из {MAX_FILES_PER_ORDER}.
                {" "}
                Общий размер:{" "}
                {Math.max(1, Math.round(totalSourceFileSize / 1024 / 1024))} МБ
                {" "}
                из 200 МБ.
              </p>
            )}

            <div className="mt-8 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold">2. Стоимость печати</h2>

              <div className="mt-6 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
                <div
                  className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-slate-50 p-2"
                  role="tablist"
                  aria-label="Тип печати"
                >
                  {PRICE_TABS.map((tab) => {
                    const isActive = activePriceTab === tab;
                    const table = PRICE_TABLES[tab];

                    return (
                      <button
                        key={tab}
                        type="button"
                        role="tab"
                        id={`price-tab-${tab}`}
                        aria-controls={`price-panel-${tab}`}
                        aria-selected={isActive}
                        onClick={() => setActivePriceTab(tab)}
                        className={`min-h-11 shrink-0 rounded-2xl px-4 py-2.5 text-sm font-bold transition sm:px-5 ${
                          isActive
                            ? "bg-slate-900 text-white shadow-sm"
                            : "text-slate-600 hover:bg-white hover:text-slate-900"
                        }`}
                      >
                        <span className="sm:hidden">{table.shortLabel}</span>
                        <span className="hidden sm:inline">{table.label}</span>
                      </button>
                    );
                  })}
                </div>

                {PRICE_TABS.map((tab) => {
                  const isActive = activePriceTab === tab;
                  const table = PRICE_TABLES[tab];
                  const isBlackAndWhite = table.accent === "blue";
                  const accentClass = isBlackAndWhite
                    ? "text-blue-700"
                    : table.accent === "violet"
                      ? "text-violet-700"
                      : "text-fuchsia-700";

                  return (
                    <div
                      key={tab}
                      id={`price-panel-${tab}`}
                      role="tabpanel"
                      aria-labelledby={`price-tab-${tab}`}
                      hidden={!isActive}
                      className="p-4 sm:p-6"
                    >
                      <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className={`text-base font-bold ${accentClass}`}>
                            {table.label}
                          </p>
                          <p className="mt-1 max-w-3xl text-xs leading-5 text-slate-500 sm:text-sm">
                            {table.description}
                          </p>
                        </div>
                        <span className="w-fit rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-600">
                          Цена за 1 сторону
                        </span>
                      </div>

                      <div className="overflow-x-auto rounded-2xl border border-slate-100">
                        <table className="min-w-full text-left text-xs sm:text-sm">
                          <thead className="bg-slate-50 text-slate-500">
                            <tr>
                              <th className="px-4 py-3 font-semibold">Тираж</th>
                              <th className="px-4 py-3 font-semibold">A4</th>
                              <th className="px-4 py-3 font-semibold">A3</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 text-slate-700">
                            {table.tiers.map((tier, index) => {
                              const isLast = index === table.tiers.length - 1;
                              return (
                                <tr key={tier.quantity} className={isLast ? "bg-slate-50/70" : ""}>
                                  <td className="px-4 py-3 font-medium">{tier.quantity}</td>
                                  <td className={`px-4 py-3 ${isLast ? `font-bold ${accentClass}` : ""}`}>
                                    {tier.a4} ₽
                                  </td>
                                  <td className={`px-4 py-3 ${isLast ? `font-bold ${accentClass}` : ""}`}>
                                    {tier.a4 * 2} ₽
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold">3. Контактные данные</h2>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Ваше имя *
                  </span>

                  <input
                    required
                    value={customerName}
                    onChange={(event) => setCustomerName(event.target.value)}
                    placeholder="Иван Иванов"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Телефон *
                  </span>

                  <input
                    required
                    type="tel"
                    value={customerPhone}
                    onChange={(event) => setCustomerPhone(event.target.value)}
                    placeholder="+7 900 000-00-00"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">
                    Email{" "}
                    <span className="font-normal text-slate-400">
                      (необязательно)
                    </span>
                  </span>

                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(event) => setCustomerEmail(event.target.value)}
                    placeholder="mail@example.ru"
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block sm:col-span-2">
                  <span className="mb-2 block text-sm font-semibold">
                    Комментарий к заказу
                  </span>

                  <textarea
                    rows={3}
                    value={customerComment}
                    onChange={(event) =>
                      setCustomerComment(event.target.value)
                    }
                    placeholder="Например: позвоните, когда заказ будет готов."
                    className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
            </div>

            <div className="mt-8 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold">4. Подтвердите условия</h2>

              <div className="mt-5 space-y-4">
                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600">
                  <input
                    type="checkbox"
                    checked={personalDataConsent}
                    onChange={(event) =>
                      setPersonalDataConsent(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />

                  <span>
                    Я даю согласие на обработку персональных данных в
                    соответствии с{" "}
                    <a
                      href="/personal-data-consent"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-700 underline"
                    >
                      Согласием
                    </a>{" "}
                    и{" "}
                    <a
                      href="/privacy"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-700 underline"
                    >
                      Политикой обработки персональных данных
                    </a>
                    .
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600">
                  <input
                    type="checkbox"
                    checked={offerAccepted}
                    onChange={(event) =>
                      setOfferAccepted(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />

                  <span>
                    Я принимаю условия{" "}
                    <a
                      href="/offer"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-700 underline"
                    >
                      Публичной оферты
                    </a>
                    .
                  </span>
                </label>

                <label className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-slate-600">
                  <input
                    type="checkbox"
                    checked={fileRulesAccepted}
                    onChange={(event) =>
                      setFileRulesAccepted(event.target.checked)
                    }
                    className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300 text-blue-700 focus:ring-blue-600"
                  />

                  <span>
                    Я ознакомился(ась) и согласен(на) с{" "}
                    <a
                      href="/file-rules"
                      target="_blank"
                      rel="noreferrer"
                      className="font-semibold text-blue-700 underline"
                    >
                      Правилами загрузки и хранения файлов
                    </a>
                    .
                  </span>
                </label>
              </div>

              <p className="mt-4 text-xs leading-5 text-slate-500">
                Предварительная стоимость может измениться после проверки файла
                сотрудником. Печать по изменённой стоимости начнётся только
                после вашего подтверждения.
              </p>
            </div>
          </section>

            <div className="hidden min-w-0 space-y-6 lg:sticky lg:top-6 lg:block lg:self-start">
            <PrintSettingsPanel
              selectedFile={selectedFile}
              selectedFilePrice={selectedFilePrice}
              onPrintSettingsChange={changeFilePrintSettings}
              onApplyToAll={applyPrintSettingsToAll}
            />

            <aside
              id="order"
              className="rounded-3xl bg-slate-900 p-6 text-white shadow-xl sm:p-8"
            >
            <p className="text-sm font-bold uppercase tracking-wider text-blue-300">
              Ваш заказ
            </p>

            <h2 className="mt-3 text-2xl font-bold">Чёрно-белая печать</h2>

            <div className="mt-7 space-y-4 border-y border-slate-700 py-6 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Файлов</span>
                <span className="font-semibold">{files.length}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Страниц</span>
                <span className="font-semibold">{totalPages}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Настройки</span>
                <span className="text-right font-semibold">
                  Для каждого файла отдельно
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Физических листов</span>
                <span className="font-semibold">{totalPhysicalSheetQuantity}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Получение</span>
                <span className="text-right font-semibold">Самовывоз</span>
              </div>
            </div>

            <div className="mt-6 rounded-2xl bg-white/10 p-4">
              <div className="flex justify-between gap-4 text-sm">
                <span className="text-slate-300">Общий тираж</span>
                <span className="font-semibold">{totalPrintQuantity} стр.</span>
              </div>

              <div className="mt-3 flex justify-between gap-4 text-sm">
                <span className="text-slate-300">Расчёт</span>
                <span className="text-right font-semibold">
                  По каждому файлу
                </span>
              </div>

              <div className="mt-3 text-xs leading-5 text-slate-400">
                Скидка определяется отдельно для каждого файла — так же, как
                при серверном создании заказа.
              </div>
            </div>

            <div className="mt-6 flex items-end justify-between gap-4">
              <span className="text-slate-300">
                Предварительная стоимость
              </span>
              <span className="text-3xl font-black">{price} ₽</span>
            </div>

            {isAnalyzingFiles && (
              <p className="mt-4 rounded-xl bg-blue-500/20 p-3 text-sm font-medium text-blue-100">
                Проверяем добавленные файлы и считаем страницы…
              </p>
            )}

            {formError && (
              <p className="mt-5 rounded-xl bg-red-500/20 p-3 text-sm font-medium text-red-100">
                {formError}
              </p>
            )}

            {createdOrderNumber && (
              <div className="mt-5 rounded-2xl bg-emerald-500/20 p-4">
                <p className="text-sm font-bold text-emerald-200">
                  Заказ успешно создан
                </p>

                <p className="mt-2 text-xl font-black">
                  {createdOrderNumber}
                </p>

                <p className="mt-2 text-sm leading-5 text-emerald-50">
                  Мы свяжемся с вами для подтверждения заказа.
                </p>
              </div>
            )}

            <button
              type="submit"
              disabled={
                isSubmitting ||
                isAnalyzingFiles ||
                files.length === 0 ||
                hasFileErrors
              }
              className="mt-7 w-full rounded-xl bg-blue-600 px-5 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Создаём заказ..."
                : isAnalyzingFiles
                  ? "Проверяем файлы..."
                  : "Оформить заказ"}
            </button>

            <p className="mt-4 text-center text-xs leading-5 text-slate-400">
              Самовывоз: Воронеж, ул. Шукшина, д. 21, офис 8.
            </p>
            </aside>
          </div>
        </form>
      </section>

      <SiteFooter />
    </main>
  );
}