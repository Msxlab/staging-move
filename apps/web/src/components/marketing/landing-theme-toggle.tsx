"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { useTheme } from "next-themes";
import { useTranslations } from "next-intl";

type Option = {
  value: "system" | "light" | "dark";
  label: string;
  icon: LucideIcon;
};

export function LandingThemeToggle({
  variant = "full",
}: {
  variant?: "full" | "compact";
} = {}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const t = useTranslations("theme");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  // framer-motion layout animations are JS-driven and do NOT honor the CSS
  // prefers-reduced-motion @media query on their own — gate the spring explicitly.
  const reduceMotion = useReducedMotion();

  const fullOptions: Option[] = [
    { value: "system", label: t("match_system"), icon: Monitor },
    { value: "light", label: t("light_mode"), icon: Sun },
    { value: "dark", label: t("dark_mode"), icon: Moon },
  ];
  const compactOptions: Option[] = [
    { value: "light", label: t("light_mode"), icon: Sun },
    { value: "dark", label: t("dark_mode"), icon: Moon },
  ];

  const options = variant === "compact" ? compactOptions : fullOptions;

  // For the compact (sun/moon-only) toggle, "system" is not a selectable
  // state, so highlight whatever the system currently resolves to. That
  // way the pill still indicates the user's *effective* mode even when
  // they haven't made an explicit choice yet.
  const active = variant === "compact"
    ? ((mounted ? (resolvedTheme as "light" | "dark" | undefined) : "light") ?? "light")
    : ((mounted ? (theme as "system" | "light" | "dark" | undefined) : "system") ?? "system");

  const layoutId = variant === "compact" ? "landing-theme-pill-compact" : "landing-theme-pill";

  return (
    <div
      role="radiogroup"
      aria-label={t("preference")}
      className="relative inline-flex items-center rounded-full border border-border/60 bg-foreground/[0.04] p-0.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md"
    >
      {options.map(({ value, label, icon: Icon }) => {
        const selected = active === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={label}
            title={label}
            onClick={() => setTheme(value)}
            className="relative inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
          >
            {selected && mounted && (
              <motion.span
                layoutId={layoutId}
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-gradient-to-br from-primary/20 to-transparent ring-1 ring-primary/40 shadow-[0_0_18px_-4px_rgba(127,182,232,0.5)]"
                transition={reduceMotion ? { duration: 0 } : { type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon
              className={`relative z-10 h-3.5 w-3.5 transition-colors ${
                selected ? "text-tone-orange-fg dark:text-tone-orange-fg" : ""
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
