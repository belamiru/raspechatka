import Link from "next/link";

type ServiceCardData = {
  title: string;
  description: string;
  price: string;
  href: string;
  tone: "slate" | "blue" | "amber" | "violet" | "emerald" | "sky";
  icon: React.ReactNode;
};

const cardTones: Record<ServiceCardData["tone"], string> = {
  slate: "bg-slate-50 text-slate-500",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
};

function SheetIcon() {
  return (
    <svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M16 8h20l12 12v36H16z" />
      <path d="M36 8v12h12M22 30h20M22 38h20M22 46h12" />
    </svg>
  );
}

function ColorSheetIcon() {
  return (
    <svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M14 10h24l12 12v32H14z" />
      <path d="M38 10v12h12" />
      <circle cx="26" cy="32" r="6" fill="currentColor" stroke="none" opacity=".75" />
      <path d="M36 26h8M36 34h8M20 46h24" />
    </svg>
  );
}

function PhotoIcon() {
  return (
    <svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="10" y="14" width="34" height="26" rx="2" transform="rotate(-6 10 14)" />
      <rect x="20" y="22" width="34" height="26" rx="2" fill="none" />
      <circle cx="46" cy="30" r="3" />
      <path d="m24 44 8-8 5 5 4-4 5 5" />
    </svg>
  );
}

function PosterIcon() {
  return (
    <svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="12" y="8" width="40" height="48" rx="2" />
      <circle cx="32" cy="28" r="10" fill="currentColor" stroke="none" opacity=".6" />
      <path d="M18 46h28" />
    </svg>
  );
}

function LaminationIcon() {
  return (
    <svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="10" y="20" width="44" height="24" rx="4" />
      <path d="M10 26h44M18 38h28" />
    </svg>
  );
}

function BindingIcon() {
  return (
    <svg viewBox="0 0 64 64" width="72" height="72" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="16" y="10" width="36" height="44" rx="2" />
      <path d="M12 10v44" />
      <path d="M12 16h6M12 24h6M12 32h6M12 40h6M12 48h6" />
    </svg>
  );
}

const SERVICES: ServiceCardData[] = [
  {
    title: "Чёрно-белая печать",
    description: "Рефераты, договоры, справки",
    price: "от 8 ₽",
    href: "/#upload",
    tone: "slate",
    icon: <SheetIcon />,
  },
  {
    title: "Цветная печать",
    description: "Презентации, схемы, брошюры",
    price: "от 20 ₽",
    href: "/color-printing",
    tone: "blue",
    icon: <ColorSheetIcon />,
  },
  {
    title: "Фотопечать",
    description: "От 10×15 до A3, матовая и глянцевая",
    price: "от 15 ₽",
    href: "/photo-printing",
    tone: "amber",
    icon: <PhotoIcon />,
  },
  {
    title: "Плакаты и чертежи",
    description: "Цветная и ч/б печать до A0",
    price: "от 150 ₽",
    href: "/color-printing",
    tone: "violet",
    icon: <PosterIcon />,
  },
  {
    title: "Ламинация",
    description: "Матовая и глянцевая, несколько плотностей",
    price: "от 80 ₽",
    href: "/lamination",
    tone: "emerald",
    icon: <LaminationIcon />,
  },
  {
    title: "Переплёт на пружину",
    description: "Металлическая пружина и прозрачная обложка",
    price: "от 150 ₽",
    href: "/metal-binding",
    tone: "sky",
    icon: <BindingIcon />,
  },
];

export function PrintServices() {
  return (
    <section id="prices" className="scroll-mt-24 bg-white">
      <div className="mx-auto max-w-[1200px] px-5 py-12 sm:py-16">
        <h2 className="text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Печать для любых задач</h2>

        <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SERVICES.map((service) => (
            <article
              key={service.title}
              className="flex flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-lg"
            >
              <div className={`flex h-32 items-center justify-center ${cardTones[service.tone]}`}>{service.icon}</div>

              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-base font-bold text-slate-900">{service.title}</h3>
                <p className="mt-1 text-sm leading-6 text-slate-600">{service.description}</p>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <Link
                    href={service.href}
                    className="text-sm font-semibold text-blue-700 underline underline-offset-4 hover:text-blue-800"
                  >
                    Подробнее
                  </Link>
                  <span className="text-sm font-bold text-slate-900">{service.price}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
