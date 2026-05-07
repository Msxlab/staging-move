"use client";

import { useLocale, useTranslations } from "next-intl";
import { useEffect, useRef, useState, useTransition } from "react";
import { Check, ChevronDown, Globe } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { locales, localeNames, type Locale } from "@/i18n/config";

/**
 * Language selector dropdown.
 *
 * Clicking a language:
 *   1. POSTs to `/api/user/locale` â€” this refreshes the `NEXT_LOCALE`
 *      cookie and, if the caller is logged in, mirrors the choice to
 *      `User.preferredLocale` so it persists across devices.
 *   2. Reloads the page so server components re-render with the new
 *      locale. A soft `router.refresh()` is not enough because the
 *      `getRequestConfig()` runs during render and is cached by Next.
 */
export function LanguageSelector({
  variant = "inline",
}: {
  variant?: "inline" | "icon";
}) {
  const currentLocale = useLocale() as Locale;
  const t = useTranslations("language");
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    }
    window.addEventListener("keydown", onKey);
    window.addEventListener("mousedown", onClick);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const handleChange = (next: Locale) => {
    if (next === currentLocale) {
      setOpen(false);
      return;
    }
    startTransition(async () => {
      await fetch("/api/user/locale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ locale: next }),
      }).catch(() => null);
      // Hard reload â€” next-intl's getRequestConfig reads the cookie at
      // request time, and server-rendered bits are cached.
      window.location.reload();
    });
  };

  const triggerClass =
    variant === "icon"
      ? "group inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-foreground/[0.04] px-2.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-md transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 disabled:opacity-60"
      : "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60";

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        aria-label={`${t("label")}: ${localeNames[currentLocale]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={triggerClass}
      >
        <Globe
          className={
            variant === "icon"
              ? "h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-tone-orange-fg dark:group-hover:text-tone-orange-fg"
              : "h-4 w-4"
          }
          aria-hidden="true"
        />
        <span>{currentLocale}</span>
        {variant === "icon" && (
          <ChevronDown
            className={`h-3 w-3 opacity-60 transition-transform duration-200 ${
              open ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label={t("select")}
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 top-full z-50 mt-2 min-w-[200px] origin-top-right overflow-hidden rounded-2xl border border-border/60 bg-popover/95 p-1 shadow-2xl backdrop-blur-xl"
          >
            {locales.map((loc) => {
              const selected = loc === currentLocale;
              return (
                <li key={loc}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => handleChange(loc)}
                    className={`group flex w-full items-center justify-between gap-3 rounded-xl px-2.5 py-2 text-left transition-colors ${
                      selected
                        ? "bg-gradient-to-r from-primary0/10 to-accent0/5 text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <span
                        className={`inline-flex h-7 w-7 items-center justify-center rounded-lg text-[10px] font-bold uppercase tracking-wider transition-colors ${
                          selected
                            ? "bg-tone-orange-bg text-tone-orange-fg ring-1 ring-primary/40 dark:text-tone-orange-fg"
                            : "bg-foreground/[0.06] text-foreground/60 group-hover:text-foreground"
                        }`}
                      >
                        {loc}
                      </span>
                      <span className="text-sm font-medium">{localeNames[loc]}</span>
                    </span>
                    {selected && (
                      <Check
                        className="h-4 w-4 text-tone-orange-fg dark:text-tone-orange-fg"
                        aria-hidden="true"
                      />
                    )}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
