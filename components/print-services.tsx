import Link from "next/link";

type ServiceCardData = {
  title: string;
  description: string;
  price: string;
  href: string;
  tone: "slate" | "blue" | "amber" | "violet" | "emerald" | "sky";
  image: string;
};

const cardTones: Record<ServiceCardData["tone"], string> = {
  slate: "bg-slate-50 text-slate-500",
  blue: "bg-blue-50 text-blue-600",
  amber: "bg-amber-50 text-amber-600",
  violet: "bg-violet-50 text-violet-600",
  emerald: "bg-emerald-50 text-emerald-600",
  sky: "bg-sky-50 text-sky-600",
};

const SERVICES: ServiceCardData[] = [
  {
    title: "Чёрно-белая печать",
    description: "Рефераты, договоры, справки",
    price: "от 8 ₽",
    href: "/#upload",
    tone: "slate",
    image: "/images/services/black-white.webp",
  },
  {
    title: "Цветная печать",
    description: "Презентации, схемы, брошюры",
    price: "от 20 ₽",
    href: "/color-printing",
    tone: "blue",
    image: "/images/services/color.webp",
  },
  {
    title: "Фотопечать",
    description: "От 10×15 до A3, матовая и глянцевая",
    price: "от 15 ₽",
    href: "/photo-printing",
    tone: "amber",
    image: "/images/services/photo.webp",
  },
  {
    title: "Плакаты и чертежи",
    description: "Цветная и ч/б печать до A0",
    price: "от 150 ₽",
    href: "/color-printing",
    tone: "violet",
    image: "/images/services/posters.webp",
  },
  {
    title: "Ламинация",
    description: "Матовая и глянцевая, несколько плотностей",
    price: "от 80 ₽",
    href: "/lamination",
    tone: "emerald",
    image: "/images/services/lamination.webp",
  },
  {
    title: "Переплёт на пружину",
    description: "Металлическая пружина и прозрачная обложка",
    price: "от 150 ₽",
    href: "/metal-binding",
    tone: "sky",
    image: "/images/services/binding.webp",
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
              <div className={`aspect-[7/5] w-full overflow-hidden ${cardTones[service.tone]}`}>
                {/* The title below identifies the service; the image is decorative. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={service.image}
                  alt=""
                  width={840}
                  height={600}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              </div>

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
