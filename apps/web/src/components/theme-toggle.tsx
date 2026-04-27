"use client";

import { useEffect, useState } from "react";
import { Moon, Sun, Monitor } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "./theme-provider";

/**
 * Cycle-style theme toggle for the web app: system → light → dark → system.
 *
 * The provider default is `system`, so a visitor who never touches the
 * toggle keeps tracking their OS preference. Once they click they opt
 * out into an explicit light or dark choice, and a third click brings
 * them back to `system` — the same three-state pattern GitHub and
 * modern SaaS use. Pre-hydration we render a size-stable placeholder
 * to avoid icon flicker / layout shift.
 */
export function ThemeToggle({
  variant = "inline",
}: {
  variant?: "inline" | "icon";
}) {
  const { preference, setTheme } = useTheme();
  const t = useTranslations("theme");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const nextPreference = (
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

  const icon =
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
      onClick={() => setTheme(nextPreference(preference))}
      aria-label={aria}
      title={aria}
      className={
        variant === "icon"
          ? "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
      }
    >
      {icon}
      {variant === "inline" && <span>{label}</span>}
    </button>
  );
}
