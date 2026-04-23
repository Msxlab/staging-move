"use client";

import { useState } from "react";
import { Apple, Smartphone, X } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

/**
 * Mobile app install CTA. The apps are in closed beta, so both buttons open
 * a waitlist modal that captures the user's email. When the apps ship,
 * replace the `onClick` with real store URLs and drop the modal.
 */
export function AppStoreCTA({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState<null | "ios" | "android">(null);
  const base =
    "group inline-flex items-center gap-3 rounded-xl border bg-card text-left transition-all";
  const size = compact ? "px-4 py-2.5" : "px-5 py-3";

  const target = open === "ios" ? "MOBILE_IOS" : "MOBILE_ANDROID";
  const storeLabel = open === "ios" ? "App Store" : "Google Play";

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setOpen("ios")}
          className={`${base} ${size} hover:shadow-md hover:border-primary/40 cursor-pointer`}
        >
          <Apple className="h-7 w-7" aria-hidden="true" />
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Coming soon on
            </p>
            <p className="text-sm font-semibold">App Store</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setOpen("android")}
          className={`${base} ${size} hover:shadow-md hover:border-primary/40 cursor-pointer`}
        >
          <Smartphone className="h-7 w-7" aria-hidden="true" />
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
              Coming soon on
            </p>
            <p className="text-sm font-semibold">Google Play</p>
          </div>
        </button>
      </div>

      {open ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="waitlist-modal-title"
          className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setOpen(null)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setOpen(null)}
              aria-label="Close"
              className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Closed beta
                </p>
                <h2
                  id="waitlist-modal-title"
                  className="mt-1 text-xl font-semibold text-foreground"
                >
                  Join the {storeLabel} waitlist
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We're inviting users in small batches. Leave your email and we'll send the TestFlight / Play closed-beta link when your turn comes up.
                </p>
              </div>
              <WaitlistForm
                target={target}
                source={`app-store-cta-${open}`}
                submitLabel="Join the beta waitlist"
                successMessage="You're on the waitlist. We'll send the invite when your turn comes up."
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
