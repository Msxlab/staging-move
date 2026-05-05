"use client";

import { useEffect, useState } from "react";
import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useTheme } from "next-themes";

type Option = {
  value: "system" | "light" | "dark";
  label: string;
  icon: LucideIcon;
};

const FULL_OPTIONS: Option[] = [
  { value: "system", label: "Match system", icon: Monitor },
  { value: "light", label: "Light mode", icon: Sun },
  { value: "dark", label: "Dark mode", icon: Moon },
];

const COMPACT_OPTIONS: Option[] = [
  { value: "light", label: "Light mode", icon: Sun },
  { value: "dark", label: "Dark mode", icon: Moon },
];

export function LandingThemeToggle({
  variant = "full",
}: {
  variant?: "full" | "compact";
} = {}) {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const options = variant === "compact" ? COMPACT_OPTIONS : FULL_OPTIONS;

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
      aria-label="Theme preference"
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
            className="relative inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500/60"
          >
            {selected && mounted && (
              <motion.span
                layoutId={layoutId}
                aria-hidden="true"
                className="absolute inset-0 rounded-full bg-gradient-to-br from-orange-500/20 to-amber-500/10 ring-1 ring-orange-500/40 shadow-[0_0_18px_-4px_rgba(212,132,106,0.5)]"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
              />
            )}
            <Icon
              className={`relative z-10 h-3.5 w-3.5 transition-colors ${
                selected ? "text-orange-500 dark:text-orange-300" : ""
              }`}
            />
          </button>
        );
      })}
    </div>
  );
}
