import type { Metadata } from "next";
import Link from "next/link";
import { SiteFooter } from "@/components/site-footer";

export const metadata: Metadata = {
  title: "Страница не найдена",
  description:
    "Запрошенная страница не найдена. Перейдите к онлайн-заказу печати документов в типографии Copyleft в Воронеже.",
  robots: {
    index: false,
    follow: true,
  },
};

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col bg-slate-50 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <Link
            href="/"
            className="text-xl font-black tracking-tight text-blue-700"
          >
            РАСПЕЧАТКА
          </Link>

          <Link
            href="/#order"
            className="rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800"
          >
            Оформить заказ
          </Link>
        </div>
      </header>

      <section className="mx-auto flex w-full max-w-4xl flex-1 items-center px-5 py-14 sm:py-20">
        <div className="w-full rounded-3xl border border-slate-200 bg-white p-7 text-center shadow-sm sm:p-12">
          <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
            Ошибка 404
          </p>

          <div
            aria-hidden="true"
            className="mx-auto mt-5 flex h-20 w-20 items-center justify-center rounded-3xl bg-blue-700 text-4xl font-black text-white shadow-lg shadow-blue-200"
          >
            ?
          </div>

          <h1 className="mt-7 text-3xl font-black tracking-tight sm:text-4xl">
            Эту страницу не удалось найти
          </h1>

          <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-slate-600">
            Но если вы нашли эту страницу — отправьте ее нам, чтобы мы ее вам распечатали.
          </p>

          <p className="mx-auto mt-3 max-w-xl text-sm leading-6 text-slate-500">
            Перейдите к форме заказа, загрузите PDF, JPG или PNG, выберите
            параметры печати и узнайте предварительную стоимость.
          </p>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Link
              href="/#order"
              className="rounded-xl bg-blue-700 px-6 py-3.5 font-bold text-white transition hover:bg-blue-800"
            >
              Перейти к заказу
            </Link>

            <Link
              href="/services"
              className="rounded-xl border border-slate-300 px-6 py-3.5 font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
            >
              Посмотреть услуги
            </Link>
          </div>

          <p className="mt-8 text-sm text-slate-500">
            Или вернитесь на{" "}
            <Link
              href="/"
              className="font-semibold text-blue-700 underline underline-offset-4 hover:text-blue-800"
            >
              главную страницу
            </Link>
            .
          </p>
        </div>
      </section>

      <SiteFooter />
    </main>
  );
}