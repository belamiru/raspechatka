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

  const totalPrintQuantity = itemPricings.reduce(
    (total, item) => total + item.pricing.quantity,
    0
  );

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

  /*
   * «Настроить» в карточке файла: на мобильном панель параметров стоит под
   * списком, поэтому прокручиваем к ней. На компьютере она видна справа.
   */
  function scrollToPrintSettings() {
    const target =
      window.matchMedia("(min-width: 1024px)").matches
        ? document.getElementById("print-settings-desktop")
        : document.getElementById("print-settings-mobile");
    target?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

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
    <main className="min-h-screen bg-slate-50 text-slate-900">
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
              onConfigure={scrollToPrintSettings}
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

            <div id="print-settings-mobile" className="mt-6 scroll-mt-4 lg:hidden">
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

          </section>

            <div className="min-w-0 space-y-6 lg:self-start">
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

            <div className="mt-7 space-y-3 border-t border-white/15 pt-5 text-sm text-slate-200">
              <label className="flex cursor-pointer gap-3 leading-5"><input type="checkbox" checked={personalDataConsent} onChange={(event) => setPersonalDataConsent(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300" /><span>Согласен на <a className="underline underline-offset-2 hover:text-white" href="/personal-data-consent" target="_blank" rel="noreferrer">обработку персональных данных</a>.</span></label>
              <label className="flex cursor-pointer gap-3 leading-5"><input type="checkbox" checked={offerAccepted} onChange={(event) => setOfferAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300" /><span>Принимаю условия <a className="underline underline-offset-2 hover:text-white" href="/offer" target="_blank" rel="noreferrer">публичной оферты</a>.</span></label>
              <label className="flex cursor-pointer gap-3 leading-5"><input type="checkbox" checked={fileRulesAccepted} onChange={(event) => setFileRulesAccepted(event.target.checked)} className="mt-1 h-4 w-4 shrink-0 rounded border-slate-300" /><span>Ознакомился с <a className="underline underline-offset-2 hover:text-white" href="/file-rules" target="_blank" rel="noreferrer">требованиями к файлам</a>.</span></label>
            </div>

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

            <div id="print-settings-desktop" className="hidden scroll-mt-6 lg:block">
              <PrintSettingsPanel
                selectedFile={selectedFile}
                selectedFilePrice={selectedFilePrice}
                onPrintSettingsChange={changeFilePrintSettings}
                onApplyToAll={applyPrintSettingsToAll}
              />
            </div>
          </div>
        </form>
      </section>

      <SiteFooter />
    </main>
  );
}