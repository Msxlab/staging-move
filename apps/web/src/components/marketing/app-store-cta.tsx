"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { WaitlistForm } from "./waitlist-form";

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M17.564 12.793c-.027-2.685 2.193-3.974 2.292-4.038-1.249-1.825-3.193-2.075-3.886-2.105-1.654-.167-3.227.974-4.069.974-.84 0-2.135-.951-3.512-.925-1.808.026-3.476 1.052-4.405 2.671-1.879 3.258-.481 8.077 1.353 10.715.896 1.292 1.967 2.745 3.371 2.692 1.353-.054 1.864-.876 3.501-.876 1.638 0 2.097.876 3.527.847 1.456-.026 2.379-1.318 3.27-2.617 1.029-1.502 1.452-2.957 1.478-3.034-.032-.014-2.836-1.088-2.866-4.304zM14.882 4.876c.747-.91 1.252-2.169 1.114-3.426-1.077.045-2.388.722-3.162 1.626-.692.799-1.302 2.085-1.139 3.314 1.205.094 2.434-.611 3.187-1.514z" />
    </svg>
  );
}

function GooglePlayLogo({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="gp-grad-1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00d4ff" />
          <stop offset="1" stopColor="#00a3ff" />
        </linearGradient>
        <linearGradient id="gp-grad-2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd400" />
          <stop offset="1" stopColor="#ff9c00" />
        </linearGradient>
        <linearGradient id="gp-grad-3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3a3a" />
          <stop offset="1" stopColor="#c20034" />
        </linearGradient>
        <linearGradient id="gp-grad-4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00f076" />
          <stop offset="1" stopColor="#009245" />
        </linearGradient>
      </defs>
      <path d="M3.6 1.7c-.3.3-.5.7-.5 1.2v18.2c0 .5.2.9.5 1.2l9.4-9.4-9.4-11.2z" fill="url(#gp-grad-1)" />
      <path d="M16.6 16.4l-3.6-4 3.6-3.7 4.6 2.6c1.1.6 1.1 2.2 0 2.8l-4.6 2.3z" fill="url(#gp-grad-2)" />
      <path d="M3.6 22.3c.4.4 1 .5 1.6.1l11.4-6 -3.6-4 -9.4 9.9z" fill="url(#gp-grad-3)" />
      <path d="M3.6 1.7l9.4 11.2 3.6-3.7-11.4-6c-.6-.3-1.2-.2-1.6.5z" fill="url(#gp-grad-4)" />
    </svg>
  );
}

/**
 * Mobile app install CTA. The apps are in closed beta, so both buttons open
 * a waitlist modal that captures the user's email. When the apps ship,
 * replace the `onClick` with real store URLs and drop the modal.
 */
export function AppStoreCTA({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState<null | "ios" | "android">(null);
  const base =
    "group inline-flex min-w-[15rem] items-center gap-3 rounded-xl border border-white/15 bg-black text-white text-left shadow-sm transition-all";
  const size = compact ? "px-4 py-2" : "px-5 py-3";

  const target = open === "ios" ? "MOBILE_IOS" : "MOBILE_ANDROID";
  const storeLabel = open === "ios" ? "App Store" : "Google Play";

  return (
    <>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={() => setOpen("ios")}
          aria-label="Join the App Store waitlist"
          className={`${base} ${size} hover:opacity-90 hover:scale-[1.02] cursor-pointer`}
        >
          <AppleLogo className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-wider text-white/70">
              Coming soon on
            </p>
            <p className="text-lg font-semibold tracking-tight">App Store</p>
          </div>
        </button>
        <button
          type="button"
          onClick={() => setOpen("android")}
          aria-label="Join the Google Play waitlist"
          className={`${base} ${size} hover:opacity-90 hover:scale-[1.02] cursor-pointer`}
        >
          <GooglePlayLogo className="h-8 w-8" />
          <div className="leading-tight">
            <p className="text-[10px] uppercase tracking-wider text-white/70">
              Coming soon on
            </p>
            <p className="text-lg font-semibold tracking-tight">Google Play</p>
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
