"use client";

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

/**
 * Admin-panel theme provider. Mirrors apps/web/src/components/theme-provider.tsx
 * so behavior is identical across the two apps — the goal is "toggle once,
 * it sticks in the browser you're using". We don't share cookies across
 * the web and admin subdomains so the storage key is intentionally
 * admin-scoped.
 */
export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="dark"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
      storageKey="locateflow-admin-theme"
      themes={["light", "dark", "system"]}
    >
      {children}
    </NextThemesProvider>
  );
}

export function useTheme() {
  const { theme, resolvedTheme, setTheme } = useNextTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Until hydration, next-themes can't know the user's system preference.
  // We render dark as a safe default to match the prior hard-coded theme.
  const active = (mounted ? (resolvedTheme as "light" | "dark" | undefined) : undefined) ?? "dark";

  return {
    theme: active,
    preference: (theme as "light" | "dark" | "system" | undefined) ?? "system",
    setTheme,
    toggleTheme: () => setTheme(active === "dark" ? "light" : "dark"),
  };
}
