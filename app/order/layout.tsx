import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Настройка и оформление заказа",
  description: "Параметры печати, контактные данные и способ получения заказа.",
  robots: { index: false, follow: false },
};

export default function OrderLayout({ children }: { children: React.ReactNode }) {
  return children;
}
