"use client";

import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { Languages, Check } from "lucide-react";
import { locales, localeNames, type Locale } from "@/i18n/config";

/**
 * Language selector dropdown.
 *
 * Clicking a language:
 *   1. POSTs to `/api/user/locale` — this refreshes the `NEXT_LOCALE`
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
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

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
      // Hard reload — next-intl's getRequestConfig reads the cookie at
      // request time, and server-rendered bits are cached.
      window.location.reload();
    });
  };

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Language: ${localeNames[currentLocale]}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        disabled={pending}
        className={
          variant === "icon"
            ? "inline-flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
            : "flex items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
        }
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        {variant === "inline" && (
          <span className="uppercase">{currentLocale}</span>
        )}
      </button>

      {open && (
        <>
          {/* click-outside catcher */}
          <button
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label="Select language"
            className="absolute right-0 top-full z-50 mt-1 min-w-[160px] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-xl"
          >
            {locales.map((loc) => (
              <li key={loc}>
                <button
                  type="button"
                  role="option"
                  aria-selected={loc === currentLocale}
                  onClick={() => handleChange(loc)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm text-foreground transition-colors hover:bg-accent"
                >
                  <span>{localeNames[loc]}</span>
                  {loc === currentLocale && (
                    <Check className="h-4 w-4 text-brand-orange" aria-hidden="true" />
                  )}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
