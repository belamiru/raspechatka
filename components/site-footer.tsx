import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link
            href="/"
            className="text-lg font-black tracking-tight text-blue-700"
          >
            РАСПЕЧАТКА
          </Link>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Печать документов, фотопечать, ламинация и переплёт в Воронеже.
          </p>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-900">Услуги</p>

          <nav className="mt-3 space-y-2 text-sm">
            <Link
              href="/services"
              className="block text-slate-600 hover:text-blue-700"
            >
              Все услуги
            </Link>

            <Link
              href="/color-printing"
              className="block text-slate-600 hover:text-blue-700"
            >
              Цветная печать
            </Link>

            <Link
              href="/photo-printing"
              className="block text-slate-600 hover:text-blue-700"
            >
              Фотопечать
            </Link>

            <Link
              href="/lamination"
              className="block text-slate-600 hover:text-blue-700"
            >
              Ламинация
            </Link>

            <Link
              href="/metal-binding"
              className="block text-slate-600 hover:text-blue-700"
            >
              Переплёт документов
            </Link>
          </nav>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-900">Контакты</p>

          <div className="mt-3 space-y-2 text-sm text-slate-600">
            <p>Воронеж, ул. Шукшина, д. 21, офис 8</p>

            <a
              href="tel:+74732066177"
              className="block hover:text-blue-700"
            >
              8 (473) 206-61-77
            </a>

            <a
              href="mailto:zakaz@listovok.ru"
              className="block hover:text-blue-700"
            >
              zakaz@listovok.ru
            </a>

            <p>Пн–Пт: 10:00–18:30</p>
          </div>
        </div>

        <div>
          <p className="text-sm font-bold text-slate-900">Документы</p>

          <nav className="mt-3 space-y-2 text-sm">
            <Link
              href="/privacy"
              className="block text-slate-600 hover:text-blue-700"
            >
              Политика обработки персональных данных
            </Link>

            <Link
              href="/personal-data-consent"
              className="block text-slate-600 hover:text-blue-700"
            >
              Согласие на обработку персональных данных
            </Link>

            <Link
              href="/offer"
              className="block text-slate-600 hover:text-blue-700"
            >
              Публичная оферта
            </Link>

            <Link
              href="/file-rules"
              className="block text-slate-600 hover:text-blue-700"
            >
              Правила загрузки и хранения файлов
            </Link>
          </nav>
        </div>
      </div>

      <div className="border-t border-slate-100">
        <div className="mx-auto flex max-w-6xl flex-col gap-2 px-5 py-5 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Типография Copyleft</p>
          <p>ИП Сидоров Евгений Викторович, ИНН 463229832170</p>
        </div>
      </div>
    </footer>
  );
}