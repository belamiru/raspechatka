"use client";

import { ChangeEvent, DragEvent, FormEvent, useMemo, useState } from "react";

type PrintFormat = "A4" | "A3";
type PrintSide = "one-sided" | "two-sided";

export default function Home() {
  const [fileName, setFileName] = useState("");
  const [format, setFormat] = useState<PrintFormat>("A4");
  const [copies, setCopies] = useState(1);
  const [sides, setSides] = useState<PrintSide>("one-sided");
  const [pages, setPages] = useState(1);

  const [customerName, setCustomerName] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerComment, setCustomerComment] = useState("");

  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState("");
  const [createdOrderNumber, setCreatedOrderNumber] = useState("");

  const price = useMemo(() => {
    const pricePerPage = format === "A4" ? 10 : 20;
    const sideMultiplier = sides === "two-sided" ? 1.5 : 1;

    return Math.round(pricePerPage * pages * copies * sideMultiplier);
  }, [format, copies, sides, pages]);

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

    if (file.size > 100 * 1024 * 1024) {
      alert("Размер файла не должен превышать 100 МБ.");
      return;
    }

    setFileName(file.name);
    setCreatedOrderNumber("");
    setFormError("");
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

    if (!fileName) {
      setFormError("Сначала выберите файл для печати.");
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch("/api/orders", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          fileName,
          paperFormat: format,
          pageCount: pages,
          copies,
          printSides: sides,
          customerName,
          customerPhone,
          customerEmail,
          customerComment,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setFormError(result.error ?? "Не удалось создать заказ.");
        return;
      }

      setCreatedOrderNumber(result.orderNumber);
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
          <a href="/" className="text-xl font-black tracking-tight text-blue-700">
            РАСПЕЧАТКА
          </a>

          <div className="hidden text-sm text-slate-500 sm:block">
            Чёрно-белая печать документов в Воронеже
          </div>

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
            Чёрно-белая печать форматов A4 и A3. Загрузите документ,
            выберите параметры, узнайте стоимость и оформите заказ.
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"
        >
          <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
            <h2 className="text-2xl font-bold">1. Загрузите файл</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Поддерживаются PDF, JPG и PNG. Максимальный размер одного файла —
              100 МБ.
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
                  onClick={() => setFileName("")}
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
                    <option value="A4">A4 — 10 ₽ за страницу</option>
                    <option value="A3">A3 — 20 ₽ за страницу</option>
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
                    <option value="two-sided">Двусторонняя (× 1,5)</option>
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
                    Email <span className="font-normal text-slate-400">(необязательно)</span>
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
                    onChange={(event) => setCustomerComment(event.target.value)}
                    placeholder="Например: позвоните, когда заказ будет готов."
                    className="w-full resize-y rounded-xl border border-slate-300 bg-white px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
                  />
                </label>
              </div>
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

            <div className="mt-6 flex items-end justify-between gap-4">
              <span className="text-slate-300">Предварительная стоимость</span>
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
                <p className="mt-2 text-xl font-black">{createdOrderNumber}</p>
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
              Самовывоз: Воронеж, ул. Шукшина, 21, 2 этаж, офис № 8.
            </p>
          </aside>
        </form>
      </section>
    </main>
  );
}