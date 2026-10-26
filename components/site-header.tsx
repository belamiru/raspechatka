"use client";

import { useEffect, useRef, useState } from "react";

const PHONE_LABEL = "8 (473) 206-61-77";
const PHONE_HREF = "tel:+74732066177";
const TELEGRAM_URL = "https://t.me/belami_ru";
const MAX_URL = "https://max.ru/u/f9LHodD0cOJSiXthYzqOB1UCkuCYaObsZoaN6c_SgReZfE2QVGWuwChkOlE";

/**
 * Ссылки вида "/#id" работают и на главной (плавный скролл без перезагрузки),
 * и на внутренних страницах (переход на главную к нужному блоку).
 */
const UPLOAD_HREF = "/#upload";

const SERVICE_GROUPS: { title: string; links: { label: string; href: string }[] }[] = [
  {
    title: "Печать документов",
    links: [
      { label: "Чёрно-белая", href: UPLOAD_HREF },
      { label: "Цветная", href: "/color-printing" },
    ],
  },
  { title: "Фото", links: [{ label: "Фотопечать", href: "/photo-printing" }] },
  {
    title: "Крупный формат",
    links: [
      { label: "Плакаты", href: "/color-printing" },
      { label: "Чертежи", href: "/color-printing" },
    ],
  },
  {
    title: "После печати",
    links: [
      { label: "Ламинация", href: "/lamination" },
      { label: "Переплёт на пружину", href: "/metal-binding" },
    ],
  },
];

const NAV_LINKS = [
  { label: "Цены", href: "/#prices" },
  { label: "Как заказать", href: "/#how-to-order" },
  { label: "Доставка", href: "/#delivery" },
  { label: "Контакты", href: "/#contacts" },
];

function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" aria-hidden="true">
      <path d="M21.9 4.3 18.7 19.5c-.2 1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.5-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.4 2.8c.9-.3 1.6.2 1.5 1.5Z" />
    </svg>
  );
}

function MaxIcon() {
  return <img src="/max-logo.svg" width="20" height="20" alt="" aria-hidden="true" />;
}

function PhoneIcon() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2Z" />
    </svg>
  );
}

function SocialLinks({ className = "" }: { className?: string }) {
  const linkClass =
    "flex h-9 w-9 items-center justify-center rounded-full bg-blue-50 text-blue-700 transition hover:bg-blue-100";
  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <a href={TELEGRAM_URL} target="_blank" rel="noopener noreferrer" aria-label="Мы в Telegram" className={linkClass}>
        <TelegramIcon />
      </a>
      <a href={MAX_URL} target="_blank" rel="noopener noreferrer" aria-label="Мы в Max" className={linkClass}>
        <MaxIcon />
      </a>
    </div>
  );
}

export function SiteHeader() {
  const [servicesOpen, setServicesOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const servicesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!servicesOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (servicesRef.current && !servicesRef.current.contains(event.target as Node)) setServicesOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setServicesOpen(false);
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [servicesOpen]);

  useEffect(() => {
    if (!mobileOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [mobileOpen]);

  const navLinkClass = "rounded-lg px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 hover:text-blue-700";
  const uploadButtonClass =
    "shrink-0 rounded-xl bg-blue-700 px-3 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 sm:px-4";

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-4 py-3 sm:px-5">
        <a href="/" className="shrink-0 text-lg font-black tracking-tight text-blue-700 sm:text-xl">
          РАСПЕЧАТКА
        </a>

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Основное меню">
          <div ref={servicesRef} className="relative">
            <button
              type="button"
              onClick={() => setServicesOpen((open) => !open)}
              aria-expanded={servicesOpen}
              aria-haspopup="true"
              className={`${navLinkClass} flex items-center gap-1`}
            >
              Услуги
              <svg viewBox="0 0 20 20" width="14" height="14" fill="currentColor" aria-hidden="true" className={`transition ${servicesOpen ? "rotate-180" : ""}`}>
                <path d="m5 7 5 6 5-6H5Z" />
              </svg>
            </button>

            {servicesOpen && (
              <div className="absolute left-0 top-full z-50 pt-2">
                <div className="grid w-[30rem] grid-cols-2 gap-x-6 gap-y-4 rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
                  {SERVICE_GROUPS.map((group) => (
                    <div key={group.title}>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{group.title}</p>
                      <ul className="mt-2 space-y-1">
                        {group.links.map((link) => (
                          <li key={link.label}>
                            <a
                              href={link.href}
                              onClick={() => setServicesOpen(false)}
                              className="block rounded-lg px-2 py-1.5 text-sm font-semibold text-slate-800 transition hover:bg-blue-50 hover:text-blue-700"
                            >
                              {link.label}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {NAV_LINKS.map((link) => (
            <a key={link.label} href={link.href} className={navLinkClass}>
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <a href={PHONE_HREF} className="flex items-center gap-2 text-sm font-bold text-slate-800 transition hover:text-blue-700">
            <PhoneIcon />
            <span className="hidden xl:inline">{PHONE_LABEL}</span>
            <span className="sr-only xl:hidden">{PHONE_LABEL}</span>
          </a>
          <SocialLinks />
          <a href={UPLOAD_HREF} className={uploadButtonClass}>
            Загрузить файл
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <a href={UPLOAD_HREF} className={uploadButtonClass}>
            Загрузить файл
          </a>
          <button
            type="button"
            onClick={() => setMobileOpen((open) => !open)}
            aria-expanded={mobileOpen}
            aria-controls="mobile-menu"
            aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 text-slate-700"
          >
            <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
              {mobileOpen ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
      </div>

      {mobileOpen && (
        <div id="mobile-menu" className="max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-slate-100 bg-white px-4 pb-5 pt-3 lg:hidden">
          <div className="space-y-4">
            {SERVICE_GROUPS.map((group) => (
              <div key={group.title}>
                <p className="text-xs font-bold uppercase tracking-wider text-slate-400">{group.title}</p>
                <ul className="mt-1">
                  {group.links.map((link) => (
                    <li key={link.label}>
                      <a href={link.href} onClick={() => setMobileOpen(false)} className="block rounded-lg px-2 py-2 font-semibold text-slate-800 hover:bg-blue-50">
                        {link.label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          <ul className="mt-4 border-t border-slate-100 pt-3">
            {NAV_LINKS.map((link) => (
              <li key={link.label}>
                <a href={link.href} onClick={() => setMobileOpen(false)} className="block rounded-lg px-2 py-2 font-semibold text-slate-800 hover:bg-blue-50">
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex items-center justify-between gap-3 border-t border-slate-100 pt-4">
            <a href={PHONE_HREF} className="flex items-center gap-2 font-bold text-slate-800">
              <PhoneIcon />
              {PHONE_LABEL}
            </a>
            <SocialLinks />
          </div>
        </div>
      )}
    </header>
  );
}
