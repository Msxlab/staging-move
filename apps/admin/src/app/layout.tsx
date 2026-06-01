import type { Metadata } from "next";
import { Geist, Geist_Mono, Fraunces } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AdminNavigationFallback } from "@/components/admin-navigation-fallback";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Edition VI · Geist drives admin chrome, Fraunces is reserved for h1/h2/h3.
const geistSans = Geist({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

const geistMono = Geist_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  fallback: ["JetBrains Mono", "Consolas", "monospace"],
});

// Fraunces variable font — `weight` omitted because `axes` is set
// (Next.js requires one or the other, not both).
const fraunces = Fraunces({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  axes: ["opsz", "SOFT"],
  style: ["normal", "italic"],
  fallback: ["Didot", "Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "LocateFlow Admin",
  description: "LocateFlow Administration Panel",
  robots: {
    index: false,
    follow: false,
    googleBot: {
      index: false,
      follow: false,
    },
  },
  icons: {
    icon: "/icon.svg",
    shortcut: "/icon.svg",
  },
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const nonce = (await headers()).get("x-nonce") ?? undefined;

  return (
    <html
      lang={locale}
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable}`}
      suppressHydrationWarning
    >
      <body className="min-h-screen bg-background font-sans">
        <NextIntlClientProvider locale={locale} messages={messages}>
          <ThemeProvider nonce={nonce}>
            <AdminNavigationFallback />
            {children}
            <Toaster position="top-right" richColors />
          </ThemeProvider>
        </NextIntlClientProvider>
        <script src="/register-sw.js" defer nonce={nonce} suppressHydrationWarning />
      </body>
    </html>
  );
}
