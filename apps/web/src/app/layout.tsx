import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono, Fraunces, Playfair_Display, DM_Sans, DM_Mono } from "next/font/google";
import { headers } from "next/headers";
import type { ReactNode } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import "@/styles/globals.css";
import "@/styles/aurora.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { SessionTracker } from "@/components/tracking/session-tracker";
import CookieConsent from "@/components/shared/cookie-consent";
import { SiteSchemas } from "@/components/seo/site-schemas";
import { GoogleAnalytics } from "@/components/tracking/google-analytics";
import {
  DEFAULT_OG_IMAGE,
  SITE_DESCRIPTION,
  SITE_NAME,
  SITE_TITLE,
  absoluteUrl,
  getCanonicalSiteUrl,
  getGoogleSiteVerification,
  isNoIndexEnvironment,
} from "@/lib/seo";

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

// Move design system — Playfair Display (display/serif), DM Sans (UI),
// DM Mono (numerals/meta). Repointed via --font-display/sans/mono in
// globals.css. Fraunces/Geist stay loaded for any not-yet-migrated refs.
const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-playfair",
  weight: ["400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  fallback: ["Didot", "Georgia", "serif"],
});

const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-sans",
  weight: ["400", "500", "600", "700"],
  fallback: ["Inter", "system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-dm-mono",
  weight: ["400", "500"],
  fallback: ["Geist Mono", "JetBrains Mono", "Consolas", "monospace"],
});

const SITE_URL = getCanonicalSiteUrl();
const BLOCK_INDEXING = isNoIndexEnvironment(SITE_URL);
const GOOGLE_SITE_VERIFICATION = getGoogleSiteVerification();

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: SITE_TITLE,
    template: `%s | ${SITE_NAME}`,
  },
  description: SITE_DESCRIPTION,
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
  applicationName: SITE_NAME,
  authors: [{ name: SITE_NAME }],
  verification: GOOGLE_SITE_VERIFICATION
    ? { google: GOOGLE_SITE_VERIFICATION }
    : undefined,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: absoluteUrl("/"),
    siteName: SITE_NAME,
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [
      { url: absoluteUrl(DEFAULT_OG_IMAGE), width: 1200, height: 630, alt: SITE_NAME },
    ],
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: SITE_TITLE,
    description: SITE_DESCRIPTION,
    images: [absoluteUrl(DEFAULT_OG_IMAGE)],
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

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
  // Per-request CSP nonce stamped by middleware. Any external script we
  // emit ourselves (the register-sw bootstrap below) needs this nonce
  // because the production CSP uses 'strict-dynamic' — the source list
  // is ignored for non-nonced scripts. JSON-LD scripts read the same
  // request nonce in their component and stamp it on each ld+json tag.
  const requestHeaders = await headers();
  const nonce = requestHeaders.get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} ${playfair.variable} ${dmSans.variable} ${dmMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#0A0F18" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LocateFlow" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="icon" type="image/svg+xml" href="/favicon.svg" sizes="any" />
        {/*
         * 16/32px tab icon — simplified face-only mascot. The full mascot
         * (favicon.svg) reads as a dark blob at 16px, so size-scoring
         * browsers get this variant for small slots; declared last so
         * last-wins browsers also prefer it in tabs. Larger contexts keep
         * favicon.svg (sizes="any") plus the PNG apple-touch/manifest icons.
         */}
        <link rel="icon" type="image/svg+xml" href="/favicon-small.svg" sizes="16x16 32x32" />
        <link rel="mask-icon" href="/logo-mark.svg" color="#7FB6E8" />
        {/*
         * iOS Safari smart app banner. Shows a system-rendered "OPEN / VIEW
         * IN APP STORE" strip above the page on iPhone/iPad. Becomes a no-op
         * when the env var is unset (closed beta — our custom install-prompt
         * banner picks up the slack via the waitlist fallback).
         */}
        {process.env.NEXT_PUBLIC_IOS_APP_STORE_ID ? (
          <meta
            name="apple-itunes-app"
            content={`app-id=${process.env.NEXT_PUBLIC_IOS_APP_STORE_ID}`}
          />
        ) : null}
        {!BLOCK_INDEXING ? <SiteSchemas /> : null}
      </head>
      <body className={`${dmSans.className} lf-aurora`}>
        {/*
         * Embed-mode detection — runs before paint to avoid a flash of the
         * full marketing/app chrome before it's hidden. The mobile in-app
         * browser opens locateflow.com URLs with `?embed=mobile`; we latch
         * that into sessionStorage so subsequent navigation inside the
         * in-app browser stays chromeless. The CSS in globals.css then
         * hides `data-embed-hide` ancestors (marketing header/footer, etc).
         */}
        <script
          nonce={nonce}
          suppressHydrationWarning
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var q=new URLSearchParams(location.search);var hit=q.get('embed')==='mobile'||sessionStorage.getItem('lf:embed-mobile')==='1';if(q.get('embed')==='mobile'){sessionStorage.setItem('lf:embed-mobile','1');}if(hit){document.documentElement.setAttribute('data-embed','mobile');}}catch(e){}})();`,
          }}
        />
        <NextIntlClientProvider locale={locale} messages={messages}>
          <QueryProvider>
            <ThemeProvider nonce={nonce}>
              <SessionTracker />
              <GoogleAnalytics nonce={nonce} />
              {children}
              <Toaster position="top-right" richColors />
              <CookieConsent analyticsNonce={nonce} />
            </ThemeProvider>
          </QueryProvider>
        </NextIntlClientProvider>
        <script src="/register-sw.js" defer nonce={nonce} suppressHydrationWarning />
      </body>
    </html>
  );
}
