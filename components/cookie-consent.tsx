"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { YANDEX_METRIKA_ID, VK_PIXEL_ID, TEST_ANALYTICS_WITHOUT_CONSENT } from "@/lib/metrika";

type ConsentChoice = "analytics" | "necessary" | null;

const CONSENT_STORAGE_KEY = "copyleft-cookie-consent-v1";

function startYandexMetrika() {
  if (typeof window === "undefined") {
    return;
  }

  if (document.getElementById("yandex-metrika-script")) {
    return;
  }

  if (!window.ym) {
  type YandexMetrikaQueue = ((...args: unknown[]) => void) & {
    a?: unknown[][];
  };

  const ymQueue: YandexMetrikaQueue = (...args: unknown[]) => {
    ymQueue.a = ymQueue.a ?? [];
    ymQueue.a.push(args);
  };

  window.ym = ymQueue;
}

  window.ym(YANDEX_METRIKA_ID, "init", {
    clickmap: true,
    trackLinks: true,
    accurateTrackBounce: true,
    webvisor: true,
  });

  const script = document.createElement("script");
  script.id = "yandex-metrika-script";
  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";

  document.head.appendChild(script);
}

function startVkPixel() {
  if (document.getElementById("tmr-code")) return;
  window.dataLayer = window.dataLayer || [];
  window._tmr = window._tmr || [];
  window._tmr.push({ id: VK_PIXEL_ID, type: "pageView", start: Date.now() });
  const script = document.createElement("script");
  script.id = "tmr-code";
  script.async = true;
  script.src = "https://top-fwz1.mail.ru/js/code.js";
  document.head.appendChild(script);
}

export function CookieConsent() {
  const pathname = usePathname();
  const previousPath = useRef<string | null>(null);
  const [consent, setConsent] = useState<ConsentChoice>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedConsent = window.localStorage.getItem(
      CONSENT_STORAGE_KEY
    ) as ConsentChoice;

    if (TEST_ANALYTICS_WITHOUT_CONSENT || savedConsent === "analytics") {
      startYandexMetrika();
      startVkPixel();
    }

    setConsent(savedConsent);
    setIsReady(true);
  }, []);

  useEffect(() => {
    if (!pathname || !window._tmr) return;
    if (previousPath.current !== null && previousPath.current !== pathname) {
      window._tmr.push({ id: VK_PIXEL_ID, type: "pageView", url: window.location.origin + pathname });
    }
    previousPath.current = pathname;
  }, [pathname, consent]);

  function saveConsent(choice: Exclude<ConsentChoice, null>) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    setConsent(choice);

    if (choice === "analytics") {
      startYandexMetrika();
      startVkPixel();
    }
  }

  if (TEST_ANALYTICS_WITHOUT_CONSENT || !isReady || consent) {
    return null;
  }

  return (
    <section
      role="dialog"
      aria-modal="false"
      aria-labelledby="cookie-consent-title"
      className="fixed inset-x-4 bottom-4 z-50 mx-auto max-w-3xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl sm:p-6"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-xl">
          <h2
            id="cookie-consent-title"
            className="text-lg font-bold text-slate-950"
          >
            Настройки аналитики
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Необходимые технические технологии помогают сайту работать. С вашего
            согласия мы подключаем Яндекс Метрику и VK Пиксель для анализа посещаемости и
            улучшения сервиса. Вебвизор может записывать взаимодействия со страницами.
          </p>

          <Link
            href="/privacy"
            className="mt-3 inline-block text-sm font-semibold text-blue-700 underline underline-offset-4 hover:text-blue-800"
          >
            Политика обработки персональных данных
          </Link>
        </div>

        <div className="flex shrink-0 flex-col gap-2 sm:min-w-52">
          <button
            type="button"
            onClick={() => saveConsent("analytics")}
            className="rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white transition hover:bg-blue-800"
          >
            Принять аналитику
          </button>

          <button
            type="button"
            onClick={() => saveConsent("necessary")}
            className="rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
          >
            Только необходимые
          </button>
        </div>
      </div>
    </section>
  );
}