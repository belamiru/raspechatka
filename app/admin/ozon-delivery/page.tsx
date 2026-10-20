import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { OzonDeliveryConnectionCheck } from "@/components/ozon-delivery-connection-check";
import { OzonShipmentMethodSettings } from "@/components/ozon-shipment-method-settings";
import { OzonPointsCatalogPanel } from "@/components/ozon-points-catalog-panel";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getOzonDeliveryConfiguration } from "@/lib/ozon-delivery";
import { getOzonShipmentMethod } from "@/lib/ozon-shipment-method";

export const dynamic = "force-dynamic";

export default async function OzonDeliveryAdminPage() {
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) redirect("/admin/login");
  const configuration = getOzonDeliveryConfiguration();
  const shipmentMethod = await getOzonShipmentMethod();

  return <main className="mx-auto max-w-2xl p-6">
    <Link href="/admin" className="text-sm text-blue-700 underline">← К заказам</Link>
    <h1 className="mt-5 text-2xl font-bold">Ozon Доставка</h1>
    <section className="mt-5 rounded-xl border border-slate-200 p-5">
      <p>Авторизация: <strong>server-to-server (client credentials)</strong></p>
      <p className="mt-2 text-sm text-slate-600">
        Для этого приложения не нужны redirect URL, OAuth callback или ручное подключение через браузер. Токен запрашивается только сервером и не сохраняется в браузере.
      </p>
      <p className="mt-3 text-sm text-slate-600">
        Переменные: <code>OZON_DELIVERY_CLIENT_ID</code>, <code>OZON_DELIVERY_CLIENT_SECRET</code>.
      </p>
    </section>
    <OzonDeliveryConnectionCheck configured={configuration.configured} />
    <OzonShipmentMethodSettings initialMethod={shipmentMethod} />
    <OzonPointsCatalogPanel />
    <p className="mt-5 text-sm">
      <Link href="/admin/ozon-delivery/diagnostics" className="font-semibold text-blue-700 underline">
        Диагностика: заказы в Ozon и журнал ошибок →
      </Link>
    </p>
    <section className="mt-5 rounded-xl border border-slate-200 p-5 text-sm text-slate-600">
      <h2 className="text-lg font-bold text-slate-900">Следующий шаг</h2>
      <p className="mt-2">После успешной проверки добавим выбор пункта отгрузки, пункта возвратов и создание постоянного метода <code>dropoff</code>. Затем Ozon появится у покупателя как вариант доставки в ПВЗ.</p>
    </section>
  </main>;
}
