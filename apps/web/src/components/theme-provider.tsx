"use client";

import { ThemeProvider as NextThemesProvider, useTheme as useNextTheme } from "next-themes";
import { useEffect, useState, type ReactNode } from "react";

export function ThemeProvider({ children, nonce }: { children: ReactNode; nonce?: string }) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme="system"
      enableSystem
      disableTransitionOnChange
      nonce={nonce}
      storageKey="locateflow-theme"
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

  const active = (mounted ? (resolvedTheme as "light" | "dark" | undefined) : undefined) ?? "dark";

  return {
    theme: active,
    preference: (theme as "light" | "dark" | "system" | undefined) ?? "system",
    setTheme,
    toggleTheme: () => setTheme(active === "dark" ? "light" : "dark"),
  };
}
