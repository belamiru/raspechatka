import { CookieConsent } from "@/components/cookie-consent";
import { LocalBusinessStructuredData } from "@/components/structured-data";
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const siteUrl = "https://xn--80aaas0a1afjm2c.xn--e1afffngyp.xn--p1ai";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin", "cyrillic"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin", "cyrillic"],
});

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),

  title: {
    default: "Распечатка документов в Воронеже — онлайн-заказ",
    template: "%s | Распечатка",
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
    siteName: "Распечатка",
    title: "Распечатка документов в Воронеже — онлайн-заказ",
    description:
      "Загрузите документ, выберите параметры печати и оформите заказ онлайн.",
  },

  twitter: {
    card: "summary",
    title: "Распечатка документов в Воронеже",
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
    <html
      lang="ru"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
     <body className="flex min-h-full flex-col">
        <LocalBusinessStructuredData />
        {children}
        <CookieConsent />
      </body>
    </html>
  );
}