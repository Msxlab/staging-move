"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

/**
 * Sidebar-sized theme toggle for the admin panel. Click flips the
 * preference between light and dark; system preference is opted into
 * via the settings page (not this quick toggle).
 */
export function ThemeToggle({ compact = false }: { compact?: boolean }) {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Icon-only square (footer toolbar) vs labeled full-width row.
  const compactCls =
    "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";
  const fullCls =
    "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground";

  // Pre-hydration placeholder avoids icon flicker/layout shift.
  if (!mounted) {
    return (
      <button aria-label="Toggle theme" className={compact ? compactCls : fullCls}>
        <Sun className="h-4 w-4" />
        {!compact && <span>Theme</span>}
      </button>
    );
  }

  const isDark = theme === "dark";
  const label = isDark ? "Switch to light mode" : "Switch to dark mode";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={label}
      title={compact ? label : undefined}
      className={compact ? compactCls : fullCls}
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      {!compact && <span>{isDark ? "Light mode" : "Dark mode"}</span>}
    </button>
  );
}
