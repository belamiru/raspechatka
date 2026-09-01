"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type OrderStatus =
  | "new"
  | "in_progress"
  | "ready"
  | "completed"
  | "cancelled";

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
  fileName: string | null;
  paperFormat: string;
  pageCount: number;
  copies: number;
  printSides: string;
};

const statuses: { value: OrderStatus; label: string }[] = [
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
    new: "bg-blue-100 text-blue-800",
    in_progress: "bg-amber-100 text-amber-800",
    ready: "bg-emerald-100 text-emerald-800",
    completed: "bg-slate-200 text-slate-800",
    cancelled: "bg-red-100 text-red-800",
  };

  return classes[status];
}

export default function AdminOrders({
  initialOrders,
}: {
  initialOrders: Order[];
}) {
  const router = useRouter();
  const [orders, setOrders] = useState(initialOrders);
  const [updatingId, setUpdatingId] = useState<string | null>(null);
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

      const result = await response.json();

      if (!response.ok) {
        setError(result.error ?? "Не удалось изменить статус.");
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

          <div className="flex items-center gap-3">
            <a
              href="/"
              target="_blank"
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-bold hover:bg-slate-50"
            >
              Открыть сайт
            </a>

            <button
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
            <p className="text-sm font-semibold text-slate-500">Всего заказов</p>
            <p className="mt-2 text-3xl font-black">{orders.length}</p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Новые</p>
            <p className="mt-2 text-3xl font-black text-blue-700">
              {orders.filter((order) => order.status === "new").length}
            </p>
          </div>

          <div className="rounded-2xl bg-white p-5 shadow-sm">
            <p className="text-sm font-semibold text-slate-500">Готовы к выдаче</p>
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

        {orders.length === 0 ? (
          <div className="rounded-3xl bg-white p-10 text-center shadow-sm">
            <h2 className="text-2xl font-bold">Заказов пока нет</h2>
            <p className="mt-3 text-slate-500">
              Когда клиент оформит заказ на сайте, он появится здесь.
            </p>
          </div>
        ) : (
          <div className="space-y-5">
            {orders.map((order) => (
              <article
                key={order.id}
                className="rounded-3xl bg-white p-5 shadow-sm sm:p-7"
              >
                <div className="flex flex-col gap-5 border-b border-slate-100 pb-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <p className="text-sm font-bold text-blue-700">
                      {order.orderNumber}
                    </p>
                    <h2 className="mt-1 text-xl font-black">{order.customerName}</h2>
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
                      className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-semibold outline-none focus:border-blue-600"
                    >
                      {statuses.map((status) => (
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
                      {order.paperFormat}, {order.pageCount} стр., {order.copies} коп.
                    </p>
                    <p className="mt-1 text-sm text-slate-600">
                      {order.printSides === "two-sided"
                        ? "Двусторонняя печать"
                        : "Односторонняя печать"}
                    </p>
                    <p className="mt-2 text-xl font-black">{order.totalPrice} ₽</p>
                  </div>

                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-400">
                      Файл и комментарий
                    </p>
                    <p className="mt-2 break-all font-semibold">
                      {order.fileName ?? "Файл пока не загружен"}
                    </p>
                    {order.customerComment && (
                      <p className="mt-2 rounded-xl bg-slate-50 p-3 text-sm leading-5 text-slate-600">
                        {order.customerComment}
                      </p>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}