"use client";

import {
  ChangeEvent,
  DragEvent,
  FormEvent,
  useMemo,
  useRef,
  useState,
} from "react";
import { SiteFooter } from "@/components/site-footer";
import { reachMetrikaGoal } from "@/lib/metrika";
import { getPrintPrice } from "@/lib/pricing";

type PrintFormat = "A4" | "A3";
type PrintSide = "one-sided" | "two-sided";
type FileStatus = "analyzing" | "ready" | "error";
type FileKind = "document" | "image";

type SelectedOrderFile = {
  id: string;
  file: File;
  status: FileStatus;
  kind?: FileKind;
  pageCount?: number;
  error?: string;
};

const MAX_FILES_PER_ORDER = 8;
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_TOTAL_FILE_SIZE = 200 * 1024 * 1024;
const SUPPORTED_EXTENSIONS = [
  "pdf",
  "docx",
  "xlsx",
  "pptx",
  "jpg",
  "jpeg",
  "png",
];

function getFileExtension(fileName: string) {
  return fileName.split(".").pop()?.toLowerCase() ?? "";
}

function formatFileSize(size: number) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} КБ`;
  }

  return `${(size / (1024 * 1024)).toFixed(1)} МБ`;
}

function createFileId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export default function Home() {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [selectedFiles, setSelectedFiles] = useState<SelectedOrderFile[]>([]);
  const [format, setFormat] = useState<PrintFormat>("A4");
  const [copies, setCopies] = useState(1);
  const [sides, setSides] = useState<PrintSide>("one-sided");

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

  const readyFiles = useMemo(
    () =>
      selectedFiles.filter(
        (item): item is SelectedOrderFile & { pageCount: number } =>
          item.status === "ready" && typeof item.pageCount === "number"
      ),
    [selectedFiles]
  );

  const isAnalyzingFiles = selectedFiles.some(
    (item) => item.status === "analyzing"
  );

  const hasFileErrors = selectedFiles.some((item) => item.status === "error");

  const totalPages = readyFiles.reduce(
    (total, item) => total + item.pageCount,
    0
  );

  const totalSourceFileSize = selectedFiles.reduce(
    (total, item) => total + item.file.size,
    0
  );

  const filePrices = useMemo(
    () =>
      readyFiles.map((item) => ({
        id: item.id,
        pricing: getPrintPrice({
          paperFormat: format,
          printSides: sides,
          pageCount: item.pageCount,
          copies,
        }),
      })),
    [copies, format, readyFiles, sides]
  );

  const price = filePrices.reduce(
    (total, item) => total + item.pricing.totalPrice,
    0
  );

  const totalPrintQuantity = filePrices.reduce(
    (total, item) => total + item.pricing.quantity,
    0
  );

  function updateFile(id: string, changes: Partial<SelectedOrderFile>) {
    setSelectedFiles((currentFiles) =>
      currentFiles.map((item) =>
        item.id === id ? { ...item, ...changes } : item
      )
    );
  }

  async function analyzeFile(item: SelectedOrderFile) {
    try {
      const formData = new FormData();
      formData.append("file", item.file);

      const response = await fetch("/api/files/analyze", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const result = (await response.json().catch(() => null)) as {
          error?: string;
        } | null;

        throw new Error(
          result?.error ?? "Не удалось проверить файл для печати."
        );
      }

      const contentType = response.headers.get("content-type") ?? "";
      const fileKind = response.headers.get("x-file-kind");

      if (contentType.includes("application/json")) {
        const result = (await response.json()) as {
          success?: boolean;
          kind?: FileKind;
          pageCount?: number;
        };

        if (
          result.kind !== "image" ||
          !Number.isInteger(result.pageCount) ||
          !result.pageCount ||
          result.pageCount < 1
        ) {
          throw new Error(
            "Сервис вернул некорректные данные при проверке изображения."
          );
        }

        updateFile(item.id, {
          status: "ready",
          kind: "image",
          pageCount: result.pageCount,
          error: undefined,
        });

        return;
      }

      const pageCount = Number(response.headers.get("x-page-count"));

      if (
        fileKind !== "document" ||
        !Number.isInteger(pageCount) ||
        pageCount < 1 ||
        pageCount > 10_000
      ) {
        throw new Error(
          "Сервис вернул некорректное количество страниц документа."
        );
      }

      const pdfBlob = await response.blob();

      if (pdfBlob.size < 5 || pdfBlob.type !== "application/pdf") {
        throw new Error(
          "Сервис подготовки файлов вернул результат в некорректном формате."
        );
      }

      updateFile(item.id, {
        status: "ready",
        kind: "document",
        pageCount,
        error: undefined,
      });
    } catch (error) {
      updateFile(item.id, {
        status: "error",
        error:
          error instanceof Error
            ? error.message
            : "Не удалось проверить файл. Попробуйте ещё раз.",
      });
    }
  }

  function addFiles(files: FileList | File[]) {
    const incomingFiles = Array.from(files);

    if (incomingFiles.length === 0) {
      return;
    }

    setFormError("");
    setCreatedOrderNumber("");

    const availableSlots = MAX_FILES_PER_ORDER - selectedFiles.length;

    if (availableSlots <= 0) {
      setFormError(
        `В один заказ можно добавить не более ${MAX_FILES_PER_ORDER} файлов.`
      );
      return;
    }

    if (incomingFiles.length > availableSlots) {
      setFormError(
        `Можно добавить ещё только ${availableSlots} файл(а). Максимум — ${MAX_FILES_PER_ORDER} файлов в заказе.`
      );
    }

    const filesToAdd = incomingFiles.slice(0, availableSlots);
    const currentSize = selectedFiles.reduce(
      (total, item) => total + item.file.size,
      0
    );

    const validItems: SelectedOrderFile[] = [];
    let accumulatedSize = currentSize;
    let validationError = "";

    for (const file of filesToAdd) {
      const extension = getFileExtension(file.name);

      if (!SUPPORTED_EXTENSIONS.includes(extension)) {
        validationError = `${file.name}: поддерживаются PDF, DOCX, XLSX, PPTX, JPG, JPEG и PNG.`;
        continue;
      }

      if (file.size < 1) {
        validationError = `${file.name}: файл пустой.`;
        continue;
      }

      if (file.size > MAX_FILE_SIZE) {
        validationError = `${file.name}: размер одного файла не должен превышать 50 МБ.`;
        continue;
      }

      if (accumulatedSize + file.size > MAX_TOTAL_FILE_SIZE) {
        validationError =
          "Общий размер файлов в одном заказе не должен превышать 200 МБ.";
        continue;
      }

      accumulatedSize += file.size;

      validItems.push({
        id: createFileId(),
        file,
        status: "analyzing",
      });
    }

    if (validationError) {
      setFormError(validationError);
    }

    if (validItems.length === 0) {
      return;
    }

    setSelectedFiles((currentFiles) => [...currentFiles, ...validItems]);
    reachMetrikaGoal("file_selected");

    validItems.forEach((item) => {
      void analyzeFile(item);
    });
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    if (event.target.files) {
      addFiles(event.target.files);
    }

    event.target.value = "";
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();

    if (event.dataTransfer.files) {
      addFiles(event.dataTransfer.files);
    }
  }

  function removeFile(id: string) {
    setSelectedFiles((currentFiles) =>
      currentFiles.filter((item) => item.id !== id)
    );
    setFormError("");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");
    setCreatedOrderNumber("");

    if (selectedFiles.length === 0) {
      setFormError("Сначала выберите хотя бы один файл для печати.");
      return;
    }

    if (isAnalyzingFiles) {
      setFormError("Подождите: файлы ещё проверяются.");
      return;
    }

    if (hasFileErrors) {
      setFormError(
        "Удалите файлы с ошибками или загрузите их повторно перед оформлением заказа."
      );
      return;
    }

    if (readyFiles.length !== selectedFiles.length) {
      setFormError("Не все файлы готовы к оформлению заказа.");
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

      readyFiles.forEach((item) => {
        formData.append("files", item.file);
      });

      formData.append("paperFormat", format);
      formData.append("copies", String(copies));
      formData.append("printSides", sides);
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
        error?: string;
        requestId?: string;
        orderNumber?: string;
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

      if (result?.orderNumber) {
        setCreatedOrderNumber(result.orderNumber);
        reachMetrikaGoal("order_created");
      }
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
            Добавьте до 8 документов или изображений, выберите параметры
            печати, узнайте предварительную стоимость и оформите заказ.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"
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
              Поддерживаются PDF, DOCX, XLSX, PPTX, JPG, JPEG и PNG. До 8
              файлов в одном заказе, не более 50 МБ каждый и до 200 МБ суммарно.
            </p>

            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className="mt-6 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 text-center transition hover:border-blue-600 hover:bg-blue-100"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-3xl text-white">
                ↑
              </div>

              <span className="text-lg font-bold">
                Перетащите файлы сюда
              </span>

              <span className="mt-2 text-sm text-slate-500">
                или нажмите, чтобы выбрать на компьютере
              </span>

              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.docx,.xlsx,.pptx,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {selectedFiles.length > 0 && (
              <div className="mt-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-semibold text-slate-800">
                    Добавленные файлы: {selectedFiles.length} из{" "}
                    {MAX_FILES_PER_ORDER}
                  </p>

                  <p className="text-sm text-slate-500">
                    Всего загружено: {formatFileSize(totalSourceFileSize)}
                  </p>
                </div>

                {selectedFiles.map((item) => (
                  <div
                    key={item.id}
                    className={`rounded-2xl border p-4 ${
                      item.status === "error"
                        ? "border-red-200 bg-red-50"
                        : item.status === "ready"
                          ? "border-emerald-200 bg-emerald-50"
                          : "border-blue-200 bg-blue-50"
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-slate-800">
                          {item.file.name}
                        </p>

                        <p className="mt-1 text-sm text-slate-500">
                          {formatFileSize(item.file.size)}
                          {item.status === "ready" && item.pageCount
                            ? ` · ${item.pageCount} ${
                                item.pageCount === 1 ? "страница" : "страниц"
                              }`
                            : ""}
                        </p>

                        {item.status === "analyzing" && (
                          <p className="mt-2 text-sm font-medium text-blue-700">
                            Проверяется…
                          </p>
                        )}

                        {item.status === "ready" && (
                          <p className="mt-2 text-sm font-medium text-emerald-700">
                            Готов к печати
                          </p>
                        )}

                        {item.status === "error" && (
                          <p className="mt-2 text-sm font-medium text-red-700">
                            Ошибка: {item.error}
                          </p>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() => removeFile(item.id)}
                        className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 transition hover:bg-red-100"
                      >
                        Удалить
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-8 border-t border-slate-100 pt-8">
              <h2 className="text-2xl font-bold">2. Настройте печать</h2>

              <div className="mt-6 grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Формат бумаги
                  </span>

                  <select
                    value={format}
                    onChange={(event) =>
                      setFormat(event.target.value as PrintFormat)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="A4">A4 — от 8 до 20 ₽ за страницу</option>
                    <option value="A3">A3 — от 16 до 40 ₽ за страницу</option>
                  </select>
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Количество копий
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={copies}
                    onChange={(event) =>
                      setCopies(Math.max(1, Number(event.target.value) || 1))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Всего страниц в файлах
                  </span>

                  <input
                    type="number"
                    value={totalPages}
                    readOnly
                    aria-readonly="true"
                    className="w-full cursor-not-allowed rounded-xl border border-slate-300 bg-slate-100 px-4 py-3 text-slate-700 outline-none"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Стороны печати
                  </span>

                  <select
                    value={sides}
                    onChange={(event) =>
                      setSides(event.target.value as PrintSide)
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  >
                    <option value="one-sided">Односторонняя</option>
                    <option value="two-sided">Двусторонняя (× 2)</option>
                  </select>
                </label>
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
                    onChange={(event) => setOfferAccepted(event.target.checked)}
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

          <aside
            id="order"
            className="h-fit rounded-3xl bg-slate-900 p-6 text-white shadow-xl sm:p-8 lg:sticky lg:top-6"
          >
            <p className="text-sm font-bold uppercase tracking-wider text-blue-300">
              Ваш заказ
            </p>

            <h2 className="mt-3 text-2xl font-bold">Чёрно-белая печать</h2>

            <div className="mt-7 space-y-4 border-y border-slate-700 py-6 text-sm">
              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Файлов</span>
                <span className="font-semibold">
                  {readyFiles.length} из {selectedFiles.length}
                </span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Страниц</span>
                <span className="font-semibold">{totalPages}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Формат</span>
                <span className="font-semibold">{format}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Копий</span>
                <span className="font-semibold">{copies}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Печать</span>
                <span className="text-right font-semibold">
                  {sides === "one-sided"
                    ? "Односторонняя"
                    : "Двусторонняя"}
                </span>
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

              <p className="mt-3 text-xs leading-5 text-slate-400">
                Цена рассчитывается отдельно для каждого файла по количеству
                его страниц и выбранному тиражу.
              </p>
            </div>

            <div className="mt-6 flex items-end justify-between gap-4">
              <span className="text-slate-300">
                Предварительная стоимость
              </span>
              <span className="text-3xl font-black">{price} ₽</span>
            </div>

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
                selectedFiles.length === 0 ||
                isAnalyzingFiles ||
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
        </form>
      </section>

      <SiteFooter />
    </main>
  );
}