import type { Metadata } from "next";
import { Inter } from "next/font/google";
import type { ReactNode } from "react";
import "@/styles/globals.css";
import { Toaster } from "sonner";
import { ThemeProvider } from "@/components/theme-provider";
import { QueryProvider } from "@/components/query-provider";
import { SessionTracker } from "@/components/tracking/session-tracker";
import CookieConsent from "@/components/shared/cookie-consent";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  fallback: ["system-ui", "Arial", "sans-serif"],
});

const SITE_URL = process.env.NEXT_PUBLIC_APP_URL || "https://locateflow.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "LocateFlow — Address & Moving Management",
    template: "%s · LocateFlow",
  },
  description:
    "Manage your addresses, services, and relocations in one place. Track providers, plan moves, and stay organized.",
  keywords: [
    "moving",
    "address management",
    "relocation",
    "utility providers",
    "moving checklist",
    "services",
  ],
  applicationName: "LocateFlow",
  authors: [{ name: "LocateFlow" }],
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "LocateFlow",
    title: "LocateFlow — Address & Moving Management",
    description:
      "Manage your addresses, services, and relocations in one place.",
    locale: "en_US",
  },
  twitter: {
    card: "summary_large_image",
    title: "LocateFlow — Address & Moving Management",
    description:
      "Manage your addresses, services, and relocations in one place.",
  },
  robots: {
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

export default function RootLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7c3aed" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="LocateFlow" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
      </head>
      <body className={inter.className}>
        <QueryProvider>
          <ThemeProvider>
            <SessionTracker />
            {children}
            <Toaster position="top-right" richColors />
            <CookieConsent />
          </ThemeProvider>
        </QueryProvider>
        <script src="/register-sw.js" defer />
      </body>
    </html>
  );
}
