const BENEFITS = [
  {
    title: "Готово",
    subtitle: "от 15 минут",
    icon: (
      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v5l3.5 2" />
    ),
  },
  {
    title: "Скидки при",
    subtitle: "большом тираже",
    icon: <path d="M4 18 9 9l4 5 3-4 4 8M3 21h18" />,
  },
  {
    title: "Самовывоз",
    subtitle: "в Воронеже",
    icon: (
      <>
        <path d="M12 21s7-6.2 7-11a7 7 0 1 0-14 0c0 4.8 7 11 7 11Z" />
        <circle cx="12" cy="10" r="2.5" />
      </>
    ),
  },
  {
    title: "Уведомим в Telegram",
    subtitle: "или по SMS",
    icon: <path d="M20 4 3.5 10.5l5 2L20 4Zm0 0-4 16-4.5-6.5" />,
  },
];

/** Серая полоса преимуществ под первым экраном. */
export function BenefitsStrip() {
  return (
    <section className="border-y border-slate-200 bg-slate-100">
      <ul className="mx-auto grid max-w-[1200px] gap-4 px-5 py-5 sm:grid-cols-2 lg:grid-cols-4">
        {BENEFITS.map((item) => (
          <li key={item.title} className="flex items-center gap-3">
            <svg
              viewBox="0 0 24 24"
              width="26"
              height="26"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="shrink-0 text-slate-700"
              aria-hidden="true"
            >
              {item.icon}
            </svg>
            <span className="text-sm leading-5 text-slate-700">
              <span className="block font-semibold text-slate-900">{item.title}</span>
              {item.subtitle}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
