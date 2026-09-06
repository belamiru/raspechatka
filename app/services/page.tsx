import type { Metadata } from "next";
import Link from "next/link";
import {
  ServiceCard,
  ServiceStatusNotice,
} from "@/components/service-page";

export const metadata: Metadata = {
  title: "Услуги печати в Воронеже",
  description:
    "Печать документов, цветная печать, фотопечать, ламинация и переплёт в Воронеже. Узнайте доступные форматы, материалы, сроки и стоимость услуг типографии Copyleft.",
  alternates: {
    canonical: "/services",
  },
  openGraph: {
    title: "Услуги печати в Воронеже",
    description:
      "Печать документов, цветная печать, фотопечать, ламинация и переплёт в типографии Copyleft.",
    url: "/services",
  },
};

const services = [
  {
    title: "Печать документов",
    description:
      "Чёрно-белая печать документов A4 и A3. Загрузите PDF, JPG или PNG, выберите параметры и оформите заказ онлайн.",
    href: "/",
    status: "available" as const,
  },
  {
    title: "Цветная печать",
    description:
      "Цветная и чёрно-белая печать форматов от A4 до A0. Доступны разные виды и плотности бумаги, обычный и экспресс-срок.",
    href: "/color-printing",
  },
  {
    title: "Фотопечать",
    description:
      "Печать фотографий 10 × 15, A4, A3 и больших форматов A2–A0 на матовой или глянцевой фотобумаге.",
    href: "/photo-printing",
  },
  {
    title: "Ламинация",
    description:
      "Двусторонняя пакетная ламинация документов форматов A4 и A3: матовая или глянцевая плёнка 80–125 мкм.",
    href: "/lamination",
  },
  {
    title: "Переплёт документов",
    description:
      "Переплёт на металлическую пружину и брошюровка внакидку на скобу для документов, презентаций, методичек и буклетов.",
    href: "/metal-binding",
  },
];

export default function ServicesPage() {
  return (
    <main className="flex-1 bg-zinc-50">
      <section className="mx-auto w-full max-w-6xl px-4 py-10 sm:px-6 sm:py-14 lg:px-8">
        <nav aria-label="Хлебные крошки" className="mb-6 text-sm text-zinc-500">
          <Link
            href="/"
            className="transition-colors hover:text-zinc-950 hover:underline"
          >
            Главная
          </Link>
          <span className="mx-2" aria-hidden="true">
            /
          </span>
          <span className="text-zinc-700">Услуги</span>
        </nav>

        <div className="max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-950 sm:text-4xl">
            Услуги печати в Воронеже
          </h1>

          <p className="mt-4 text-lg leading-8 text-zinc-600">
            Типография Copyleft выполняет печать документов, цветную печать,
            фотопечать, ламинацию и переплёт. На страницах услуг указаны
            доступные форматы, материалы, сроки и базовые цены.
          </p>
        </div>

        <div className="mt-8">
          <ServiceStatusNotice />
        </div>

        <section
          aria-labelledby="services-list-heading"
          className="mt-10"
        >
          <h2
            id="services-list-heading"
            className="text-2xl font-bold text-zinc-950"
          >
            Выберите услугу
          </h2>

          <div className="mt-6 grid gap-5 md:grid-cols-2">
            {services.map((service) => (
              <ServiceCard key={service.href} {...service} />
            ))}
          </div>
        </section>

        <section className="mt-12 rounded-2xl bg-zinc-950 p-6 text-white sm:p-8">
          <h2 className="text-2xl font-bold">
            Уже готовы оформить заказ на печать документов?
          </h2>
          <p className="mt-3 max-w-2xl leading-7 text-zinc-300">
            Онлайн-заказ чёрно-белой печати документов уже доступен. Загрузите
            файл, выберите параметры печати и отправьте заказ в типографию.
          </p>

          <Link
            href="/"
            className="mt-6 inline-flex rounded-xl bg-white px-5 py-3 font-semibold text-zinc-950 transition-colors hover:bg-zinc-200"
          >
            Перейти к онлайн-заказу
          </Link>
        </section>
      </section>
    </main>
  );
}