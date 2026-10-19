import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { ensureOrderCheckoutSchema } from "@/lib/order-checkout";
import { getOzonDeliveryConfiguration } from "@/lib/ozon-delivery";
import { getOzonShipmentMethod } from "@/lib/ozon-shipment-method";
import { OzonApproveButton } from "@/components/ozon-approve-button";

export const dynamic = "force-dynamic";

type OzonOrderRow = {
  id: string;
  order_number: string;
  customer_name: string | null;
  status: string;
  payment_status: string | null;
  ozon_delivery_status: string | null;
  ozon_order_number: string | null;
  ozon_posting_number: string | null;
  ozon_delivery_error: string | null;
  ozon_cutoff_at: Date | null;
  ozon_delivery_created_at: Date | null;
  ozon_delivery_approved_at: Date | null;
  pickup_point_id: string | null;
  pickup_point_address: string | null;
  delivery_price: number | null;
  ozon_delivery_price: number | null;
  created_at: Date;
};

type ErrorLogRow = {
  created_at: Date;
  scope: string;
  error_message: string;
  request_id: string;
};

/**
 * Каждый статус однозначно говорит, что делать дальше. Без этой расшифровки
 * строка вида «created / NULL» ничего не объясняет тому, кто смотрит впервые.
 */
const STATUS_MEANING: Record<string, string> = {
  created: "Заказ создан в Ozon, но не подтверждён к отгрузке. Нужен /v1/posting/approve — он ещё не реализован.",
  creating: "Создание началось и не завершилось: процесс упал или таймаут. Заказ мог создаться в Ozon — проверить перед повтором.",
  failed: "Ozon отклонил создание. Причина в столбце «Ошибка».",
  approved: "Подтверждён к отгрузке: отправление принято в логистику Ozon. Следующий шаг — этикетка.",
  approving: "Подтверждение выполняется прямо сейчас.",
  approve_failed: "Ozon не подтвердил отправление. Причина в столбце «Ошибка», повтор — кнопкой ниже.",
  approve_expired: "Срок отгрузки истёк до подтверждения. Заказ нужно переоформить или подтвердить в кабинете Ozon.",
};

function formatDate(value: Date | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
}

function statusTone(status: string | null) {
  if (status === "created" || status === "approved") return "bg-green-50 text-green-800 border-green-200";
  if (status === "approve_expired") return "bg-amber-50 text-amber-800 border-amber-200";
  if (status === "failed") return "bg-red-50 text-red-800 border-red-200";
  if (status === "creating") return "bg-amber-50 text-amber-800 border-amber-200";
  return "bg-slate-50 text-slate-700 border-slate-200";
}

async function loadErrorLog(): Promise<{ rows: ErrorLogRow[]; error: string }> {
  try {
    const result = await getDb().query<ErrorLogRow>(`
      SELECT created_at, scope, error_message, request_id
      FROM app_error_logs
      WHERE scope ILIKE '%ozon%'
      ORDER BY created_at DESC
      LIMIT 30
    `);
    return { rows: result.rows, error: "" };
  } catch (cause) {
    // Журнал может отсутствовать, если ensureSecuritySchema ещё не выполнялась.
    return {
      rows: [],
      error: cause instanceof Error ? cause.message : "Не удалось прочитать журнал ошибок.",
    };
  }
}

export default async function OzonDiagnosticsPage() {
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) redirect("/admin/login");

  await ensureOrderCheckoutSchema();

  const orders = await getDb().query<OzonOrderRow>(`
    SELECT id, order_number, customer_name, status, payment_status,
           ozon_delivery_status, ozon_order_number, ozon_posting_number,
           ozon_delivery_error, ozon_cutoff_at, ozon_delivery_created_at, ozon_delivery_approved_at,
           pickup_point_id, pickup_point_address,
           delivery_price, ozon_delivery_price, created_at
    FROM orders
    WHERE fulfillment_method = 'ozon_pickup_point'
    ORDER BY created_at DESC
    LIMIT 20
  `);

  const { rows: errorLog, error: errorLogFailure } = await loadErrorLog();
  const configuration = getOzonDeliveryConfiguration();
  const shipmentMethod = await getOzonShipmentMethod();

  // Ключ сводки — реальное значение колонки (null остаётся null), чтобы тон
  // бейджа считался по тому же значению, что и в карточке заказа.
  const counts = new Map<string | null, number>();
  for (const order of orders.rows) {
    counts.set(order.ozon_delivery_status, (counts.get(order.ozon_delivery_status) ?? 0) + 1);
  }
  const summaryLabel = (status: string | null) => status ?? "NULL — создание не запускалось";

  return <main className="mx-auto max-w-5xl p-6">
    <Link href="/admin/ozon-delivery" className="text-sm text-blue-700 underline">← Ozon Доставка</Link>
    <h1 className="mt-5 text-2xl font-bold">Диагностика Ozon Доставки</h1>
    <p className="mt-2 text-sm text-slate-600">
      Последние 20 заказов с доставкой в ПВЗ Ozon и журнал ошибок интеграции.
    </p>

    <section className="mt-6 rounded-xl border border-slate-200 p-5">
      <h2 className="text-lg font-bold">Состояние интеграции</h2>
      <ul className="mt-3 space-y-1 text-sm">
        <li>Ключи Ozon: <strong>{configuration.configured ? "заданы" : "НЕ ЗАДАНЫ"}</strong></li>
        <li>Метод доставки: <strong>{shipmentMethod ? `${shipmentMethod.id} (${shipmentMethod.status})` : "не создан"}</strong></li>
        <li>Заказов в ПВЗ Ozon в базе: <strong>{orders.rows.length}</strong></li>
      </ul>
      {!shipmentMethod && <p className="mt-3 text-sm text-red-700">
        Без метода доставки создание заказа в Ozon работать не будет.
      </p>}
      {shipmentMethod && !/active/i.test(shipmentMethod.status) && <p className="mt-3 text-sm text-red-700">
        Метод доставки не активен (статус: {shipmentMethod.status}). Обновите статус на странице Ozon Доставки.
      </p>}
    </section>

    {counts.size > 0 && <section className="mt-6 rounded-xl border border-slate-200 p-5">
      <h2 className="text-lg font-bold">Сводка по статусам</h2>
      <ul className="mt-3 space-y-2 text-sm">
        {[...counts].map(([status, count]) => <li key={status ?? "null"}>
          <span className={`rounded-lg border px-2 py-0.5 font-mono text-xs ${statusTone(status)}`}>
            {summaryLabel(status)}
          </span>
          <span className="ml-2">{count} шт.</span>
          {status && STATUS_MEANING[status] && <p className="mt-1 text-slate-600">{STATUS_MEANING[status]}</p>}
          {!status && <p className="mt-1 text-slate-600">
            Оплата не дошла до вызова создания заказа: webhook не сработал или заказ ещё не оплачен.
          </p>}
        </li>)}
      </ul>
    </section>}

    <section className="mt-6">
      <h2 className="text-lg font-bold">Заказы</h2>
      {orders.rows.length === 0
        ? <p className="mt-3 text-sm text-slate-600">
            Заказов с доставкой в ПВЗ Ozon нет. Оформите тестовый заказ — он появится здесь.
          </p>
        : <div className="mt-3 space-y-3">
            {orders.rows.map((order) => <article key={order.id} className="rounded-xl border border-slate-200 p-4 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <strong>{order.order_number}</strong>
                <span className={`rounded-lg border px-2 py-0.5 font-mono text-xs ${statusTone(order.ozon_delivery_status)}`}>
                  {order.ozon_delivery_status ?? "NULL"}
                </span>
                <span className="text-slate-500">заказ: {order.status}</span>
                {order.payment_status && <span className="text-slate-500">оплата: {order.payment_status}</span>}
                <span className="text-slate-500">{formatDate(order.created_at)}</span>
              </div>

              <dl className="mt-3 grid gap-x-6 gap-y-1 sm:grid-cols-2">
                <div><dt className="inline text-slate-500">Номер в Ozon: </dt><dd className="inline font-mono">{order.ozon_order_number ?? "—"}</dd></div>
                <div><dt className="inline text-slate-500">Отправление: </dt><dd className="inline font-mono">{order.ozon_posting_number ?? "—"}</dd></div>
                <div><dt className="inline text-slate-500">Создан в Ozon: </dt><dd className="inline">{formatDate(order.ozon_delivery_created_at)}</dd></div>
                <div><dt className="inline text-slate-500">Отгрузить до: </dt><dd className="inline">{formatDate(order.ozon_cutoff_at)}</dd></div>
                <div><dt className="inline text-slate-500">Подтверждён: </dt><dd className="inline">{formatDate(order.ozon_delivery_approved_at)}</dd></div>
                <div><dt className="inline text-slate-500">ПВЗ: </dt><dd className="inline font-mono">{order.pickup_point_id ?? "—"}</dd></div>
                <div><dt className="inline text-slate-500">Доставка оплачена: </dt><dd className="inline">{order.delivery_price ?? "—"} ₽</dd></div>
                <div className="sm:col-span-2"><dt className="inline text-slate-500">Адрес: </dt><dd className="inline">{order.pickup_point_address ?? "—"}</dd></div>
              </dl>

              {order.ozon_delivery_error && <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3">
                <p className="font-semibold text-red-800">Ошибка Ozon</p>
                <p className="mt-1 whitespace-pre-wrap break-words text-red-800">{order.ozon_delivery_error}</p>
              </div>}

              <OzonApproveButton orderId={order.id} status={order.ozon_delivery_status} />
            </article>)}
          </div>}
    </section>

    <section className="mt-8">
      <h2 className="text-lg font-bold">Журнал ошибок Ozon</h2>
      {errorLogFailure
        ? <p className="mt-3 text-sm text-slate-600">Журнал недоступен: {errorLogFailure}</p>
        : errorLog.length === 0
          ? <p className="mt-3 text-sm text-slate-600">Записей нет.</p>
          : <ul className="mt-3 space-y-2 text-sm">
              {errorLog.map((entry) => <li key={`${entry.request_id}-${entry.created_at.toString()}`} className="rounded-xl border border-slate-200 p-3">
                <div className="flex flex-wrap gap-3 text-slate-500">
                  <span>{formatDate(entry.created_at)}</span>
                  <span className="font-mono">{entry.scope}</span>
                </div>
                <p className="mt-1 whitespace-pre-wrap break-words text-red-800">{entry.error_message}</p>
              </li>)}
            </ul>}
    </section>
  </main>;
}
