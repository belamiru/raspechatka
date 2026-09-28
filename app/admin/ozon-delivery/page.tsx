import { cookies } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getAdminCookieName, isAdminSession } from "@/lib/auth";
import { getOzonConnectionStatus, getOzonRedirectUri } from "@/lib/ozon-oauth";

export const dynamic = "force-dynamic";

export default async function OzonDeliveryAdminPage({ searchParams }: { searchParams: Promise<{ error?: string; connected?: string }> }) {
  const cookieStore = await cookies();
  if (!await isAdminSession(cookieStore.get(getAdminCookieName())?.value)) redirect("/admin/login");
  const params = await searchParams;
  const connection = await getOzonConnectionStatus();
  let redirectUri: string | null = null;
  let configurationError: string | null = null;
  try {
    redirectUri = getOzonRedirectUri();
  } catch (error) {
    configurationError = error instanceof Error ? error.message : "Не удалось определить адрес возврата Ozon.";
  }
  return <main className="mx-auto max-w-2xl p-6"><Link href="/admin" className="text-sm text-blue-700 underline">← К заказам</Link>
    <h1 className="mt-5 text-2xl font-bold">Ozon Доставка</h1>
    {params.error && <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{params.error}</p>}
    {params.connected === "1" && <p className="mt-4 rounded-xl bg-green-50 p-4 text-green-800">Ozon Доставка успешно подключена.</p>}
    <section className="mt-5 rounded-xl border border-slate-200 p-5"><p>Статус: <strong>{connection.connected ? "подключено" : "не подключено"}</strong></p>
      {connection.updatedAt && <p className="mt-2 text-sm text-slate-600">Токены сохранены: {new Date(connection.updatedAt).toLocaleString("ru-RU")}</p>}
      {redirectUri && <div className="mt-4 text-sm text-slate-600">
        <p>Укажите этот полный адрес в поле Redirect URL приложения Ozon:</p>
        <code className="mt-2 block break-all rounded-lg bg-slate-50 p-3 text-slate-900">{redirectUri}</code>
        <p className="mt-2">Адрес должен совпадать целиком, включая домен и путь.</p>
      </div>}
      {configurationError && <p className="mt-4 rounded-xl bg-red-50 p-4 text-red-800">{configurationError}</p>}
      <p className="mt-4 text-sm text-slate-600">Подключение откроет Ozon для однократного подтверждения доступа. Секреты и токены не передаются в браузер.</p>
      {redirectUri && <a href="/api/admin/ozon-delivery/connect" className="mt-4 inline-block rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white">{connection.connected ? "Подключить заново" : "Подключить Ozon Доставку"}</a>}
    </section></main>;
}
