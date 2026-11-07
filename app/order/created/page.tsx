import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
export default function CreatedPage() {
  return <main className="min-h-screen bg-slate-50"><SiteHeader /><section className="mx-auto max-w-2xl px-5 py-16"><h1 className="text-3xl font-black">Ваш заказ создан</h1><p className="mt-4 text-lg">Менеджер с вами свяжется в рабочие часы: с 10 до 18 по будням.</p><Link href="/" className="mt-6 inline-block text-blue-700 underline">На главную</Link></section><SiteFooter /></main>;
}
