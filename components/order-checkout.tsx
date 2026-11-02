"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import type { GuestOrder } from "@/lib/order-checkout";
import { reachMetrikaGoal } from "@/lib/metrika";
import { YandexPickupWidget, type YandexPickupPoint } from "@/components/yandex-pickup-widget";
import { OzonPickupPicker, type OzonPickupPoint } from "@/components/ozon-pickup-picker";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { FreeDeliveryProgress } from "@/components/free-delivery-progress";
import { formatDeliveryPrice } from "@/lib/delivery";
import { OZON_DELIVERY_ENABLED } from "@/lib/site";

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
  const [method, setMethod] = useState<"pickup" | "yandex_pickup_point" | "ozon_pickup_point">("pickup");
  const [paymentMethod, setPaymentMethod] = useState<"online" | "on_receipt">("online");
  const [point, setPoint] = useState<YandexPickupPoint | null>(null);
  const [deliveryQuote, setDeliveryQuote] = useState<{ priceRubles: number; deliveryDays: number | null } | null>(null);
  const [ozonPoint, setOzonPoint] = useState<OzonPickupPoint | null>(null);
  const [ozonQuote, setOzonQuote] = useState<{ phone: string; priceRubles: number; deliveryPriceRubles: number; insurancePriceRubles: number; deliveryDays: number | null } | null>(null);
  const [quotingOzon, setQuotingOzon] = useState(false);
  const [quotingDelivery, setQuotingDelivery] = useState(false);
  const [busy, setBusy] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);
  const [error, setError] = useState("");
  const selectPoint = useCallback((next: YandexPickupPoint | null) => { setPoint(next); setDeliveryQuote(null); }, []);
  const selectOzonPoint = useCallback((next: OzonPickupPoint | null) => { setOzonPoint(next); setOzonQuote(null); }, []);

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

  useEffect(() => {
    if (method !== "ozon_pickup_point" || !ozonPoint) return;
    const digits = phone.replace(/\D/g, "");
    if (digits.length < 10) return;
    let active = true;
    const timer = setTimeout(() => {
      setQuotingOzon(true); setError("");
      void fetch(`/api/orders/${order.id}/delivery/ozon-quote`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pickupPointId: ozonPoint.id, customerPhone: phone }),
      })
        .then(async (response) => {
          const result = await response.json();
          if (!response.ok) throw new Error(result.error ?? "Не удалось рассчитать доставку Ozon.");
          if (active) setOzonQuote({ ...result, phone });
        })
        .catch((cause) => {
          if (!active) return;
          setError(cause instanceof Error ? cause.message : "Не удалось рассчитать доставку Ozon.");
        })
        .finally(() => { if (active) setQuotingOzon(false); });
    }, 600);
    return () => { active = false; clearTimeout(timer); };
  }, [method, order.id, ozonPoint, phone]);

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
    if (method === "ozon_pickup_point" && !ozonPoint) {
      setError("Выберите пункт выдачи Ozon.");
      return;
    }
    if (method === "ozon_pickup_point" && !activeOzonQuote) {
      setError("Дождитесь расчёта стоимости доставки Ozon.");
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
          fulfillmentMethod: method, paymentMethod,
          pickupPoint: method === "ozon_pickup_point" ? ozonPoint : point,
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

  const activeOzonQuote = ozonQuote && ozonQuote.phone === phone ? ozonQuote : null;
  const pending = order.status === "awaiting_checkout";
  const awaitingPayment = order.status === "awaiting_payment";
  const retryablePayment = ["REJECTED", "CANCELED", "CANCELLED", "DEADLINE_EXPIRED"].includes(order.payment_status ?? "");
  const deliveryLabel = order.fulfillment_method === "yandex_pickup_point" ? "Доставка в ПВЗ Яндекс Доставки"
    : order.fulfillment_method === "ozon_pickup_point" ? "Доставка в ПВЗ Ozon" : "Самовывоз";
  return (
    <main className="min-h-screen bg-white text-slate-900">
      <SiteHeader />

      <section className="border-b border-slate-100 bg-gradient-to-b from-blue-50/60 to-white">
        <div className="mx-auto max-w-[1200px] px-5 py-8 sm:py-10">
          <nav className="text-sm text-slate-500" aria-label="Навигация">
            <Link href="/" className="hover:text-blue-700">Главная</Link> /{" "}
            <Link href="/order" className="hover:text-blue-700">Заказ</Link> /{" "}
            <span className="text-slate-700">Оформление</span>
          </nav>

          <div className="mt-4 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <h1 className="text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">
                {pending ? "Оформление заказа" : (statusLabels[order.status] ?? "Ваш заказ")}
              </h1>
              <p className="mt-2 text-slate-600">Заказ № {order.order_number}</p>
            </div>

            <ol
              className="grid w-full max-w-md grid-cols-3 gap-2 text-xs font-semibold text-slate-500 sm:text-sm"
              aria-label="Этапы заказа"
            >
              <li>
                <span className="block h-1.5 rounded-full bg-blue-600" />
                <span className="mt-2 block text-slate-900">1. Файлы</span>
              </li>
              <li aria-current="step">
                <span className="block h-1.5 rounded-full bg-blue-600" />
                <span className="mt-2 block text-slate-900">2. Оформление</span>
              </li>
              <li>
                <span className="block h-1.5 rounded-full bg-slate-200" />
                <span className="mt-2 block">3. Оплата</span>
              </li>
            </ol>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1200px] px-5 py-8">
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(320px,0.9fr)]">
          <div className="min-w-0">
            {pending ? (
              <form onSubmit={submit} className="space-y-5">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-black text-slate-950">Контакты</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    Файлы сохранены. Укажите, с кем связаться, и переходите к оплате.
                  </p>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <label className="block text-sm font-semibold text-slate-800">
                      Имя *
                      <input required minLength={2} maxLength={120} autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} />
                    </label>

                    <label className="block text-sm font-semibold text-slate-800">
                      Телефон *
                      <input required type="tel" maxLength={40} autoComplete="tel" placeholder="+7 900 000-00-00" value={phone} onChange={(event) => setPhone(event.target.value)} className={fieldClass} />
                    </label>

                    <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
                      Email для кассового чека *
                      <input required type="email" maxLength={254} autoComplete="email" placeholder="name@example.com" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} />
                    </label>

                    <label className="block text-sm font-semibold text-slate-800 sm:col-span-2">
                      Комментарий
                      <textarea maxLength={2000} rows={3} value={comment} onChange={(event) => setComment(event.target.value)} className={fieldClass} />
                    </label>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-black text-slate-950">Получение</h2>

                  <div className="mt-3 space-y-2">
                    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${method === "pickup" ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-200" : "border-slate-200 hover:bg-slate-50"}`}>
                      <input type="radio" name="fulfillment" className="mt-1 h-4 w-4 shrink-0" checked={method === "pickup"} onChange={() => { setMethod("pickup"); setPoint(null); setDeliveryQuote(null); }} />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900">Самовывоз</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">Воронеж, ул. Шукшина, д. 21, офис 8 — бесплатно</span>
                      </span>
                    </label>

                    <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${method === "yandex_pickup_point" ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-200" : "border-slate-200 hover:bg-slate-50"}`}>
                      <input type="radio" name="fulfillment" className="mt-1 h-4 w-4 shrink-0" checked={method === "yandex_pickup_point"} onChange={() => { setMethod("yandex_pickup_point"); setPaymentMethod("online"); }} />
                      <span className="min-w-0">
                        <span className="block text-sm font-bold text-slate-900">Яндекс Доставка в ПВЗ</span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">Только онлайн-оплата</span>
                      </span>
                    </label>

                    {/*
                      Ozon временно недоступен: radio отключён, подпись серая,
                      курсор не превращается в «руку». Пометка стоит прямо
                      в заголовке, чтобы её нельзя было не заметить.
                    */}
                    <label
                      className={`flex gap-3 rounded-xl border p-3 transition ${
                        OZON_DELIVERY_ENABLED
                          ? method === "ozon_pickup_point"
                            ? "cursor-pointer border-blue-600 bg-blue-50/60 ring-1 ring-blue-200"
                            : "cursor-pointer border-slate-200 hover:bg-slate-50"
                          : "cursor-not-allowed border-slate-200 bg-slate-50/60"
                      }`}
                    >
                      <input
                        type="radio"
                        name="fulfillment"
                        className="mt-1 h-4 w-4 shrink-0"
                        disabled={!OZON_DELIVERY_ENABLED}
                        checked={method === "ozon_pickup_point"}
                        onChange={() => {
                          setMethod("ozon_pickup_point");
                          setPaymentMethod("online");
                          setPoint(null);
                          setDeliveryQuote(null);
                        }}
                      />
                      <span className="min-w-0">
                        <span className={`block text-sm font-bold ${OZON_DELIVERY_ENABLED ? "text-slate-900" : "text-slate-500"}`}>
                          Ozon в ПВЗ{!OZON_DELIVERY_ENABLED && " (временно недоступно)"}
                        </span>
                        <span className="mt-0.5 block text-xs leading-5 text-slate-500">Только онлайн-оплата</span>
                      </span>
                    </label>
                  </div>

                  {method === "ozon_pickup_point" && (
                    <>
                      <OzonPickupPicker selected={ozonPoint} onSelect={selectOzonPoint} />
                      {ozonPoint && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                          <p className="font-semibold text-slate-900">Пункт Ozon: {ozonPoint.address}</p>
                          {quotingOzon && <p className="mt-1 text-slate-600">Рассчитываем стоимость доставки…</p>}
                          {activeOzonQuote && (
                            <>
                              <p className="mt-1 text-slate-700">Доставка: {formatDeliveryPrice(activeOzonQuote.deliveryPriceRubles)}</p>
                              {activeOzonQuote.insurancePriceRubles > 0 && <p className="text-slate-700">Страховка: {activeOzonQuote.insurancePriceRubles.toLocaleString("ru-RU")} ₽</p>}
                              {activeOzonQuote.deliveryDays !== null && <p className="text-slate-700">Ориентировочный срок: до {activeOzonQuote.deliveryDays} дн.</p>}
                              <p className="mt-1 font-bold text-slate-950">К оплате: {(order.print_price + activeOzonQuote.priceRubles).toLocaleString("ru-RU")} ₽</p>
                            </>
                          )}
                          {!activeOzonQuote && !quotingOzon && <p className="mt-1 text-slate-600">Укажите телефон, зарегистрированный на Ozon, — он нужен для расчёта.</p>}
                        </div>
                      )}
                    </>
                  )}

                  {method === "yandex_pickup_point" && (
                    <>
                      <YandexPickupWidget weightGrams={Math.max(1, order.package_weight_grams ?? 1)} onSelect={selectPoint} />
                      {point && (
                        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
                          <p className="font-semibold text-slate-900">Пункт выдачи: {point.address}</p>
                          {quotingDelivery && <p className="mt-1 text-slate-600">Рассчитываем стоимость доставки…</p>}
                          {deliveryQuote && (
                            <>
                              <p className="mt-1 text-slate-700">Доставка: {formatDeliveryPrice(deliveryQuote.priceRubles)}</p>
                              {deliveryQuote.deliveryDays !== null && <p className="text-slate-700">Ориентировочный срок: до {deliveryQuote.deliveryDays} дн.</p>}
                              <p className="mt-1 font-bold text-slate-950">К оплате: {(order.print_price + deliveryQuote.priceRubles).toLocaleString("ru-RU")} ₽</p>
                            </>
                          )}
                        </div>
                      )}
                    </>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-black text-slate-950">Оплата</h2>

                  {method === "pickup" ? (
                    <div className="mt-3 space-y-2">
                      <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${paymentMethod === "online" ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-200" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input type="radio" name="payment" className="mt-1 h-4 w-4 shrink-0" checked={paymentMethod === "online"} onChange={() => setPaymentMethod("online")} />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-900">Оплатить онлайн</span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-500">Безопасная оплата картой через Т-Банк</span>
                        </span>
                      </label>

                      <label className={`flex cursor-pointer gap-3 rounded-xl border p-3 transition ${paymentMethod === "on_receipt" ? "border-blue-600 bg-blue-50/60 ring-1 ring-blue-200" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input type="radio" name="payment" className="mt-1 h-4 w-4 shrink-0" checked={paymentMethod === "on_receipt"} onChange={() => setPaymentMethod("on_receipt")} />
                        <span className="min-w-0">
                          <span className="block text-sm font-bold text-slate-900">Оплатить при получении</span>
                          <span className="mt-0.5 block text-xs leading-5 text-slate-500">Наличными или картой в пункте выдачи</span>
                        </span>
                      </label>
                    </div>
                  ) : (
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      Оплата онлайн через Т-Банк. В сумму войдут печать и доставка.
                    </p>
                  )}
                </section>

                {error && (
                  <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm font-medium text-red-700 ring-1 ring-red-100">
                    {error}
                  </p>
                )}

                <button
                  disabled={busy || (method === "yandex_pickup_point" && (!point || !deliveryQuote || quotingDelivery)) || (OZON_DELIVERY_ENABLED && method === "ozon_pickup_point" && (!ozonPoint || !activeOzonQuote || quotingOzon))}
                  className="w-full rounded-xl bg-amber-500 px-5 py-4 font-bold text-white transition hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {busy
                    ? (paymentMethod === "online" ? "Переходим к оплате…" : "Оформляем заказ…")
                    : (paymentMethod === "online" ? "Перейти к оплате" : "Оформить заказ")}
                </button>
              </form>
            ) : (
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <h2 className="text-lg font-black text-slate-950">Детали заказа</h2>

                <div className="mt-4 space-y-2 text-sm text-slate-700">
                  <p>{order.customer_name} · {order.customer_phone}</p>
                  <p>Получение: {deliveryLabel}.</p>
                  {order.pickup_point_address && (
                    <p>
                      Пункт: {order.pickup_point_address}{" "}
                      ({["terminal", "ozon_postamat"].includes(order.pickup_point_type ?? "") ? "постамат" : "ПВЗ"}).
                    </p>
                  )}
                  {order.fulfillment_method === "ozon_pickup_point" && order.ozon_delivery_price !== null && (
                    <p>
                      Доставка Ozon: {formatDeliveryPrice(order.ozon_delivery_price)}
                      {order.ozon_insurance_price ? `, страховка: ${order.ozon_insurance_price.toLocaleString("ru-RU")} ₽` : ""}
                      {order.ozon_delivery_days !== null ? `, срок до ${order.ozon_delivery_days} дн.` : ""}
                    </p>
                  )}
                  {order.ozon_order_number && <p>Заказ в Ozon: {order.ozon_order_number}</p>}
                  <p>Оплата: онлайн через Т-Банк.</p>
                  {order.fulfillment_method === "yandex_pickup_point" && <p>Стоимость доставки уточняется.</p>}
                  {order.customer_comment && <p className="whitespace-pre-wrap">{order.customer_comment}</p>}
                </div>

                {awaitingPayment && (
                  retryablePayment ? (
                    <div className="mt-5 space-y-3 rounded-xl bg-red-50 p-4 text-red-900">
                      <p className="font-semibold">Оплата не прошла.</p>
                      <p className="text-sm">Банк отклонил платёж. Средства по этой попытке не списаны. Можно безопасно начать новую попытку оплаты.</p>
                      <button type="button" onClick={() => void retryPayment()} disabled={busy} className="rounded-xl bg-blue-700 px-4 py-2 font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50">
                        {busy ? "Переходим к оплате…" : "Попробовать снова"}
                      </button>
                    </div>
                  ) : (
                    <div className="mt-5 rounded-xl bg-slate-50 p-4">
                      <p className="text-sm text-slate-700">Ожидаем подтверждение оплаты от банка. Обычно это занимает несколько секунд.</p>
                      <button type="button" onClick={() => void reconcilePayment()} disabled={checkingPayment} className="mt-3 rounded-xl bg-blue-700 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-800 disabled:opacity-50">
                        {checkingPayment ? "Проверяем…" : "Проверить статус оплаты"}
                      </button>
                    </div>
                  )
                )}

                {order.status === "paid" && <p className="mt-5 font-semibold text-emerald-700">Оплата подтверждена. Заказ передан оператору в работу.</p>}
                {order.status === "new" && <p className="mt-5 text-sm text-slate-700">Оператор проверит файлы и свяжется с вами для подтверждения.</p>}

                <Link href="/" className="mt-6 inline-block font-semibold text-blue-700 underline">Оформить ещё один заказ</Link>
              </section>
            )}
          </div>

          <aside className="min-w-0 space-y-5 lg:self-start">
            <FreeDeliveryProgress printPrice={order.print_price} />

            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <h2 className="text-lg font-black text-slate-950">Ваш заказ</h2>

              <dl className="mt-4 space-y-2.5 border-b border-slate-100 pb-4 text-sm">
                <div className="flex justify-between gap-4">
                  <dt className="text-slate-600">Печать</dt>
                  <dd className="font-semibold text-slate-900">{order.print_price.toLocaleString("ru-RU")} ₽</dd>
                </div>

                {!pending && order.delivery_price !== null && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-600">Доставка</dt>
                    <dd className={`font-semibold ${order.delivery_price === 0 ? "text-emerald-700" : "text-slate-900"}`}>
                      {formatDeliveryPrice(order.delivery_price)}
                    </dd>
                  </div>
                )}
              </dl>

              <div className="mt-4 flex items-baseline justify-between gap-4">
                <span className="text-lg font-black text-slate-950">Итого:</span>
                <span className="text-3xl font-black text-slate-950">
                  {(pending ? order.print_price : order.total_price).toLocaleString("ru-RU")} ₽
                </span>
              </div>

              {pending && (
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Доставка рассчитывается после выбора способа получения.
                </p>
              )}
            </div>
          </aside>
        </div>
      </div>

      <SiteFooter />
    </main>
  );
}
