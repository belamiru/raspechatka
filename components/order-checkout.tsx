"use client";
import { useState, type FormEvent } from "react";
import type { GuestOrder } from "@/lib/order-checkout";
import { reachMetrikaGoal } from "@/lib/metrika";

const fieldClass = "mt-2 w-full rounded-xl border border-slate-300 px-4 py-3";
const statusLabels: Record<string, string> = {
  new: "Заказ принят", in_progress: "Заказ в работе", ready: "Заказ готов",
  completed: "Заказ выдан", cancelled: "Заказ отменён",
};
export function OrderCheckout({ order: initialOrder }: { order: GuestOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [name, setName] = useState(order.customer_name);
  const [phone, setPhone] = useState(order.customer_phone);
  const [comment, setComment] = useState(order.customer_comment ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/checkout`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customerName: name, customerPhone: phone, customerComment: comment,
          fulfillmentMethod: "pickup", paymentMethod: "on_receipt" }),
      });
      const result = await response.json();
      if (!response.ok || !result.order) throw new Error(result.error ?? "Не удалось подтвердить заказ.");
      setOrder(result.order);
      reachMetrikaGoal("order_created");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Ошибка соединения. Попробуйте снова.");
    } finally { setBusy(false); }
  }
  const pending = order.status === "awaiting_checkout";
  return <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <a href="/" className="font-black text-blue-700">РАСПЕЧАТКА</a>
      <h1 className="mt-6 text-2xl font-bold">{pending ? "Оформление заказа" : (statusLabels[order.status] ?? "Ваш заказ")}</h1>
      <p className="mt-2 text-slate-600">Номер: {order.order_number}</p>
      <p className="mt-4 text-xl font-bold">Стоимость печати: {order.total_price.toLocaleString("ru-RU")} ₽</p>
      {pending ? <form onSubmit={submit} className="mt-6 space-y-5">
        <p className="text-slate-600">Файлы сохранены. Укажите контакты и подтвердите заказ, чтобы передать его оператору.</p>
        <label className="block font-semibold">Имя *<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={fieldClass}/></label>
        <label className="block font-semibold">Телефон *<input required type="tel" maxLength={40} autoComplete="tel" placeholder="+7 900 000-00-00" value={phone} onChange={e => setPhone(e.target.value)} className={fieldClass}/></label>
        <label className="block font-semibold">Комментарий<textarea maxLength={2000} rows={3} value={comment} onChange={e => setComment(e.target.value)} className={fieldClass}/></label>
        <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="font-bold">Получение</legend>
          <label className="flex items-center gap-2"><input type="radio" name="fulfillment" checked readOnly/>Самовывоз — бесплатно</label>
        </fieldset>
        <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="font-bold">Оплата</legend>
          <label className="flex items-center gap-2"><input type="radio" name="payment" checked readOnly/>При получении</label>
        </fieldset>
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button disabled={busy} className="w-full rounded-xl bg-blue-700 px-5 py-3 font-bold text-white disabled:opacity-50">{busy ? "Подтверждаем…" : "Подтвердить заказ"}</button>
      </form> : <div className="mt-6 space-y-3">
        <p>{order.customer_name} · {order.customer_phone}</p>
        <p>Получение: самовывоз. Оплата: при получении.</p>
        {order.customer_comment && <p className="whitespace-pre-wrap">{order.customer_comment}</p>}
        {order.status === "new" && <p>Оператор проверит файлы и свяжется с вами для подтверждения.</p>}
        <a className="inline-block font-semibold text-blue-700 underline" href="/">Оформить ещё один заказ</a>
      </div>}
    </div>
  </main>;
}
