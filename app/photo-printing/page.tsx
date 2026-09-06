import type { Metadata } from "next";
import Link from "next/link";
import {
  ServiceBreadcrumbs,
  ServiceStatusNotice,
} from "@/components/service-page";

export const metadata: Metadata = {
  title: "Фотопечать в Воронеже — фото 10×15, A4, A3, A2, A1, A0",
  description:
    "Печать фотографий в Воронеже: форматы 10×15, A4, A3, A2, A1 и A0, матовая и глянцевая фотобумага, стандартное и экспресс-изготовление.",
  alternates: {
    canonical: "/photo-printing",
  },
  openGraph: {
    title: "Фотопечать в Воронеже",
    description:
      "Печать фотографий 10×15, A4, A3 и больших форматов A2–A0 в типографии Copyleft.",
    url: "/photo-printing",
  },
};

const siteUrl = "https://xn--80aaas0a1afjm2c.xn--e1afffngyp.xn--p1ai";

export default function PhotoPrintingPage() {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Фотопечать",
    description:
      "Печать фотографий форматов 10×15, A4, A3, A2, A1 и A0 в Воронеже.",
    url: `${siteUrl}/photo-printing`,
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
        <ServiceBreadcrumbs currentPage="Фотопечать" />

        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Услуги типографии Copyleft
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            Фотопечать в Воронеже
          </h1>

          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Печатаем фотографии для семейных альбомов, интерьера, подарков,
            выставок, презентаций и личных проектов. Доступны популярные
            форматы от 10 × 15 см до A0, а также матовая и глянцевая
            фотобумага.
          </p>
        </div>

        <div className="mt-8">
          <ServiceStatusNotice />
        </div>

        <section className="mt-12" aria-labelledby="formats-heading">
          <div className="max-w-3xl">
            <h2
              id="formats-heading"
              className="text-2xl font-bold text-zinc-950"
            >
              Форматы, покрытие и цены
            </h2>

            <p className="mt-3 leading-7 text-zinc-600">
              Указаны базовые цены за одну фотографию или лист. Для больших
              форматов A2–A0 стоимость рассчитывается по площади материала.
            </p>
          </div>

          <div className="mt-6 overflow-x-auto rounded-2xl border border-zinc-200 bg-white">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-zinc-100 text-zinc-900">
                <tr>
                  <th className="px-5 py-4 font-semibold">Формат</th>
                  <th className="px-5 py-4 font-semibold">Покрытие</th>
                  <th className="px-5 py-4 font-semibold">Базовая цена</th>
                  <th className="px-5 py-4 font-semibold">Примечание</th>
                </tr>
              </thead>

              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    10 × 15 см
                  </td>
                  <td className="px-5 py-4">Матовая или глянцевая</td>
                  <td className="px-5 py-4">от 25 ₽ / шт.</td>
                  <td className="px-5 py-4">Популярный формат для фото</td>
                </tr>

                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A4
                  </td>
                  <td className="px-5 py-4">Матовая или глянцевая</td>
                  <td className="px-5 py-4">от 100 ₽ / шт.</td>
                  <td className="px-5 py-4">Для портретов и коллажей</td>
                </tr>

                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A3
                  </td>
                  <td className="px-5 py-4">Матовая или глянцевая</td>
                  <td className="px-5 py-4">от 200 ₽ / шт.</td>
                  <td className="px-5 py-4">Для постеров и интерьерных фото</td>
                </tr>

                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A2
                  </td>
                  <td className="px-5 py-4">Только матовая</td>
                  <td className="px-5 py-4">от 300 ₽ / шт.</td>
                  <td className="px-5 py-4">Расчёт по площади материала</td>
                </tr>

                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A1
                  </td>
                  <td className="px-5 py-4">Только матовая</td>
                  <td className="px-5 py-4">от 600 ₽ / шт.</td>
                  <td className="px-5 py-4">Расчёт по площади материала</td>
                </tr>

                <tr>
                  <td className="px-5 py-4 font-semibold text-zinc-950">
                    A0
                  </td>
                  <td className="px-5 py-4">Только матовая</td>
                  <td className="px-5 py-4">от 1 200 ₽ / шт.</td>
                  <td className="px-5 py-4">Расчёт по площади материала</td>
                </tr>
              </tbody>
            </table>
          </div>

          <p className="mt-4 text-sm leading-6 text-zinc-500">
            Для форматов A2, A1 и A0 ориентировочная цена составляет от 1 200 ₽
            за м². Итоговая стоимость зависит от фактического размера,
            выбранного материала и параметров заказа.
          </p>
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
              Как подготовить фотографии
            </h2>

            <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-zinc-700">
              <li>
                Используйте оригинальные изображения без пересылки через
                мессенджеры: они часто уменьшают размер и качество файла.
              </li>
              <li>
                Для крупного формата особенно важны достаточные разрешение и
                детализация исходного изображения.
              </li>
              <li>
                Проверьте, не обрезаны ли важные элементы по краям кадра.
              </li>
              <li>
                Если точная цветопередача критична, сообщите об этом при
                оформлении заказа.
              </li>
            </ul>
          </article>
        </section>

        <section className="mt-12" aria-labelledby="file-formats-heading">
          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-6">
            <h2
              id="file-formats-heading"
              className="text-2xl font-bold text-blue-950"
            >
              Форматы файлов
            </h2>

            <p className="mt-3 max-w-3xl leading-7 text-blue-950">
              Для фотопечати подойдут распространённые форматы изображений.
              Онлайн-загрузчик сейчас принимает PDF, JPG и PNG. Поддержку
              дополнительных форматов изображений мы добавим вместе с новым
              конфигуратором печати.
            </p>
          </div>
        </section>

        <section className="mt-12" aria-labelledby="faq-heading">
          <h2 id="faq-heading" className="text-2xl font-bold text-zinc-950">
            Частые вопросы
          </h2>

          <div className="mt-6 space-y-4">
            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Чем отличается матовая фотобумага от глянцевой?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Глянцевая бумага делает цвета более насыщенными и даёт
                выраженный блеск. Матовая поверхность меньше бликует и лучше
                подходит для фотографий, которые будут часто брать в руки.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Можно ли напечатать одну фотографию?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Да, можно заказать печать от одного экземпляра.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Почему для больших форматов доступна только матовая бумага?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Для A2, A1 и A0 используется матовый материал, который
                подходит для крупноформатной печати и уменьшает блики при
                просмотре изображения.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Можно ли сделать заказ срочно?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Да, при технической возможности доступно экспресс-изготовление
                от 15 минут до 1 часа. Доплата составляет 10% от стоимости
                заказа, но не менее 100 ₽.
              </p>
            </details>
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-zinc-950 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold">
            Нужна печать документов уже сейчас?
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-zinc-300">
            Для чёрно-белой печати документов A4 и A3 уже работает
            онлайн-заказ: загрузите PDF, JPG или PNG, выберите параметры и
            отправьте заявку.
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