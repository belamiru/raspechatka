import type { Metadata } from "next";
import Link from "next/link";
import {
  ServiceBreadcrumbs,
  ServiceStatusNotice,
} from "@/components/service-page";

export const metadata: Metadata = {
  title: "Ламинация документов A4 и A3 в Воронеже",
  description:
    "Двусторонняя пакетная ламинация документов A4 и A3 в Воронеже. Матовая или глянцевая плёнка толщиной 80–125 мкм.",
  alternates: {
    canonical: "/lamination",
  },
  openGraph: {
    title: "Ламинация документов A4 и A3 в Воронеже",
    description:
      "Матовая и глянцевая пакетная ламинация документов A4 и A3 в типографии Copyleft.",
    url: "/lamination",
  },
};

const siteUrl = "https://xn--80aaas0a1afjm2c.xn--e1afffngyp.xn--p1ai";

export default function LaminationPage() {
  const serviceSchema = {
    "@context": "https://schema.org",
    "@type": "Service",
    name: "Ламинация документов",
    description:
      "Двусторонняя пакетная ламинация документов форматов A4 и A3 в Воронеже.",
    url: `${siteUrl}/lamination`,
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
        <ServiceBreadcrumbs currentPage="Ламинация" />

        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
            Услуги типографии Copyleft
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            Ламинация документов в Воронеже
          </h1>

          <p className="mt-5 text-lg leading-8 text-zinc-600">
            Выполняем двустороннюю пакетную ламинацию документов форматов A4 и
            A3. Ламинация помогает защитить важные бумаги от влаги, загрязнений,
            заломов и частого использования.
          </p>
        </div>

        <div className="mt-8">
          <ServiceStatusNotice />
        </div>

        <section className="mt-12" aria-labelledby="prices-heading">
          <div className="max-w-3xl">
            <h2
              id="prices-heading"
              className="text-2xl font-bold text-zinc-950"
            >
              Стоимость ламинации
            </h2>

            <p className="mt-3 leading-7 text-zinc-600">
              Цена указана за один документ. Ламинация выполняется с двух сторон
              в пакетной плёнке.
            </p>
          </div>

          <div className="mt-6 grid gap-6 sm:grid-cols-2">
            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Формат A4
              </p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-zinc-950">
                100 ₽
              </p>
              <p className="mt-3 leading-7 text-zinc-600">
                Подходит для сертификатов, удостоверений, инструкций, меню,
                пропусков и других документов A4.
              </p>
            </article>

            <article className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
              <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">
                Формат A3
              </p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-zinc-950">
                130 ₽
              </p>
              <p className="mt-3 leading-7 text-zinc-600">
                Подходит для плакатов, схем, учебных материалов, объявлений и
                документов увеличенного формата.
              </p>
            </article>
          </div>
        </section>

        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <article className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-zinc-950">
              Варианты ламинации
            </h2>

            <ul className="mt-5 space-y-4 text-zinc-700">
              <li className="rounded-xl bg-zinc-100 p-4">
                <span className="font-semibold text-zinc-950">
                  Тип:
                </span>{" "}
                двусторонняя пакетная ламинация.
              </li>
              <li className="rounded-xl bg-zinc-100 p-4">
                <span className="font-semibold text-zinc-950">
                  Покрытие:
                </span>{" "}
                матовое или глянцевое.
              </li>
              <li className="rounded-xl bg-zinc-100 p-4">
                <span className="font-semibold text-zinc-950">
                  Толщина плёнки:
                </span>{" "}
                от 80 до 125 мкм.
              </li>
            </ul>
          </article>

          <article className="rounded-2xl border border-zinc-200 bg-white p-6">
            <h2 className="text-2xl font-bold text-zinc-950">
              Что можно ламинировать
            </h2>

            <ul className="mt-5 list-disc space-y-3 pl-5 leading-7 text-zinc-700">
              <li>сертификаты, грамоты и дипломы;</li>
              <li>меню, инструкции и информационные листы;</li>
              <li>карточки, объявления и прайс-листы;</li>
              <li>учебные материалы и наглядные пособия;</li>
              <li>документы, которые будут часто использоваться.</li>
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
                Что выбрать: матовую или глянцевую ламинацию?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Глянцевая ламинация делает изображение более ярким и
                контрастным. Матовая меньше бликует и лучше подходит для
                документов, на которых нужно читать мелкий текст.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Ламинация выполняется с одной или с двух сторон?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Используется пакетная ламинация: документ покрывается плёнкой с
                обеих сторон.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Можно ли заламинировать оригиналы документов?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Перед ламинацией оригиналов рекомендуем убедиться, что
                ламинирование допустимо для конкретного документа. После
                ламинации внести изменения в документ будет невозможно.
              </p>
            </details>

            <details className="rounded-2xl border border-zinc-200 bg-white p-5">
              <summary className="cursor-pointer font-semibold text-zinc-950">
                Можно ли заламинировать распечатанный у вас документ?
              </summary>
              <p className="mt-3 leading-7 text-zinc-600">
                Да. Можно заказать печать и ламинацию в рамках одного заказа,
                когда онлайн-калькулятор дополнительных услуг будет запущен.
                Пока параметры и итоговую стоимость можно уточнить в типографии.
              </p>
            </details>
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-zinc-950 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold">
            Нужна печать документов перед ламинацией?
          </h2>

          <p className="mt-3 max-w-2xl leading-7 text-zinc-300">
            Загрузите документ для чёрно-белой печати A4 или A3, выберите
            основные параметры и отправьте онлайн-заказ. Дополнительные услуги
            пока можно согласовать отдельно.
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