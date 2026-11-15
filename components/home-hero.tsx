export function HomeHero() {
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto grid max-w-[1200px] items-center gap-6 px-5 py-8 lg:grid-cols-[minmax(0,1fr)_minmax(300px,440px)] lg:gap-12 lg:py-10">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-semibold text-slate-600 ring-1 ring-slate-200 lg:hidden">
            Печать онлайн в Воронеже
          </span>

          <h1 className="mt-3 text-[2rem] font-black leading-[1.1] tracking-tight text-slate-950 sm:text-5xl lg:mt-0 lg:text-[3.4rem]">
            Печать документов, фото и плакатов в Воронеже онлайн
          </h1>

          <p className="mt-4 max-w-xl text-base leading-7 text-slate-600 sm:text-lg sm:leading-8">
            Загрузите файл, выберите параметры и сразу увидите цену. Заберите заказ сегодня или оформите доставку.
          </p>

          <ul className="mt-5 flex flex-wrap gap-2">
            {[
              { icon: "⚡", text: "Без регистрации" },
              { icon: "₽", text: "Цена до оплаты" },
              { icon: "🔒", text: "Файлы защищены" },
            ].map((item) => (
              <li
                key={item.text}
                className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-600 ring-1 ring-slate-200"
              >
                <span aria-hidden="true" className="text-blue-600">{item.icon}</span>
                {item.text}
              </li>
            ))}
          </ul>
        </div>
        <div className="hidden justify-end lg:flex">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/images/hero-printing-documents.webp?v=2"
            alt="Распечатанные документы с пружинным переплётом"
            className="h-auto w-full max-w-[360px] object-contain drop-shadow-xl lg:max-w-[440px]"
            width={520}
            height={380}
          />
        </div>
      </div>
    </section>
  );
}
