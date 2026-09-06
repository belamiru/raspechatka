import type { Metadata } from "next";
import Link from "next/link";
import {
  ServiceBreadcrumbs,
  ServiceStatusNotice,
} from "@/components/service-page";

export const metadata: Metadata = {
  title: "Переплёт на металлическую пружину в Воронеже",
  description:
    "Переплёт документов на металлическую пружину и брошюровка внакидку на скобу в Воронеже. Форматы A5, A4 и A3, прозрачные обложки, до 120 листов.",
  alternates: {
    canonical: "/metal-binding",
  },
  openGraph: {
    title: "Переплёт документов в Воронеже",
    description:
      "Переплёт на металлическую пружину и брошюровка внакидку на скобу в типографии Copyleft.",
    url: "/metal-binding",
  },
};

const siteUrl = "https://xn--80aaas0a1afjm2c.xn--e1afffngyp.xn--p1ai";

export default function MetalBindingPage() {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Переплёт документов",
    description:
      "Переплёт документов на металлическую пружину и брошюровка внакидку на скобу в Воронеже.",
    url: `${siteUrl}/metal-binding`,
    areaServed: {
      "@type": "City",
      name: "Воронеж",
    },
    provider: {
      "@type": "LocalBusiness",
      name: "Типография Copyleft",
      url: siteUrl,
      address: {
        "@type": "PostalAddress",
        addressLocality: "Воронеж",
        streetAddress: "ул. Шукшина, д. 21, офис 8",
        addressCountry: "RU",
      },
    },
  };

  return (
    <main className="flex-1 bg-zinc-50">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(serviceSchema),
        }}
      />

      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <ServiceBreadcrumbs currentPage="Переплёт документов" />

        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Услуги типографии Copyleft
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            Переплёт документов в Воронеже
          </h1>

          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Выполняем переплёт на металлическую пружину и брошюровку внакидку
            на скобу. Услуги подходят для учебных работ, презентаций,
            методичек, инструкций, буклетов, каталогов и других документов.
          </p>
        </div>

        <div className="mt-8">
          <ServiceStatusNotice />
        </div>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="bg-zinc-950 p-6 text-white">
              <p className="text-sm font-semibold uppercase tracking-wide text-zinc-300">
                Вариант 1
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Металлическая пружина
              </h2>
              <p className="mt-3 leading-7 text-zinc-300">
                Практичный переплёт для объёмных документов, презентаций,
                методичек и материалов, которые должны удобно раскрываться.
              </p>
            </div>

            <div className="p-6">
              <p className="text-4xl font-bold tracking-tight text-zinc-950">
                150 ₽
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                за одно готовое изделие
              </p>

              <ul className="mt-6 space-y-3 leading-7 text-zinc-700">
                <li>
                  <span className="font-semibold text-zinc-950">A4:</span>{" "}
                  переплёт по узкой или широкой стороне.
                </li>
                <li>
                  <span className="font-semibold text-zinc-950">A3:</span>{" "}
                  переплёт по широкой стороне.
                </li>
                <li>
                  <span className="font-semibold text-zinc-950">
                    Максимальный объём:
                  </span>{" "}
                  до 120 листов A4 на бумаге плотностью 80 г/м².
                </li>
                <li>
                  <span className="font-semibold text-zinc-950">Обложка:</span>{" "}
                  доступна прозрачная обложка.
                </li>
              </ul>
            </div>
          </article>

          <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm">
            <div className="bg-blue-700 p-6 text-white">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-100">
                Вариант 2
              </p>
              <h2 className="mt-2 text-2xl font-bold">
                Брошюровка внакидку на скобу
              </h2>
              <p className="mt-3 leading-7 text-blue-100">
                Листы складываются пополам и скрепляются скобами по линии
                сгиба. Подходит для брошюр, небольших каталогов и буклетов.
              </p>
            </div>

            <div className="p-6">
              <p className="text-4xl font-bold tracking-tight text-zinc-950">
                150 ₽
              </p>
              <p className="mt-2 text-sm text-zinc-500">
                за одно готовое изделие
              </p>

              <ul className="mt-6 space-y-3 leading-7 text-zinc-700">
                <li>
                  <span className="font-semibold text-zinc-950">
                    Готовый формат:
                  </span>{" "}
                  от A5 до A4.
                </li>
                <li>
                  <span className="font-semibold text-zinc-950">A5:</span>{" "}
                  печать на A4 с последующим сложением пополам.
                </li>
                <li>
                  <span className="font-semibold text-zinc-950">A4:</span>{" "}
                  печать на A3 с последующим сложением пополам.
                </li>
                <li>
                  <span className="font-semibold text-zinc-950">
                    Максимальный объём:
                  </span>{" "}
                  до 15 листов бумаги плотностью 80 г/м².
                </li>
                <li>
                  <span className="font-semibold text-zinc-950">
                    Объём изделия:
                  </span>{" "}
                  до 60 страниц вместе с обложкой.
                </li>
              </ul>
            </div>
          </article>
        </section>

        <section className="mt-12" aria-labelledby="price-heading">
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
            <h2
              id="price-heading"
              className="text-2xl font-bold text-amber-950"
            >
              Что входит в стоимость переплёта
            </h2>

            <p className="mt-3 max-w-3xl leading-7 text-amber-950">
              Цена 150 ₽ указана только за услугу переплёта или брошюровки
              одного изделия. Печать, бумага, обложки и другие дополнительные
              материалы рассчитываются отдельно.
            </p>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-zinc-950">
              Как выбрать подходящий вариант
            </h2>

            <div className="mt-5 space-y-4 text-zinc-700">
              <div className="rounded-xl bg-zinc-100 p-4">
                <h3 className="font-semibold text-zinc-950">
                  Выберите металлическую пружину
                </h3>
                <p className="mt-2 leading-7">
                  Если документ объёмный, должен часто раскрываться или
                  использоваться как рабочая методичка, инструкция, отчёт или
                  презентация.
                </p>
              </div>

              <div className="rounded-xl bg-zinc-100 p-4">
                <h3 className="font-semibold text-zinc-950">
                  Выберите брошюровку внакидку
                </h3>
                <p className="mt-2 leading-7">
                  Если нужен компактный буклет, небольшая брошюра, каталог или
                  программа мероприятия с разворотами.
                </p>
              </div>
            </div>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-zinc-950">
              Рекомендации по подготовке макета
            </h2>

            <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-zinc-700">
              <li>
                Для переплёта на пружину оставляйте свободное поле со стороны
                переплёта, чтобы отверстия не затронули важный текст.
              </li>
              <li>
                Для брошюровки внакидку число страниц должно быть кратно
                четырём: страницы располагаются на разворотах.
              </li>
              <li>
                Проверьте порядок страниц, поля, ориентацию и наличие обложки
                до отправки файла.
              </li>
              <li>
                Для документов лучше использовать PDF: это помогает сохранить
                верстку, шрифты и расположение элементов.
              </li>
            </ul>
          </article>
        </section>

        <section className="mt-12" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-bold text-zinc-950">
            Частые вопросы
          </h2>

          <div className="mt-6 space-y-4">
            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Можно ли сделать переплёт для документа, который уже напечатан?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Да. Можно принести уже распечатанные листы или заказать печать
                и переплёт в типографии. Стоимость печати и материалов
                рассчитывается отдельно.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Что лучше для курсовой, отчёта или методички?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Для объёмных документов обычно подходит металлическая пружина:
                она позволяет удобно раскрывать страницы. Конкретный вариант
                зависит от числа листов, формата и требований к оформлению.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Можно ли добавить прозрачную обложку?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Да, для переплёта на металлическую пружину доступна прозрачная
                обложка. Её стоимость уточняется отдельно вместе с параметрами
                заказа.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Почему для брошюровки нужно число страниц, кратное четырём?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                При брошюровке внакидку каждый лист печатается с двух сторон и
                после сгибания образует четыре страницы готовой брошюры.
              </p>
            </details>
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-zinc-950 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold">
            Нужна печать документов перед переплётом?
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-zinc-300">
            Онлайн-заказ чёрно-белой печати A4 и A3 уже работает. Загрузите
            файл и отправьте заявку, а дополнительные услуги можно согласовать
            с типографией.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/"
              className="inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
            >
              Перейти к онлайн-заказу
            </Link>

            <Link
              href="/services"
              className="inline-flex rounded-xl border border-zinc-600 px-5 py-3 font-semibold text-white transition-colors hover:border-white hover:bg-zinc-800"
            >
              Все услуги
            </Link>
          </div>
        </section>
      </section>
    </main>
  );
}