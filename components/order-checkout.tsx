"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { GuestOrder } from "@/lib/order-checkout";
import { reachMetrikaGoal } from "@/lib/metrika";
import { YandexPickupWidget, type YandexPickupPoint } from "@/components/yandex-pickup-widget";

const fieldClass = "mt-2 w-full rounded-xl border border-slate-300 px-4 py-3";
const statusLabels: Record<string, string> = {
  awaiting_payment: "Ожидаем оплату", paid: "Оплата подтверждена", new: "Заказ принят", in_progress: "Заказ в работе", ready: "Заказ готов",
  completed: "Заказ выдан", cancelled: "Заказ отменён",
};

export function OrderCheckout({ order: initialOrder }: { order: GuestOrder }) {
  const [order, setOrder] = useState(initialOrder);
  const [name, setName] = useState(order.customer_name);
  const [phone, setPhone] = useState(order.customer_phone);
  const [email, setEmail] = useState(order.customer_email ?? "");
  const [comment, setComment] = useState(order.customer_comment ?? "");
  const [method, setMethod] = useState<"pickup" | "yandex_pickup_point">("pickup");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "on_receipt">("online");
  const [point, setPoint] = useState<YandexPickupPoint | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<{ priceRubles: number; deliveryDays: number | null } | null>(null);
  const [quotingDelivery, setQuotingDelivery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [error, setError] = useState("");
  const selectPoint = useCallback((next: YandexPickupPoint | null) => { setPoint(next); setDeliveryQuote(null); }, []);

  useEffect(() => {
    if (method !== "yandex_pickup_point" || !point) return;
    let active = true;
    setQuotingDelivery(true); setError("");
    void fetch(`/api/orders/${order.id}/delivery/quote`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pickupPointId: point.id }) })
      .then(async (response) => { const result = await response.json(); if (!response.ok) throw new Error(result.error ?? "Не удалось рассчитать доставку."); if (active) setDeliveryQuote(result); })
      .catch((cause) => { if (active) setError(cause instanceof Error ? cause.message : "Не удалось рассчитать доставку."); })
      .finally(() => { if (active) setQuotingDelivery(false); });
    return () => { active = false; };
  }, [method, order.id, point]);

  const reconcilePayment = useCallback(async (showError = true) => {
    if (checkingPayment) return;
    setCheckingPayment(true);
    if (showError) setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/payments/tbank/status`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || !result.order) throw new Error(result.error ?? "Не удалось проверить статус оплаты.");
      setOrder(result.order);
    } catch (cause) {
      if (showError) setError(cause instanceof Error ? cause.message : "Не удалось проверить статус оплаты.");
    } finally {
      setCheckingPayment(false);
    }
  }, [checkingPayment, order.id]);

  // The redirect from T-Bank is not a payment confirmation. Reconcile with the bank
  // when the customer comes back, so a delayed webhook does not leave a paid order pending.
  useEffect(() => {
    if (initialOrder.status === "awaiting_payment") void reconcilePayment(false);
  // Run once for this checkout page instance; the manual button handles later retries.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialOrder.id]);

  async function retryPayment() {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      // The server creates a new attempt only after it has confirmed that the
      // previous payment was rejected/cancelled; it never charges this attempt again.
      const response = await fetch(`/api/orders/${order.id}/payments/tbank/init`, { method: "POST" });
      const result = await response.json();
      if (!response.ok || typeof result.paymentUrl !== "string") {
        throw new Error(result.error ?? "Не удалось начать новую попытку оплаты.");
      }
      reachMetrikaGoal("payment_started");
      window.location.assign(result.paymentUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось начать новую попытку оплаты.");
    } finally {
      setBusy(false);
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    if (method === "yandex_pickup_point" && !point) {
      setError("Выберите пункт выдачи на карте Яндекс Доставки.");
      return;
    }
    if (method === "yandex_pickup_point" && !deliveryQuote) {
      setError("Дождитесь расчёта стоимости доставки.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await fetch(`/api/orders/${order.id}/checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerName: name, customerPhone: phone, customerEmail: email, customerComment: comment,
          fulfillmentMethod: method, paymentMethod, pickupPoint: point,
        }),
      });
      const result = await response.json();
      if (!response.ok || !result.order) throw new Error(result.error ?? "Не удалось оформить заказ.");
      setOrder(result.order);
      if (paymentMethod === "on_receipt") return;
      const payment = await fetch(`/api/orders/${order.id}/payments/tbank/init`, { method: "POST" });
      const paymentResult = await payment.json();
      if (!payment.ok || typeof paymentResult.paymentUrl !== "string") {
        throw new Error(paymentResult.error ?? "Не удалось перейти к оплате.");
      }
      reachMetrikaGoal("payment_started");
      window.location.assign(paymentResult.paymentUrl);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ошибка соединения. Попробуйте снова.");
    } finally {
      setBusy(false);
    }
  }

  const pending = order.status === "awaiting_checkout";
  const awaitingPayment = order.status === "awaiting_payment";
  const retryablePayment = ["REJECTED", "CANCELED", "CANCELLED", "DEADLINE_EXPIRED"].includes(order.payment_status ?? "");
  const deliveryLabel = order.fulfillment_method === "yandex_pickup_point" ? "Доставка в ПВЗ Яндекс Доставки" : "Самовывоз";
  return <main className="min-h-screen bg-slate-50 px-5 py-10 text-slate-900">
    <div className="mx-auto max-w-2xl rounded-2xl bg-white p-6 shadow-sm sm:p-8">
      <a href="/" className="font-black text-blue-700">РАСПЕЧАТКА</a>
      <h1 className="mt-6 text-2xl font-bold">{pending ? "Оформление заказа" : (statusLabels[order.status] ?? "Ваш заказ")}</h1>
      <p className="mt-2 text-slate-600">Номер: {order.order_number}</p>
      <p className="mt-4 text-xl font-bold">Стоимость печати: {order.print_price.toLocaleString("ru-RU")} ₽</p>
      {!pending && order.delivery_price !== null && <p className="mt-2 text-lg font-semibold">Доставка: {order.delivery_price.toLocaleString("ru-RU")} ₽</p>}
      {!pending && order.delivery_price !== null && <p className="mt-1 text-xl font-bold">Итого: {order.total_price.toLocaleString("ru-RU")} ₽</p>}
      {pending ? <form onSubmit={submit} className="mt-6 space-y-5">
        <p className="text-slate-600">Файлы сохранены. Укажите контакты и перейдите к безопасной оплате на странице Т‑Банка.</p>
        <label className="block font-semibold">Имя *<input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} /></label>
        <label className="block font-semibold">Телефон *<input required type="tel" maxLength={40} autoComplete="tel" placeholder="+7 900 000-00-00" value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClass} /></label>
        <label className="block font-semibold">Email для кассового чека *<input required type="email" maxLength={254} autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} /></label>
        <label className="block font-semibold">Комментарий<textarea maxLength={2000} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} className={fieldClass} /></label>
        <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="font-bold">Получение</legend><div className="mt-3 space-y-3">
          <label className="flex cursor-pointer gap-2"><input type="radio" name="fulfillment" checked={method === "pickup"} onChange={() => { setMethod("pickup"); setPoint(null); setDeliveryQuote(null); }} />Самовывоз — бесплатно</label>
          <label className="flex cursor-pointer gap-2"><input type="radio" name="fulfillment" checked={method === "yandex_pickup_point"} onChange={() => { setMethod("yandex_pickup_point"); setPaymentMethod("online"); }} />Доставка в ПВЗ Яндекс Доставки — только онлайн-оплата</label>
        </div>{method === "yandex_pickup_point" && <><YandexPickupWidget weightGrams={Math.max(1, order.package_weight_grams ?? 1)} onSelect={selectPoint} />{point && <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm"><p className="font-semibold">Пункт выдачи: {point.address}</p>{quotingDelivery && <p className="mt-1">Рассчитываем стоимость доставки…</p>}{deliveryQuote && <><p className="mt-1">Доставка: {deliveryQuote.priceRubles.toLocaleString("ru-RU")} ₽</p>{deliveryQuote.deliveryDays !== null && <p>Ориентировочный срок: до {deliveryQuote.deliveryDays} дн.</p>}<p className="mt-1 font-bold">К оплате: {(order.print_price + deliveryQuote.priceRubles).toLocaleString("ru-RU")} ₽</p></>}</div>}</>}</fieldset>
        {method === "pickup" ? <fieldset className="rounded-xl border border-slate-200 p-4"><legend className="font-bold">Оплата</legend><div className="mt-3 space-y-3"><label className="flex cursor-pointer gap-2"><input type="radio" name="payment" checked={paymentMethod === "online"} onChange={() => setPaymentMethod("online")} />Оплатить онлайн через Т‑Банк</label><label className="flex cursor-pointer gap-2"><input type="radio" name="payment" checked={paymentMethod === "on_receipt"} onChange={() => setPaymentMethod("on_receipt")} />Оплатить при получении</label></div></fieldset> : <p className="text-sm text-slate-600">Оплата: онлайн через Т‑Банк. В сумму войдут печать и доставка.</p>}
        {error && <p role="alert" className="text-red-700">{error}</p>}
        <button disabled={busy || (method === "yandex_pickup_point" && (!point || !deliveryQuote || quotingDelivery))} className="w-full rounded-xl bg-blue-700 px-4 py-3 font-bold text-white disabled:opacity-50">{busy ? (paymentMethod === "online" ? "Переходим к оплате…" : "Оформляем заказ…") : paymentMethod === "online" ? "Перейти к оплате" : "Оформить заказ"}</button>
      </form> : <div className="mt-6 space-y-3">
        <p>{order.customer_name} · {order.customer_phone}</p><p>Получение: {deliveryLabel}.</p>
        {order.pickup_point_address && <p>Пункт: {order.pickup_point_address} ({order.pickup_point_type === "terminal" ? "постамат" : "ПВЗ"}).</p>}
        <p>Оплата: онлайн через Т‑Банк.</p>{order.fulfillment_method === "yandex_pickup_point" && <p>Стоимость доставки уточняется.</p>}
        {order.customer_comment && <p className="whitespace-pre-wrap">{order.customer_comment}</p>}
        {awaitingPayment && (retryablePayment ? <div className="space-y-3 rounded-xl bg-red-50 p-4 text-red-900"><p className="font-semibold">Оплата не прошла.</p><p className="text-sm">Банк отклонил платёж. Средства по этой попытке не списаны. Можно безопасно начать новую попытку оплаты.</p><button type="button" onClick={() => void retryPayment()} disabled={busy} className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? "Переходим к оплате…" : "Попробовать оплатить снова"}</button></div> : <div className="space-y-3"><p>Проверяем подтверждение оплаты от Т‑Банка.</p><button type="button" onClick={() => void reconcilePayment()} disabled={checkingPayment} className="rounded-xl border border-blue-700 px-4 py-2 font-semibold text-blue-700 disabled:opacity-50">{checkingPayment ? "Проверяем…" : "Проверить оплату"}</button></div>)}
        {order.status === "paid" && <p className="font-semibold text-emerald-700">Оплата подтверждена. Заказ передан оператору в работу.</p>}
        {order.status === "new" && <p>Оператор проверит файлы и свяжется с вами для подтверждения.</p>}
        <a className="inline-block font-semibold text-blue-700 underline" href="/">Оформить ещё один заказ</a>
      </div>}
    </div>
  </main>;
}
