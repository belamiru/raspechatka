"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { YANDEX_METRIKA_ID } from "@/lib/metrika";

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
    webvisor: false,
  });

  const script = document.createElement("script");
  script.id = "yandex-metrika-script";
  script.async = true;
  script.src = "https://mc.yandex.ru/metrika/tag.js";

  document.head.appendChild(script);
}

export function CookieConsent() {
  const [consent, setConsent] = useState<ConsentChoice>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const savedConsent = window.localStorage.getItem(
      CONSENT_STORAGE_KEY
    ) as ConsentChoice;

    if (savedConsent === "analytics") {
      startYandexMetrika();
    }

    setConsent(savedConsent);
    setIsReady(true);
  }, []);

  function saveConsent(choice: Exclude<ConsentChoice, null>) {
    window.localStorage.setItem(CONSENT_STORAGE_KEY, choice);
    setConsent(choice);

    if (choice === "analytics") {
      startYandexMetrika();
    }
  }

  if (!isReady || consent) {
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
            Используем cookie
          </h2>

          <p className="mt-2 text-sm leading-6 text-slate-600">
            Необходимые cookie помогают сайту работать. С вашего согласия мы
            подключаем Яндекс Метрику для анализа посещаемости и улучшения
            сервиса. В аналитику не передаются данные формы заказа и
            загруженные файлы.
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