import type { Metadata, Viewport } from "next";
import { Playfair_Display, DM_Sans, DM_Mono } from "next/font/google";
import { headers } from "next/headers";
import { Toaster } from "sonner";
import { NextIntlClientProvider } from "next-intl";
import { getLocale, getMessages } from "next-intl/server";
import { AdminNavigationFallback } from "@/components/admin-navigation-fallback";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

// Move design system — DM Sans drives admin chrome, Playfair Display for
// headings, DM Mono for numerals/meta. Repointed onto the existing
// --font-sans / --font-mono / --font-display CSS vars so every admin page
// flips fonts from this one file.
const dmSans = DM_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-sans",
  weight: ["400", "500", "600", "700"],
  fallback: ["system-ui", "-apple-system", "Segoe UI", "Roboto", "sans-serif"],
});

const dmMono = DM_Mono({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-mono",
  weight: ["400", "500"],
  fallback: ["Geist Mono", "JetBrains Mono", "Consolas", "monospace"],
});

const playfair = Playfair_Display({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-display",
  weight: ["400", "600", "700", "800", "900"],
  style: ["normal", "italic"],
  fallback: ["Didot", "Georgia", "serif"],
});

export const metadata: Metadata = {
  title: "LocateFlow Admin",
  description: "LocateFlow Administration Panel",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    title: "LocateFlow Admin",
    statusBarStyle: "black-translucent",
  },
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
    apple: "/icon-192.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#171E2B",
  colorScheme: "dark light",
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
      className={`${dmSans.variable} ${dmMono.variable} ${playfair.variable}`}
      suppressHydrationWarning
    >
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="LocateFlow Admin" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="format-detection" content="telephone=no" />
      </head>
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
