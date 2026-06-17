"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { Button } from "@/components/ui/button";

interface NavLink {
  href: string;
  label: string;
}

/**
 * Mobile marketing nav. The desktop <nav> in MarketingHeader is `hidden md:flex`,
 * so below md the in-page links (Features / Pricing / How it works / Blog / FAQ)
 * have no entry point. This is the md:hidden hamburger that opens an accessible
 * panel under the header listing those links (+ the auth CTAs when logged out).
 *
 * A11y: the trigger is a real <button> with aria-expanded + aria-controls and a
 * 44px tap target; opening moves focus into the panel, Tab is trapped within it,
 * Escape closes, and focus returns to the trigger on close.
 */
export function MarketingMobileNav({
  links,
  userId,
  signInLabel,
  signUpLabel,
  menuLabel,
}: {
  links: NavLink[];
  userId: string | null;
  signInLabel: string;
  signUpLabel: string;
  menuLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const node = panelRef.current;
    const focusables = () =>
      Array.from(node?.querySelectorAll<HTMLElement>('a[href], button:not([disabled])') ?? []);
    // Move focus into the panel on open.
    focusables()[0]?.focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setOpen(false);
        return;
      }
      if (e.key === "Tab") {
        const items = focusables();
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      // Return focus to the trigger when the panel closes.
      triggerRef.current?.focus();
    };
  }, [open]);

  return (
    <div className="md:hidden">
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-controls="marketing-mobile-nav"
        aria-label={menuLabel}
        className="inline-flex h-11 w-11 items-center justify-center rounded-md text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      >
        {open ? <X className="h-5 w-5" aria-hidden="true" /> : <Menu className="h-5 w-5" aria-hidden="true" />}
      </button>

      {open && (
        <>
          <div
            className="fixed inset-x-0 bottom-0 top-16 z-40 bg-black/40"
            aria-hidden="true"
            onClick={() => setOpen(false)}
          />
          <div
            ref={panelRef}
            id="marketing-mobile-nav"
            className="fixed inset-x-0 top-16 z-40 border-b bg-background p-4 shadow-lg"
          >
            <nav aria-label={menuLabel} className="flex flex-col gap-1">
              {links.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setOpen(false)}
                  className="rounded-md px-3 py-3 text-base font-medium text-foreground/90 transition-colors hover:bg-foreground/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {l.label}
                </Link>
              ))}
              {!userId && (
                <div className="mt-2 flex flex-col gap-2 border-t pt-3">
                  <Button asChild variant="ghost" className="w-full justify-center">
                    <Link href="/sign-in" onClick={() => setOpen(false)}>
                      {signInLabel}
                    </Link>
                  </Button>
                  <Button asChild className="w-full justify-center">
                    <Link href="/sign-up" onClick={() => setOpen(false)}>
                      {signUpLabel}
                    </Link>
                  </Button>
                </div>
              )}
            </nav>
          </div>
        </>
      )}
    </div>
  );
}
