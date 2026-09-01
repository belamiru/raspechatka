"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function AdminLoginPage() {
  const router = useRouter();

  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    setError("");
    setIsLoading(true);

    try {
      const response = await fetch("/api/admin/login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ password }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Не удалось выполнить вход.");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("Ошибка соединения. Попробуйте ещё раз.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-100 px-5">
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-7 shadow-xl sm:p-9">
        <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
          Распечатка
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900">
          Вход в админ-панель
        </h1>

        <p className="mt-3 text-sm leading-6 text-slate-500">
          Доступ только для сотрудников типографии.
        </p>

        <form onSubmit={handleSubmit} className="mt-8">
          <label className="block">
            <span className="mb-2 block text-sm font-semibold text-slate-700">
              Пароль
            </span>

            <input
              required
              autoFocus
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Введите пароль"
              className="w-full rounded-xl border border-slate-300 px-4 py-3 outline-none transition focus:border-blue-600 focus:ring-4 focus:ring-blue-100"
            />
          </label>

          {error && (
            <p className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="mt-6 w-full rounded-xl bg-blue-700 px-5 py-3.5 font-bold text-white transition hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isLoading ? "Проверяем..." : "Войти"}
          </button>
        </form>

        <a
          href="/"
          className="mt-6 block text-center text-sm font-semibold text-slate-500 hover:text-blue-700"
        >
          ← Вернуться на сайт
        </a>
      </section>
    </main>
  );
}