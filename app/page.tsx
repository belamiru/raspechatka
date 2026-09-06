"use client";

import { ChangeEvent, DragEvent, FormEvent, useMemo, useState } from "react";
import { SiteFooter } from "@/components/site-footer";
import { reachMetrikaGoal } from "@/lib/metrika";
import { getPrintPrice } from "@/lib/pricing";

type PrintFormat = "A4" | "A3";
type PrintSide = "one-sided" | "two-sided";

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [format, setFormat] = useState<PrintFormat>("A4");
  const [copies, setCopies] = useState(1);
  const [sides, setSides] = useState<PrintSide>("one-sided");
  const [pages, setPages] = useState(1);

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

    const pricing = useMemo(
  () =>
    getPrintPrice({
      paperFormat: format,
      printSides: sides,
      pageCount: pages,
      copies,
    }),
  [format, copies, sides, pages]
);

const price = pricing.totalPrice;

  function selectFile(file?: File) {
    if (!file) return;

    const allowedTypes = [
      "application/pdf",
      "image/jpeg",
      "image/png",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Пока поддерживаются только PDF, JPG и PNG.");
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      alert("Размер файла не должен превышать 25 МБ.");
      return;
    }

    setFileName(file.name);
    setSelectedFile(file);
    setCreatedOrderNumber("");
    setFormError("");
    reachMetrikaGoal("file_selected");
  }

  function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    selectFile(event.target.files?.[0]);
  }

  function handleDrop(event: DragEvent<HTMLLabelElement>) {
    event.preventDefault();
    selectFile(event.dataTransfer.files?.[0]);
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setFormError("");
    setCreatedOrderNumber("");

    if (!selectedFile) {
      setFormError("Сначала выберите файл для печати.");
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

      formData.append("file", selectedFile);
      formData.append("paperFormat", format);
      formData.append("pageCount", String(pages));
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

      const result = await response.json();

      if (!response.ok) {
        const requestNote = result.requestId
          ? ` Номер ошибки: ${result.requestId}`
          : "";

        setFormError(
          `${result.error ?? "Не удалось создать заказ."}${requestNote}`
        );

        return;
      }

      setCreatedOrderNumber(result.orderNumber);
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
            Загрузите файл — мы распечатаем его
          </h1>

          <p className="mt-5 text-lg leading-8 text-slate-600">
            Чёрно-белая печать форматов A4 и A3. Загрузите документ, выберите
            параметры, узнайте предварительную стоимость и оформите заказ.
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
            <h2 className="text-2xl font-bold">1. Загрузите файл</h2>

            <p className="mt-2 text-sm leading-6 text-slate-500">
              Поддерживаются PDF, JPG и PNG. Максимальный размер одного файла —
              25 МБ.
            </p>

            <label
              onDragOver={(event) => event.preventDefault()}
              onDrop={handleDrop}
              className="mt-6 flex min-h-56 cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed border-blue-300 bg-blue-50 p-6 text-center transition hover:border-blue-600 hover:bg-blue-100"
            >
              <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-blue-700 text-3xl text-white">
                ↑
              </div>

              <span className="text-lg font-bold">Перетащите файл сюда</span>

              <span className="mt-2 text-sm text-slate-500">
                или нажмите, чтобы выбрать на компьютере
              </span>

              <input
                type="file"
                accept=".pdf,.jpg,.jpeg,.png"
                onChange={handleFileChange}
                className="hidden"
              />
            </label>

            {fileName && (
              <div className="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase tracking-wide text-emerald-700">
                    Файл выбран
                  </p>
                  <p className="mt-1 truncate font-semibold text-slate-800">
                    {fileName}
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setFileName("");
                    setSelectedFile(null);
                  }}
                  className="shrink-0 rounded-lg px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                >
                  Удалить
                </button>
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
                      setCopies(Math.max(1, Number(event.target.value)))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold">
                    Количество страниц
                  </span>

                  <input
                    type="number"
                    min="1"
                    max="10000"
                    value={pages}
                    onChange={(event) =>
                      setPages(Math.max(1, Number(event.target.value)))
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
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
              <div className="mt-6 overflow-hidden rounded-2xl border border-slate-200">
                <div className="border-b border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="text-sm font-bold text-slate-800">
                    Объёмные скидки на чёрно-белую печать
                  </p>

                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Цена зависит от общего количества страниц во всех копиях.
                    Для A3 цена ×2, для двусторонней печати цена ×2.
                  </p>
                </div>

                <div className="overflow-x-auto">
                  <table className="min-w-full text-left text-xs sm:text-sm">
                    <thead className="bg-white text-slate-500">
                      <tr>
                        <th className="px-4 py-3 font-semibold">Тираж</th>
                        <th className="px-4 py-3 font-semibold">
                          A4 / 1 сторона
                        </th>
                        <th className="px-4 py-3 font-semibold">
                          A3 / 1 сторона
                        </th>
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      <tr>
                        <td className="px-4 py-3">1–10</td>
                        <td className="px-4 py-3">20 ₽</td>
                        <td className="px-4 py-3">40 ₽</td>
                      </tr>

                      <tr>
                        <td className="px-4 py-3">11–25</td>
                        <td className="px-4 py-3">18 ₽</td>
                        <td className="px-4 py-3">36 ₽</td>
                      </tr>

                      <tr>
                        <td className="px-4 py-3">26–75</td>
                        <td className="px-4 py-3">16 ₽</td>
                        <td className="px-4 py-3">32 ₽</td>
                      </tr>

                      <tr>
                        <td className="px-4 py-3">76–200</td>
                        <td className="px-4 py-3">14 ₽</td>
                        <td className="px-4 py-3">28 ₽</td>
                      </tr>

                      <tr>
                        <td className="px-4 py-3">201–500</td>
                        <td className="px-4 py-3">11 ₽</td>
                        <td className="px-4 py-3">22 ₽</td>
                      </tr>

                      <tr>
                        <td className="px-4 py-3">От 501</td>
                        <td className="px-4 py-3 font-bold text-blue-700">
                          8 ₽
                        </td>
                        <td className="px-4 py-3 font-bold text-blue-700">
                          16 ₽
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
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
                <span className="text-slate-400">Формат</span>
                <span className="font-semibold">{format}</span>
              </div>

              <div className="flex justify-between gap-4">
                <span className="text-slate-400">Страниц</span>
                <span className="font-semibold">{pages}</span>
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
                <span className="font-semibold">{pricing.quantity} стр.</span>
              </div>

              <div className="mt-3 flex justify-between gap-4 text-sm">
                <span className="text-slate-300">Ступень цены</span>
                <span className="text-right font-semibold">{pricing.tier.label}</span>
              </div>

              <div className="mt-3 flex justify-between gap-4 text-sm">
                <span className="text-slate-300">Цена за страницу</span>
                <span className="font-semibold">{pricing.effectiveUnitPrice} ₽</span>
              </div>
            </div>

            <div className="mt-6 flex items-end justify-between gap-4">
              <span className="text-slate-300">
                Предварительная стоимость
              </span>
              <span className="text-3xl font-black">{price} ₽</span>
            </div>

            <p className="mt-3 text-xs leading-5 text-slate-400">
              Скидка применяется ко всему тиражу при достижении соответствующего
              количества страниц.
            </p>

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
              disabled={isSubmitting}
              className="mt-7 w-full rounded-xl bg-blue-600 px-5 py-4 font-bold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? "Создаём заказ..." : "Оформить заказ"}
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