export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-6xl gap-8 px-5 py-10 sm:grid-cols-2 lg:grid-cols-3">
        <div>
          <p className="text-lg font-black tracking-tight text-blue-700">
            РАСПЕЧАТКА
          </p>

          <p className="mt-3 text-sm leading-6 text-slate-600">
            Чёрно-белая печать документов A4 и A3 в Воронеже.
          </p>
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
            <a
              href="/privacy"
              className="block text-slate-600 hover:text-blue-700"
            >
              Политика обработки персональных данных
            </a>

            <a
              href="/personal-data-consent"
              className="block text-slate-600 hover:text-blue-700"
            >
              Согласие на обработку персональных данных
            </a>

            <a
              href="/offer"
              className="block text-slate-600 hover:text-blue-700"
            >
              Публичная оферта
            </a>

            <a
              href="/file-rules"
              className="block text-slate-600 hover:text-blue-700"
            >
              Правила загрузки и хранения файлов
            </a>
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