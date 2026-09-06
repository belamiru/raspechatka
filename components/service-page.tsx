import Link from "next/link";

type ServiceCardProps = {
  title: string;
  description: string;
  href: string;
  status?: "available" | "coming-soon";
};

export function ServiceStatusNotice() {
  return (
    <section
      className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-amber-950"
      aria-label="Статус онлайн-заказа"
    >
      <p className="text-sm font-semibold uppercase tracking-wide text-amber-800">
        Онлайн-калькулятор готовится
      </p>
      <h2 className="mt-1 text-xl font-bold">
        Услуги уже доступны в типографии Copyleft
      </h2>
      <p className="mt-2 max-w-3xl leading-7 text-amber-900">
        Мы завершаем настройку параметров и расчёта стоимости для онлайн-заказа.
        Пока уточнить детали и оформить заказ на эти услуги можно в типографии,
        по телефону или по электронной почте.
      </p>
    </section>
  );
}

export function ServiceCard({
  title,
  description,
  href,
  status = "coming-soon",
}: ServiceCardProps) {
  const isAvailable = status === "available";

  return (
    <article className="flex h-full flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-bold text-zinc-950">{title}</h2>

        <span
          className={
            isAvailable
              ? "shrink-0 rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800"
              : "shrink-0 rounded-full bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800"
          }
        >
          {isAvailable ? "Доступно онлайн" : "Скоро доступно онлайн"}
        </span>
      </div>

      <p className="mt-3 flex-1 leading-7 text-zinc-600">{description}</p>

      <Link
        href={href}
        className="mt-6 inline-flex w-fit items-center font-semibold text-zinc-950 underline decoration-zinc-400 underline-offset-4 transition-colors hover:text-blue-700 hover:decoration-blue-700"
      >
        Подробнее об услуге
        <span aria-hidden="true" className="ml-2">
          →
        </span>
      </Link>
    </article>
  );
}

export function ServiceBreadcrumbs({
  currentPage,
}: {
  currentPage: string;
}) {
  return (
    <nav
      aria-label="Хлебные крошки"
      className="mb-6 text-sm text-zinc-500"
    >
      <Link
        href="/"
        className="transition-colors hover:text-zinc-950 hover:underline"
      >
        Главная
      </Link>

      <span className="mx-2" aria-hidden="true">
        /
      </span>

      <Link
        href="/services"
        className="transition-colors hover:text-zinc-950 hover:underline"
      >
        Услуги
      </Link>

      <span className="mx-2" aria-hidden="true">
        /
      </span>

      <span className="text-zinc-700">{currentPage}</span>
    </nav>
  );
}