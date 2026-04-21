"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { useTheme } from "./theme-provider";

/**
 * Sidebar-sized theme toggle for the admin panel. Click flips the
 * preference between light and dark; system preference is opted into
 * via the settings page (not this quick toggle).
 */
export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  // Pre-hydration placeholder avoids icon flicker/layout shift.
  if (!mounted) {
    return (
      <button
        aria-label="Toggle theme"
        className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground"
      >
        <Sun className="h-4 w-4" />
        <span>Theme</span>
      </button>
    );
  }

  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
      <span>{isDark ? "Light mode" : "Dark mode"}</span>
    </button>
  );
}
