import type { Metadata } from "next";
import Link from "next/link";
import {
  ServiceBreadcrumbs,
  ServiceStatusNotice,
} from "@/components/service-page";

export const metadata: Metadata = {
  title: "Цветная печать A4, A3, A2, A1, A0 в Воронеже",
  description:
    "Цветная и чёрно-белая печать документов в Воронеже: форматы A4, A3, A2, A1 и A0, разные виды бумаги, стандартное и экспресс-изготовление.",
  alternates: {
    canonical: "/color-printing",
  },
  openGraph: {
    title: "Цветная печать A4, A3, A2, A1, A0 в Воронеже",
    description:
      "Цветная и чёрно-белая печать документов и материалов разных форматов в типографии Copyleft.",
    url: "/color-printing",
  },
};

const siteUrl = "https://xn--80aaas0a1afjm2c.xn--e1afffngyp.xn--p1ai";

export default function ColorPrintingPage() {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Цветная печать",
    description:
      "Цветная и чёрно-белая печать документов и материалов форматов A4, A3, A2, A1 и A0 в Воронеже.",
    url: `${siteUrl}/color-printing`,
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
        <ServiceBreadcrumbs currentPage="Цветная печать" />

        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Услуги типографии Copyleft
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            Цветная печать в Воронеже
          </h1>

          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Выполняем цветную и чёрно-белую печать документов, презентаций,
            учебных материалов, плакатов и другой полиграфической продукции.
            Доступны форматы от A4 до A0, разные плотности бумаги и стандартный
            или экспресс-срок изготовления.
          </p>
        </div>

        <div className="mt-8">
          <ServiceStatusNotice />
        </div>

        <section className="mt-12" aria-labelledby="formats-heading">
          <h2
            id="formats-heading"
            className="text-2xl font-bold text-zinc-950"
          >
            Форматы и варианты печати
          </h2>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-100 text-zinc-900">
                <tr>
                  <th className="px-5 py-4 font-semibold">Формат</th>
                  <th className="px-5 py-4 font-semibold">Цветность</th>
                  <th className="px-5 py-4 font-semibold">
                    Стороны печати
                  </th>
                  <th className="px-5 py-4 font-semibold">Бумага</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A4
                  </td>
                  <td className="px-5 py-4">Чёрно-белая или цветная</td>
                  <td className="px-5 py-4">
                    Односторонняя или двусторонняя
                  </td>
                  <td className="px-5 py-4">
                    Офсетная 80, 120, 200, 300 г/м²; мелованная 120 или
                    300 г/м²
                  </td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A3
                  </td>
                  <td className="px-5 py-4">Чёрно-белая или цветная</td>
                  <td className="px-5 py-4">
                    Односторонняя или двусторонняя
                  </td>
                  <td className="px-5 py-4">
                    Офсетная 80, 120, 200, 300 г/м²; мелованная 120 или
                    300 г/м²
                  </td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A2
                  </td>
                  <td className="px-5 py-4">Чёрно-белая или цветная</td>
                  <td className="px-5 py-4">Только односторонняя</td>
                  <td className="px-5 py-4">
                    Офсетная без покрытия: 120 или 160 г/м²
                  </td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A1
                  </td>
                  <td className="px-5 py-4">Чёрно-белая или цветная</td>
                  <td className="px-5 py-4">Только односторонняя</td>
                  <td className="px-5 py-4">
                    Офсетная без покрытия: 120 или 160 г/м²
                  </td>
                </tr>
                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A0
                  </td>
                  <td className="px-5 py-4">Чёрно-белая или цветная</td>
                  <td className="px-5 py-4">Только односторонняя</td>
                  <td className="px-5 py-4">
                    Офсетная без покрытия: 120 или 160 г/м²
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="price-heading">
          <div className="max-w-3xl">
            <h2
              id="price-heading"
              className="text-2xl font-bold text-zinc-950"
            >
              Базовые цены на печать
            </h2>

            <p className="mt-3 leading-7 text-zinc-600">
              Цены в таблицах указаны для заказа от 1 до 5 страниц или листов.
              При увеличении тиража стоимость одной страницы уменьшается.
              Минимального заказа нет — можно заказать от одного экземпляра.
            </p>
          </div>

          <div className="mt-6 grid gap-6 lg:grid-cols-2">
            <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="bg-zinc-950 px-5 py-4 text-white">
                <h3 className="text-xl font-bold">Формат A4</h3>
                <p className="mt-1 text-sm text-zinc-300">
                  Базовая цена за один лист
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-zinc-900">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Вид печати</th>
                      <th className="px-5 py-4 font-semibold">
                        Одна сторона
                      </th>
                      <th className="px-5 py-4 font-semibold">
                        Две стороны
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-700">
                    <tr>
                      <td className="px-5 py-4 font-semibold text-zinc-950">
                        Чёрно-белая
                      </td>
                      <td className="px-5 py-4">20 ₽</td>
                      <td className="px-5 py-4">40 ₽</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-4 font-semibold text-zinc-950">
                        Цветная
                      </td>
                      <td className="px-5 py-4">100 ₽</td>
                      <td className="px-5 py-4">200 ₽</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>

            <article className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
              <div className="bg-zinc-950 px-5 py-4 text-white">
                <h3 className="text-xl font-bold">Формат A3</h3>
                <p className="mt-1 text-sm text-zinc-300">
                  Цена формата A3 — ×2 от A4
                </p>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-zinc-100 text-zinc-900">
                    <tr>
                      <th className="px-5 py-4 font-semibold">Вид печати</th>
                      <th className="px-5 py-4 font-semibold">
                        Одна сторона
                      </th>
                      <th className="px-5 py-4 font-semibold">
                        Две стороны
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-200 text-zinc-700">
                    <tr>
                      <td className="px-5 py-4 font-semibold text-zinc-950">
                        Чёрно-белая
                      </td>
                      <td className="px-5 py-4">40 ₽</td>
                      <td className="px-5 py-4">80 ₽</td>
                    </tr>
                    <tr>
                      <td className="px-5 py-4 font-semibold text-zinc-950">
                        Цветная
                      </td>
                      <td className="px-5 py-4">200 ₽</td>
                      <td className="px-5 py-4">400 ₽</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </article>
          </div>

          <article className="mt-6 overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            <div className="bg-blue-700 px-5 py-4 text-white">
              <h3 className="text-xl font-bold">Большие форматы A2, A1 и A0</h3>
              <p className="mt-1 text-sm text-blue-100">
                Стоимость рассчитывается по площади листа и не зависит от
                цветности
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-zinc-100 text-zinc-900">
                  <tr>
                    <th className="px-5 py-4 font-semibold">Формат</th>
                    <th className="px-5 py-4 font-semibold">Площадь</th>
                    <th className="px-5 py-4 font-semibold">
                      Бумага 120 г/м²
                    </th>
                    <th className="px-5 py-4 font-semibold">
                      Бумага 160 г/м²
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 text-zinc-700">
                  <tr>
                    <td className="px-5 py-4 font-semibold text-zinc-950">
                      A2
                    </td>
                    <td className="px-5 py-4">0,25 м²</td>
                    <td className="px-5 py-4">150 ₽</td>
                    <td className="px-5 py-4">175 ₽</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 font-semibold text-zinc-950">
                      A1
                    </td>
                    <td className="px-5 py-4">0,5 м²</td>
                    <td className="px-5 py-4">300 ₽</td>
                    <td className="px-5 py-4">350 ₽</td>
                  </tr>
                  <tr>
                    <td className="px-5 py-4 font-semibold text-zinc-950">
                      A0
                    </td>
                    <td className="px-5 py-4">1 м²</td>
                    <td className="px-5 py-4">600 ₽</td>
                    <td className="px-5 py-4">700 ₽</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </article>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-zinc-950">
              Сроки изготовления
            </h2>

            <ul className="mt-5 space-y-4 text-zinc-700">
              <li className="rounded-xl bg-zinc-100 p-4">
                <span className="font-semibold text-zinc-950">
                  Стандартный срок:
                </span>{" "}
                1 рабочий день.
              </li>
              <li className="rounded-xl bg-amber-50 p-4 text-amber-950">
                <span className="font-semibold">
                  Экспресс-изготовление:
                </span>{" "}
                от 15 минут до 1 часа.
                <br />
                <span className="text-sm text-amber-900">
                  Доплата — 10% к стоимости заказа, но не менее 100 ₽.
                </span>
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-zinc-950">
              Как подготовить файл
            </h2>

            <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-zinc-700">
              <li>
                Для документов предпочтителен PDF: так лучше сохраняются
                шрифты, поля и расположение элементов.
              </li>
              <li>
                Проверьте размер страниц и ориентацию перед отправкой файла.
              </li>
              <li>
                Для печати изображений используйте оригинал хорошего качества,
                без сильного сжатия.
              </li>
              <li>
                Если важен точный оттенок, заранее сообщите об этом при
                оформлении заказа.
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
                Можно ли заказать один лист?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Да. Минимального количества нет: принимаем заказы от одного
                экземпляра.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Почему цена за страницу снижается при большом тираже?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                При увеличении количества страниц или экземпляров снижаются
                постоянные затраты на подготовку и обработку заказа. Точная
                цена зависит от параметров тиража.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Можно ли печатать A2, A1 или A0 с двух сторон?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Для больших форматов A2, A1 и A0 доступна только
                односторонняя печать.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Когда доступен экспресс-заказ?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Экспресс-изготовление доступно при технической возможности.
                Срок составляет от 15 минут до 1 часа, а доплата — 10% от
                стоимости заказа, но не менее 100 ₽.
              </p>
            </details>
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-zinc-950 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold">
            Нужна чёрно-белая печать документов A4 или A3?
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-zinc-300">
            Онлайн-заказ базовой печати уже доступен: загрузите файл, выберите
            параметры и отправьте заявку в типографию.
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