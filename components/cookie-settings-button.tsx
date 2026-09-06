"use client";

const CONSENT_STORAGE_KEY = "copyleft-cookie-consent-v1";

export function CookieSettingsButton() {
  function resetAnalyticsConsent() {
    window.localStorage.removeItem(CONSENT_STORAGE_KEY);

    // После перезагрузки Метрика не будет запускаться автоматически:
    // сохранённое согласие удалено, а пользователь снова увидит баннер.
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={resetAnalyticsConsent}
      className="mt-4 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-blue-300 hover:bg-blue-50 hover:text-blue-700"
    >
      Изменить настройки аналитики
    </button>
  );
}