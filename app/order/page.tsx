"use client";

/*
 * Сюда временно перенесена прежняя форма оформления заказа с главной.
 * Когда появится новый дизайн страницы заказа, этот файл заменится.
 */

import { FormEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
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
import { SiteHeader } from "@/components/site-header";
import { reachMetrikaGoal } from "@/lib/metrika";
import { getPrintPriceForPages } from "@/lib/pricing";
import { DEFAULT_PRINT_SETTINGS, getDraftSettingsStorageKey, getPrintablePageOptions } from "@/lib/print-settings";
import { PrintSettingsPanel } from "@/components/print-settings-panel";


function getFilesWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "файл";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "файла";
  return "файлов";
}

function getPagesWord(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return "страница";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "страницы";
  return "страниц";
}

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
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);

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
            pageOptions: file.kind === "document"
              ? getPrintablePageOptions(file.pageCount ?? 0, settings)
              : [{ paperFormat: settings.defaults.paperFormat, colorMode: settings.defaults.colorMode }],
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

  const documentsPrice = itemPricings
    .filter((item) => item.file.kind === "document")
    .reduce((total, item) => total + item.pricing.totalPrice, 0);

  const imagesPrice = itemPricings
    .filter((item) => item.file.kind === "image")
    .reduce((total, item) => total + item.pricing.totalPrice, 0);

  /*
   * «Далее» в нижней панели на мобильном: заказ не отправляет, а прокручивает
   * к блоку «Ваш заказ», где согласия и кнопка оформления.
   */
  function scrollToOrderSummary() {
    document.getElementById("order")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const totalPhysicalSheetQuantity = itemPricings.reduce(
    (total, item) => total + item.pricing.physicalSheetQuantity,
    0
  );


  const filePrices = useMemo(
    () =>
      Object.fromEntries(
        itemPricings.map((item) => [item.file.id, item.pricing.totalPrice])
      ) as Record<string, number>,
    [itemPricings]
  );

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
        checkoutUrl?: string;
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

      if (result?.checkoutUrl && /^\/orders\/[1-9][0-9]*\/checkout$/.test(result.checkoutUrl)) {
        window.location.assign(result.checkoutUrl);
        return;
      }
      setFormError("Не удалось открыть оформление заказа. Обновите страницу и попробуйте снова.");
    } catch {
      setFormError(
        "Не удалось связаться с сервером. Проверьте интернет и повторите попытку."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className={`min-h-screen bg-slate-50 text-slate-900 ${files.length > 0 ? "pb-24 lg:pb-0" : ""}`}>
      <SiteHeader />

      <section className="mx-auto max-w-7xl px-5 py-8 sm:py-10">
        <nav className="text-sm text-slate-500" aria-label="Навигация">
          <Link href="/" className="hover:text-blue-700">Главная</Link> / <span className="text-slate-700">Новый заказ</span>
        </nav>

        <div className="mb-8 mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Настройте заказ</h1>
            <p className="mt-2 max-w-xl leading-7 text-slate-600">
              Проверьте файлы, выберите параметры печати и узнайте итоговую стоимость.
            </p>
          </div>

          <ol className="grid w-full max-w-md grid-cols-3 gap-2 text-xs font-semibold text-slate-500 sm:text-sm" aria-label="Этапы заказа">
            <li aria-current="step"><span className="block h-1.5 rounded-full bg-blue-600" /><span className="mt-2 block text-slate-900">1. Файлы</span></li>
            <li><span className="block h-1.5 rounded-full bg-slate-200" /><span className="mt-2 block">2. Получение</span></li>
            <li><span className="block h-1.5 rounded-full bg-slate-200" /><span className="mt-2 block">3. Оплата</span></li>
          </ol>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]"
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

          <section id="upload" className="scroll-mt-24 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">Файлы для печати</h2>

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
              prices={filePrices}
              onCollapse={() => setSelectedFileId(null)}
              renderSettings={(item) => (
                <PrintSettingsPanel
                  variant="inline"
                  selectedFile={item}
                  selectedFilePrice={filePrices[item.id] ?? null}
                  onPrintSettingsChange={changeFilePrintSettings}
                  onApplyToAll={applyPrintSettingsToAll}
                />
              )}
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

          </section>

            <div className="min-w-0 space-y-6 lg:self-start">
            <aside
              id="order"
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
            >
            <h2 className="text-xl font-black text-slate-950">Ваш заказ</h2>
            <p className="mt-1 text-sm text-slate-500">
              {files.length} {getFilesWord(files.length)} · {totalPages} {getPagesWord(totalPages)}
            </p>

            <dl className="mt-5 space-y-2.5 border-b border-slate-100 pb-5 text-sm">
              {documentsPrice > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Печать документов</dt>
                  <dd className="font-semibold text-slate-900">{documentsPrice} ₽</dd>
                </div>
              )}

              {imagesPrice > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Печать фото и изображений</dt>
                  <dd className="font-semibold text-slate-900">{imagesPrice} ₽</dd>
                </div>
              )}

              <div className="flex justify-between gap-4">
                <dt className="text-slate-600">Листов бумаги</dt>
                <dd className="font-semibold text-slate-900">{totalPhysicalSheetQuantity}</dd>
              </div>

              {readyFiles.length === 0 && (
                <p className="text-slate-500">Добавьте файлы, чтобы увидеть стоимость.</p>
              )}
            </dl>

            <div className="mt-5 flex items-baseline justify-between gap-4">
              <span className="text-lg font-black text-slate-950">Итого:</span>
              <span className="text-3xl font-black text-slate-950">{price} ₽</span>
            </div>
            <p className="mt-1 text-xs leading-5 text-slate-500">
              Предварительная стоимость. Доставка рассчитывается на следующем шаге.
            </p>

            {isAnalyzingFiles && (
              <p className="mt-4 rounded-xl bg-blue-50 p-3 text-sm font-medium text-blue-900">
                Проверяем добавленные файлы и считаем страницы…
              </p>
            )}

            {formError && (
              <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
                {formError}
              </p>
            )}

            {createdOrderNumber && (
              <div className="mt-4 rounded-xl bg-emerald-50 p-4 ring-1 ring-emerald-100">
                <p className="text-sm font-bold text-emerald-800">Заказ успешно создан</p>
                <p className="mt-1 text-xl font-black text-slate-950">{createdOrderNumber}</p>
                <p className="mt-1 text-sm leading-5 text-emerald-900">
                  Мы свяжемся с вами для подтверждения заказа.
                </p>
              </div>
            )}

            <div className="mt-5 space-y-2.5 text-xs text-slate-600">
              <label className="flex cursor-pointer gap-2.5 leading-5"><input type="checkbox" checked={personalDataConsent} onChange={(event) => setPersonalDataConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300" /><span>Согласен на <a className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800" href="/personal-data-consent" target="_blank" rel="noreferrer">обработку персональных данных</a>.</span></label>
              <label className="flex cursor-pointer gap-2.5 leading-5"><input type="checkbox" checked={offerAccepted} onChange={(event) => setOfferAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300" /><span>Принимаю условия <a className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800" href="/offer" target="_blank" rel="noreferrer">публичной оферты</a>.</span></label>
              <label className="flex cursor-pointer gap-2.5 leading-5"><input type="checkbox" checked={fileRulesAccepted} onChange={(event) => setFileRulesAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300" /><span>Ознакомился с <a className="font-semibold text-blue-700 underline underline-offset-2 hover:text-blue-800" href="/file-rules" target="_blank" rel="noreferrer">требованиями к файлам</a>.</span></label>
            </div>

            <button
              type="submit"
              disabled={
                isSubmitting ||
                isAnalyzingFiles ||
                files.length === 0 ||
                hasFileErrors
              }
              className="mt-5 w-full rounded-xl bg-amber-500 px-5 py-4 font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting
                ? "Создаём заказ..."
                : isAnalyzingFiles
                  ? "Проверяем файлы..."
                  : "Перейти к получению"}
            </button>

            <p className="mt-3 text-center text-xs leading-5 text-slate-500">
              Самовывоз: Воронеж, ул. Шукшина, д. 21, офис 8.
            </p>
            </aside>
          </div>
        </form>
      </section>

      {files.length > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white/95 px-5 py-3 shadow-[0_-4px_16px_rgba(15,23,42,0.08)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
            <p className="text-lg font-black text-slate-950">Итого: {price} ₽</p>
            <button
              type="button"
              onClick={scrollToOrderSummary}
              className="rounded-xl bg-amber-500 px-6 py-3 text-sm font-bold text-white transition hover:bg-amber-600"
            >
              Далее
            </button>
          </div>
        </div>
      )}

      <SiteFooter />
    </main>
  );
}