import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { SessionTracker } from "@/components/tracking/session-tracker";
import CookieConsent from "@/components/shared/cookie-consent";

// Edition VI · Geist for UI, Fraunces variable for display, Geist Mono for meta.
// `display: "swap"` so the umber canvas paints immediately and Fraunces
// joins when ready — the brand survives a missed font, but the canvas can't.
const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-sans",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-geist-mono",
  fallback: ["JetBrains Mono", "Consolas", "monospace"],
});

// Fraunces is a variable font — passing `axes` enables the opsz + SOFT
// axes Next.js otherwise strips. `weight` must be omitted (or set to
// "variable") when `axes` is present; setting both throws at build time.
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-fraunces",
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
  fallback: ["Didot", "Georgia", "serif"],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://locateflow.app";
const APP_ENV = (process.env.APP_ENV || "").toLowerCase();
const BLOCK_INDEXING =
  APP_ENV === "staging" ||
  APP_ENV === "preview" ||
  /(?:staging|preview|ondigitalocean\.app|vercel\.app)/i.test(SITE_URL);

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LocateFlow — Every provider tied to your address, in one place",
    template: "%s · LocateFlow",
  },
  description:
    "Track every utility, bank, insurance, and subscription tied to each of your homes. Smart reminders, document OCR, and a one-click moving checklist when you relocate.",
  keywords: [
    "address management",
    "service provider tracker",
    "utility tracking",
    "subscription tracker",
    "bill reminders",
    "moving checklist",
    "household services",
    "relocation",
  ],
  applicationName: "LocateFlow",
  authors: [{ name: "LocateFlow" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "LocateFlow",
    title: "LocateFlow — Every provider tied to your address, in one place",
    description:
      "Track every utility, bank, insurance, and subscription tied to each of your homes. One dashboard. Smart reminders. Never lose track again.",
    images: [
      { url: "/og-image.svg", width: 1200, height: 630, alt: "LocateFlow" },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LocateFlow — Every provider tied to your address, in one place",
    description:
      "Track every utility, bank, insurance, and subscription tied to each of your homes.",
    images: ["/og-image.svg"],
  },
  robots: BLOCK_INDEXING
    ? {
        index: false,
        follow: false,
        googleBot: {
          index: false,
          follow: false,
        },
      }
    : {
        index: true,
        follow: true,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large",
          "max-snippet": -1,
        },
      },
};

export default async function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  // next-intl reads the locale from the cookie / Accept-Language in
  // `src/i18n/request.ts`. The `<html lang>` attr mirrors it so
  // screen readers and Google's language detection agree with the UI.
  const locale = await getLocale();
  const messages = await getMessages();

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0E0A07" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LocateFlow" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
        <link rel="alternate icon" href="/favicon.svg" />
        <link rel="mask-icon" href="/logo-mark.svg" color="#D4846A" />
      </head>
      <body className={geistSans.className}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <ThemeProvider>
              <SessionTracker />
              {children}
              <Toaster position="top-right" richColors />
              <CookieConsent />
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
        <script src="/register-sw.js" defer />
      </body>
    </html>
  );
}
