"use client";

import { useState } from "react";
import { HelpCircle } from "lucide-react";

/**
 * Small inline help marker. A native `title` tooltip is hover-only and dead on
 * touch, so this toggles a small popover on tap/click (and is keyboard-
 * focusable / Enter-toggleable) — technical labels can carry a plain-language
 * definition that an operator can actually read on a phone.
 */
export function InfoHint({ text, label, className = "" }: { text: string; label?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <span className={`relative inline-flex align-middle ${className}`}>
      <button
        type="button"
        aria-label={label ? `${label}: ${text}` : text}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        onBlur={() => setOpen(false)}
        className="inline-flex cursor-help text-muted-foreground/60 transition-colors hover:text-muted-foreground focus:text-muted-foreground focus:outline-none"
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open && (
        <span
          role="tooltip"
          className="absolute left-1/2 top-full z-[60] mt-1.5 w-max max-w-[240px] -translate-x-1/2 whitespace-normal rounded-lg border border-border bg-card px-3 py-2 text-left text-xs font-normal normal-case leading-snug text-foreground shadow-lg"
        >
          {text}
        </span>
      )}
    </span>
  );
}
