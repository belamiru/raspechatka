import type { Metadata } from "next";
import { BenefitsStrip } from "@/components/benefits-strip";
import { HomeOrderHero } from "@/components/home-order-hero";
import { PrintServices } from "@/components/print-services";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";

export const metadata: Metadata = {
  title: "Печать документов, фото и плакатов в Воронеже — онлайн-заказ",
  description:
    "Онлайн-печать документов, фотографий и плакатов в Воронеже. Загрузите файл, выберите параметры и сразу увидите цену. Самовывоз или доставка.",
  alternates: {
    canonical: "/",
  },
};

const STEPS = [
  {
    title: "Загрузите файл",
    text: "PDF, Word или изображение. Проверим количество страниц автоматически.",
  },
  {
    title: "Настройте печать",
    text: "Формат, цвет, стороны и количество копий. Цена пересчитывается сразу.",
  },
  {
    title: "Заберите заказ",
    text: "Самовывоз в Воронеже или доставка в пункт выдачи.",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <HomeOrderHero />
      <BenefitsStrip />
      <PrintServices />

      <section id="how-to-order" className="scroll-mt-24 bg-slate-50">
        <div className="mx-auto max-w-[1200px] px-5 py-12 sm:py-16">
          <h2 className="text-center text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">
            Заказать печать — просто
          </h2>

          <ol className="mt-8 grid gap-6 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li key={step.title} className="flex gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-700 text-sm font-bold text-white">
                  {index + 1}
                </span>
                <div className="min-w-0">
                  <p className="font-bold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-sm leading-6 text-slate-600">{step.text}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="delivery" className="scroll-mt-24 bg-white">
        <div className="mx-auto max-w-[1200px] px-5 pb-12 sm:pb-16">
          <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Доставка</h2>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-bold text-slate-900">Самовывоз в Воронеже</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                ул. Шукшина, д. 21, офис 8. Пн–Пт: 10:00–18:30. Бесплатно.
              </p>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
              <p className="font-bold text-slate-900">Доставка в пункт выдачи</p>
              <p className="mt-1 text-sm leading-6 text-slate-600">
                Выберите пункт выдачи на карте при оформлении заказа. Стоимость и срок рассчитываются автоматически.
              </p>
            </div>
          </div>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}
