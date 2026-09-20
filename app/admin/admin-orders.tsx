"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrderStatus =
  | "awaiting_checkout"
  | "new"
  | "in_progress"
  | "ready"
  | "completed"
  | "cancelled";

type OrderFile = {
  id: string;
  fileName: string | null;
  diskPath: string | null;
  mimeType: string | null;
  paperFormat: string;
  pageCount: number;
  printablePageCount: number;
  pageOverrides: Record<string, { pageNumber: number; included?: boolean; paperFormat?: "A4" | "A3"; colorMode?: "black-and-white" | "color" | "solid-color" }>;
  copies: number;
  printSides: string;
};

type Order = {
  id: string;
  orderNumber: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  customerComment: string | null;
  totalPrice: number;
  status: OrderStatus;
  createdAt: string;
  files: OrderFile[];
};

const statuses: { value: OrderStatus; label: string }[] = [
  { value: "awaiting_checkout", label: "Ожидает оформления" },
  { value: "new", label: "Новый" },
  { value: "in_progress", label: "В работе" },
  { value: "ready", label: "Готов" },
  { value: "completed", label: "Выдан" },
  { value: "cancelled", label: "Отменён" },
];

function getStatusLabel(status: OrderStatus) {
  return statuses.find((item) => item.value === status)?.label ?? status;
}

function getStatusClass(status: OrderStatus) {
  const classes: Record<OrderStatus, string> = {
    awaiting_checkout: "bg-slate-100 text-slate-600",
    new: "bg-blue-100 text-blue-800",
    in_progress: "bg-amber-100 text-amber-800",
    ready: "bg-emerald-100 text-emerald-800",
    completed: "bg-slate-200 text-slate-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return classes[status];
}

function getFileTypeLabel(mimeType: string | null) {
  if (!mimeType) {
    return "Файл";
  }

  if (mimeType.startsWith("image/")) {
    return "Изображение";
  }

  if (mimeType === "application/pdf") {
    return "PDF";
  }

  return "Документ";
}
function getPhysicalSheetCount({
  pageCount,
  copies,
  printSides,
}: {
  pageCount: number;
  copies: number;
  printSides: string;
}) {
  const validPageCount = Math.max(1, pageCount);
  const validCopies = Math.max(1, copies);

  const sheetsPerCopy =
    printSides === "two-sided"
      ? Math.ceil(validPageCount / 2)
      : validPageCount;

  return sheetsPerCopy * validCopies;
}

function getSheetLabel(count: number) {
  const lastTwoDigits = count % 100;
  const lastDigit = count % 10;

  if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
    return "листов";
  }

  if (lastDigit === 1) {
    return "лист";
  }

  if (lastDigit >= 2 && lastDigit <= 4) {
    return "листа";
  }

  return "листов";
}
function getExcludedPages(file: OrderFile) {
  return Object.values(file.pageOverrides)
    .filter((item) => item.included === false)
    .map((item) => item.pageNumber)
    .sort((a, b) => a - b);
}

function getColorPages(file: OrderFile, colorMode: "color" | "solid-color") {
  return Object.values(file.pageOverrides).filter((item) => item.included !== false && item.colorMode === colorMode).map((item) => item.pageNumber).sort((a, b) => a - b);
}

function getA3Pages(file: OrderFile) {
  return Object.values(file.pageOverrides)
    .filter((item) => item.included !== false && item.paperFormat === "A3")
    .map((item) => item.pageNumber)
    .sort((a, b) => a - b);
}

export default function AdminOrders({
  initialOrders,
}: {
  initialOrders: Order[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [isCleaningDrafts, setIsCleaningDrafts] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState("");
  const [error, setError] = useState("");

  async function changeStatus(id: string, status: OrderStatus) {
    setError("");
    setUpdatingId(id);

    try {
      const response = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ status }),
      });

      const result = (await response.json().catch(() => null)) as {
        error?: string;
      } | null;

      if (!response.ok) {
        setError(result?.error ?? "Не удалось изменить статус.");
        return;
      }

      setOrders((currentOrders) =>
        currentOrders.map((order) =>
          order.id === id ? { ...order, status } : order
        )
      );
    } catch {
      setError("Ошибка соединения. Статус не изменён.");
    } finally {
      setUpdatingId(null);
    }
  }

  async function cleanupExpiredDrafts() {
    const confirmed = window.confirm(
      "Удалить с Яндекс Диска все просроченные неиспользованные черновики? Файлы оформленных заказов затронуты не будут."
    );

    if (!confirmed) {
      return;
    }

    setError("");
    setCleanupMessage("");
    setIsCleaningDrafts(true);

    try {
      const response = await fetch("/api/admin/print-drafts/cleanup", {
        method: "POST",
      });
      const result = (await response.json().catch(() => null)) as {
        found?: number;
        deleted?: number;
        failed?: number;
        hasMore?: boolean;
        error?: string;
      } | null;

      if (!response.ok) {
        setError(result?.error ?? "Не удалось очистить черновики.");
        return;
      }

      const suffix = result?.hasMore
        ? " Обработана первая сотня; нажмите кнопку ещё раз для продолжения."
        : "";
      setCleanupMessage(
        result?.found === 0
          ? "Просроченных черновиков для удаления нет."
          : `Удалено черновиков: ${result?.deleted ?? 0}. Не удалось удалить: ${result?.failed ?? 0}.${suffix}`
      );
    } catch {
      setError("Ошибка соединения. Черновики не очищены.");
    } finally {
      setIsCleaningDrafts(false);
    }
  }

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-slate-100 text-slate-900">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-blue-700">
              Распечатка
            </p>
            <h1 className="text-2xl font-black">Заказы</h1>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-3">
            <button
              type="button"
              onClick={cleanupExpiredDrafts}
              disabled={isCleaningDrafts}
              className="rounded-xl border border-red-200 px-4 py-2 text-sm font-bold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isCleaningDrafts ? "Очистка…" : "Очистить черновики"}
            </button>

            <a
              href="/"
              target="_blank"
              rel="noreferrer"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50"
            >
              Открыть сайт
            </a>

            <button
              type="button"
              onClick={logout}
              className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-bold text-white hover:bg-slate-700"
            >
              Выйти
            </button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-5 py-8">
        <div className="mb-6 grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Всего заказов
            </p>
            <p className="mt-2 text-3xl font-black">{orders.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Новые</p>
            <p className="mt-2 text-3xl font-black text-blue-700">
              {orders.filter((order) => order.status === "new").length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">
              Готовы к выдаче
            </p>
            <p className="mt-2 text-3xl font-black text-emerald-700">
              {orders.filter((order) => order.status === "ready").length}
            </p>
          </div>
        </div>

        {error && (
          <p className="mb-5 rounded-xl bg-red-50 p-4 text-sm font-medium text-red-700">
            {error}
          </p>
        )}

        {cleanupMessage && (
          <p className="mb-5 rounded-xl bg-emerald-50 p-4 text-sm font-medium text-emerald-800">
            {cleanupMessage}
          </p>
        )}

        {orders.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-bold">Заказов пока нет</h2>
            <p className="mt-3 text-slate-500">
              Когда клиент оформит заказ на сайте, он появится здесь.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => {
              const totalPages = order.files.reduce(
                (total, file) => total + file.pageCount,
                0
              );

              return (
                <article
                  key={order.id}
                  className="rounded-3xl bg-white p-5 shadow-sm sm:p-7"
                >
                  <div className="flex flex-col gap-5 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-sm font-bold text-blue-700">
                        {order.orderNumber}
                      </p>

                      <h2 className="mt-1 text-xl font-black">
                        {order.customerName}
                      </h2>

                      <p className="mt-1 text-sm text-slate-500">
                        {new Date(order.createdAt).toLocaleString("ru-RU")}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span
                        className={`rounded-full px-3 py-1.5 text-sm font-bold ${getStatusClass(
                          order.status
                        )}`}
                      >
                        {getStatusLabel(order.status)}
                      </span>

                      <select
                        value={order.status}
                        disabled={updatingId === order.id}
                        onChange={(event) =>
                          changeStatus(
                            order.id,
                            event.target.value as OrderStatus
                          )
                        }
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-600 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {statuses.filter(status => order.status === "awaiting_checkout" ? ["awaiting_checkout", "cancelled"].includes(status.value) : status.value !== "awaiting_checkout").map((status) => (
                          <option key={status.value} value={status.value}>
                            {status.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-3">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Контакты
                      </p>

                      <a
                        href={`tel:${order.customerPhone}`}
                        className="mt-2 block font-bold text-blue-700 hover:underline"
                      >
                        {order.customerPhone}
                      </a>

                      {order.customerEmail && (
                        <a
                          href={`mailto:${order.customerEmail}`}
                          className="mt-1 block break-all text-sm text-slate-600 hover:text-blue-700"
                        >
                          {order.customerEmail}
                        </a>
                      )}
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Печать
                      </p>

                      <p className="mt-2 font-semibold">
                        {order.files.length}{" "}
                        {order.files.length === 1 ? "файл" : "файлов"},{" "}
                        {totalPages} стр.
                      </p>

                      <p className="mt-1 text-sm text-slate-600">
                        Параметры печати указаны для каждого файла ниже.
                      </p>

                      <p className="mt-2 text-xl font-black">
                        {order.totalPrice} ₽
                      </p>
                    </div>

                    <div>
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Комментарий
                      </p>

                      {order.customerComment ? (
                        <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">
                          {order.customerComment}
                        </p>
                      ) : (
                        <p className="mt-2 text-sm text-slate-500">
                          Нет комментария.
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 border-t border-slate-100 pt-5">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                        Файлы заказа
                      </p>

                      <p className="text-sm text-slate-500">
                        Всего: {order.files.length}
                      </p>
                    </div>

                    {order.files.length === 0 ? (
                      <p className="mt-3 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
                        В заказе пока нет загруженных файлов.
                      </p>
                    ) : (
                      <ul className="mt-3 divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200">
                        {order.files.map((file, index) => (
                          <li
                            key={file.id}
                            className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between"
                          >
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <p
                                  className="break-all font-bold text-slate-800"
                                  title={file.fileName ?? undefined}
                                >
                                  {file.fileName ?? "Файл без имени"}
                                </p>

                                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-600">
                                  {getFileTypeLabel(file.mimeType)}
                                </span>
                              </div>

                              <p className="mt-2 text-sm text-slate-600">
                                Файл {index + 1} · {file.paperFormat} · {file.pageCount} стр. ·{" "}
                                {getPhysicalSheetCount({
                                  pageCount: file.printablePageCount,
                                  copies: file.copies,
                                  printSides: file.printSides,
                                })}{" "}
                                {getSheetLabel(
                                  getPhysicalSheetCount({
                                    pageCount: file.pageCount,
                                    copies: file.copies,
                                    printSides: file.printSides,
                                  })
                                )}{" "}
                                · {file.copies} коп. ·{" "}
                                {file.printSides === "two-sided"
                                  ? "двусторонняя печать"
                                  : "односторонняя печать"}
                              </p>

                              {getExcludedPages(file).length > 0 && (
                                <p className="mt-2 text-sm font-bold text-red-700">
                                  Печатать: {file.printablePageCount} из {file.pageCount} стр. · Не печатать: стр. {getExcludedPages(file).join(", ")}
                                </p>
                              )}

                              {getA3Pages(file).length > 0 && (
                                <p className="mt-1 text-sm font-bold text-amber-800">
                                  A3: стр. {getA3Pages(file).join(", ")} · Остальные: {file.paperFormat}
                                </p>
                              )}
                              {getColorPages(file, "color").length > 0 && <p className="mt-1 text-sm font-bold text-blue-800">Цветные: стр. {getColorPages(file, "color").join(", ")}</p>}
                              {getColorPages(file, "solid-color").length > 0 && <p className="mt-1 text-sm font-bold text-fuchsia-800">Сплошная заливка: стр. {getColorPages(file, "solid-color").join(", ")}</p>}
                            </div>

                            {file.diskPath ? (
                              <a
                                href={`/api/admin/files/${file.id}`}
                                className="inline-flex shrink-0 justify-center rounded-xl bg-blue-700 px-4 py-2 text-sm font-bold text-white hover:bg-blue-800"
                              >
                                Скачать файл
                              </a>
                            ) : (
                              <span className="shrink-0 text-sm font-medium text-red-600">
                                Файл недоступен
                              </span>
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}