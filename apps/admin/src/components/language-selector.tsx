"use client";

import { useLocale } from "next-intl";
import { useState, useTransition } from "react";
import { Languages, Check } from "lucide-react";
import { locales, localeNames, type Locale } from "@/i18n/config";

/**
 * Admin language selector. Mirrors the web app's widget pattern —
 * cookie-based locale that reloads the page on change. Admin has no
 * per-admin DB field; the cookie alone is the source of truth.
 */
export function LanguageSelector({ compact = false }: { compact?: boolean }) {
  const currentLocale = useLocale() as Locale;
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const handleChange = (next: Locale) => {
    if (next === currentLocale) {
      setOpen(false);
      return;
    }
    startTransition(() => {
      // One-year cookie; admin has no logged-in DB field for locale.
      document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
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
        title={compact ? `Language: ${localeNames[currentLocale]}` : undefined}
        className={
          compact
            ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
            : "flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-60"
        }
      >
        <Languages className="h-4 w-4" aria-hidden="true" />
        {!compact && <span className="uppercase">{currentLocale}</span>}
      </button>

      {open && (
        <>
          <button
            aria-hidden="true"
            tabIndex={-1}
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setOpen(false)}
          />
          <ul
            role="listbox"
            aria-label="Select language"
            className="absolute right-0 bottom-full z-50 mb-1 min-w-[160px] overflow-hidden rounded-xl border border-border bg-popover py-1 shadow-xl"
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
