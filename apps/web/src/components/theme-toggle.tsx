"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "./theme-provider";

/**
 * Theme toggle. The compact icon variant flips between light and dark
 * (sun/moon only) to match the headers' tighter chrome. The inline
 * variant — used inside dropdown menus — keeps the original three-state
 * cycle (system → light → dark) so users can still opt back into
 * tracking their OS preference from the menu.
 */
export function ThemeToggle({
  variant = "inline",
}: {
  variant?: "inline" | "icon";
}) {
  const { preference, theme: resolved, setTheme } = useTheme();
  const t = useTranslations("theme");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nextInlinePreference = (
    current: "light" | "dark" | "system" | undefined,
  ): "light" | "dark" | "system" => {
    if (current === "system") return "light";
    if (current === "light") return "dark";
    return "system";
  };

  if (!mounted) {
    // Placeholder with the same bounding box so hydration doesn't jump.
    return (
      <button
        type="button"
        aria-label={t("toggle")}
        className={
          variant === "icon"
            ? "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground"
            : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground"
        }
      >
        <Sun className="h-4 w-4" />
        {variant === "inline" && <span>{t("toggle")}</span>}
      </button>
    );
  }

  if (variant === "icon") {
    // Two-state sun/moon flip, anchored to the *resolved* theme so a user
    // on `system` still sees the current effective mode without showing
    // the monitor glyph in the header.
    const isDark = resolved === "dark";
    const icon = isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />;
    const aria = isDark ? t("dark_full") : t("light_full");
    return (
      <button
        type="button"
        onClick={() => setTheme(isDark ? "light" : "dark")}
        aria-label={aria}
        title={aria}
        className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      >
        {icon}
      </button>
    );
  }

  const inlineIcon =
    preference === "system" ? (
      <Monitor className="h-4 w-4" />
    ) : preference === "light" ? (
      <Sun className="h-4 w-4" />
    ) : (
      <Moon className="h-4 w-4" />
    );

  const label =
    preference === "system"
      ? t("system")
      : preference === "light"
      ? t("light")
      : t("dark");

  const aria =
    preference === "system"
      ? t("system_full")
      : preference === "light"
      ? t("light_full")
      : t("dark_full");

  return (
    <button
      type="button"
      onClick={() => setTheme(nextInlinePreference(preference))}
      aria-label={aria}
      title={aria}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {inlineIcon}
      <span>{label}</span>
    </button>
  );
}
