import { SITE_URL, SITE_NAME } from "@/lib/site";
import { CookieConsent } from "@/components/cookie-consent";
import { LocalBusinessStructuredData } from "@/components/structured-data";
import type { Metadata } from "next";
import "./globals.css";

const siteUrl = SITE_URL;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Печать документов, фото и плакатов в Воронеже — онлайн-заказ",
    template: `%s | ${SITE_NAME}`,
  },

  description:
    "Онлайн-заказ чёрно-белой печати документов A4 и A3 в Воронеже. Загрузите PDF, JPG или PNG, выберите параметры и оформите заказ с самовывозом.",

  alternates: {
    canonical: "/",
  },

  openGraph: {
    type: "website",
    locale: "ru_RU",
    url: "/",
    siteName: SITE_NAME,
    title: "Печать документов, фото и плакатов в Воронеже — онлайн-заказ",
    description:
      "Загрузите документ, выберите параметры печати и оформите заказ онлайн.",
  },

  twitter: {
    card: "summary",
    title: "Печать документов, фото и плакатов в Воронеже",
    description:
      "Онлайн-заказ чёрно-белой печати документов A4 и A3 в Воронеже.",
  },

  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
    verification: {
    yandex: "2120bc28c6cc59ef",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru" className="h-full antialiased">
     <body className="flex min-h-full flex-col font-sans">
        <LocalBusinessStructuredData />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}