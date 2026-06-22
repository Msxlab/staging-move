"use client";

import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { WaitlistForm } from "@/components/marketing/waitlist-form";
import { IOS_APP_STORE_URL, ANDROID_PLAY_STORE_URL } from "@/lib/store-links";

/**
 * Smart app install banner.
 *
 * Detects the visitor's OS and offers the matching native app: App Store on
 * iOS, Google Play on Android. We intentionally do NOT use a PWA
 * `beforeinstallprompt` flow — when a real native app exists, asking the user
 * to "Add to Home Screen" instead is confusing (two Move icons end up
 * on their phone). On desktop the banner stays hidden; there's nothing useful
 * to install.
 *
 * Store URLs come from env so the same component works during closed beta
 * (no public URL yet → fall back to the existing waitlist modal) and after
 * public launch (URL set → tap deep-links straight to the store).
 *
 * Suppressed when:
 *   - The page is rendered inside our own mobile app's in-app browser
 *     (embed=mobile latches a sessionStorage flag, the parent AppShell skips
 *     this component entirely in that mode).
 *   - The site is opened as an installed PWA (display-mode: standalone).
 *   - The user dismissed the banner in the last 14 days.
 */

type Platform = "ios" | "android" | null;

const DISMISS_KEY = "lf:app-banner-dismissed";
const DISMISS_DAYS = 14;

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return null;
  const ua = navigator.userAgent || "";
  // iPad on iPadOS 13+ reports MacIntel + touch. Detect that combo too so
  // iPad Safari (which can install from the App Store) still gets the CTA.
  const isIpadOS =
    ua.includes("Mac") && typeof navigator.maxTouchPoints === "number" && navigator.maxTouchPoints > 1;
  if (/iPhone|iPad|iPod/.test(ua) || isIpadOS) return "ios";
  if (/Android/i.test(ua)) return "android";
  return null;
}

function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  if (window.matchMedia?.("(display-mode: standalone)").matches) return true;
  // iOS Safari uses a non-standard `navigator.standalone` for installed PWAs.
  return Boolean((window.navigator as unknown as { standalone?: boolean }).standalone);
}

function isDismissedRecently(): boolean {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    const at = Number(raw);
    if (!Number.isFinite(at)) return false;
    const ageMs = Date.now() - at;
    return ageMs < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

function AppleLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.564 12.793c-.027-2.685 2.193-3.974 2.292-4.038-1.249-1.825-3.193-2.075-3.886-2.105-1.654-.167-3.227.974-4.069.974-.84 0-2.135-.951-3.512-.925-1.808.026-3.476 1.052-4.405 2.671-1.879 3.258-.481 8.077 1.353 10.715.896 1.292 1.967 2.745 3.371 2.692 1.353-.054 1.864-.876 3.501-.876 1.638 0 2.097.876 3.527.847 1.456-.026 2.379-1.318 3.27-2.617 1.029-1.502 1.452-2.957 1.478-3.034-.032-.014-2.836-1.088-2.866-4.304zM14.882 4.876c.747-.91 1.252-2.169 1.114-3.426-1.077.045-2.388.722-3.162 1.626-.692.799-1.302 2.085-1.139 3.314 1.205.094 2.434-.611 3.187-1.514z" />
    </svg>
  );
}

function PlayLogo({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id="sp-g1" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00d4ff" />
          <stop offset="1" stopColor="#00a3ff" />
        </linearGradient>
        <linearGradient id="sp-g2" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffd400" />
          <stop offset="1" stopColor="#ff9c00" />
        </linearGradient>
        <linearGradient id="sp-g3" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ff3a3a" />
          <stop offset="1" stopColor="#c20034" />
        </linearGradient>
        <linearGradient id="sp-g4" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#00f076" />
          <stop offset="1" stopColor="#009245" />
        </linearGradient>
      </defs>
      <path d="M3.6 1.7c-.3.3-.5.7-.5 1.2v18.2c0 .5.2.9.5 1.2l9.4-9.4-9.4-11.2z" fill="url(#sp-g1)" />
      <path d="M16.6 16.4l-3.6-4 3.6-3.7 4.6 2.6c1.1.6 1.1 2.2 0 2.8l-4.6 2.3z" fill="url(#sp-g2)" />
      <path d="M3.6 22.3c.4.4 1 .5 1.6.1l11.4-6 -3.6-4 -9.4 9.9z" fill="url(#sp-g3)" />
      <path d="M3.6 1.7l9.4 11.2 3.6-3.7-11.4-6c-.6-.3-1.2-.2-1.6.5z" fill="url(#sp-g4)" />
    </svg>
  );
}

export function InstallPrompt() {
  const [platform, setPlatform] = useState<Platform>(null);
  const [dismissed, setDismissed] = useState(true);
  const [waitlistOpen, setWaitlistOpen] = useState(false);

  useEffect(() => {
    if (isStandalonePwa()) return;
    if (isDismissedRecently()) return;
    const p = detectPlatform();
    if (!p) return;
    setPlatform(p);
    setDismissed(false);
  }, []);

  const storeUrl =
    platform === "ios"
      ? IOS_APP_STORE_URL
      : platform === "android"
        ? ANDROID_PLAY_STORE_URL
        : undefined;

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      /* noop */
    }
  };

  const handleInstall = () => {
    if (storeUrl) {
      window.location.href = storeUrl;
      return;
    }
    // No public store URL configured yet (closed beta) — fall back to the
    // existing waitlist capture so we don't drop the lead.
    setWaitlistOpen(true);
  };

  if (dismissed || !platform) return null;

  const storeLabel = platform === "ios" ? "App Store" : "Google Play";
  const Logo = platform === "ios" ? AppleLogo : PlayLogo;
  const verb = storeUrl ? "Get" : "Join beta";

  return (
    <>
      <div className="fixed bottom-20 left-4 right-4 sm:left-auto sm:right-6 sm:w-[22rem] z-50 animate-in slide-in-from-bottom-4">
        <div
          className="rounded-2xl border border-border p-4 shadow-2xl"
          style={{ background: "color-mix(in srgb, var(--surface-secondary) 95%, transparent)" }}
        >
          <div className="flex items-start gap-3">
            <div className="rounded-xl bg-foreground/5 p-2.5 shrink-0">
              <Logo className="h-7 w-7 text-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">Get the LocateFlow app</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {storeUrl
                  ? `Faster, offline-ready, with push notifications. Free on ${storeLabel}.`
                  : `Closed beta on ${storeLabel}. We'll send you the invite when your turn comes up.`}
              </p>
              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={handleInstall}
                  className="rounded-lg bg-foreground px-3 py-1.5 text-xs font-semibold text-background hover:opacity-90 transition"
                >
                  {verb} on {storeLabel}
                </button>
                <button
                  type="button"
                  onClick={dismiss}
                  className="rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition"
                >
                  Not now
                </button>
              </div>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label="Dismiss"
              className="text-foreground/30 hover:text-muted-foreground shrink-0"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {waitlistOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="install-waitlist-title"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
          onClick={() => setWaitlistOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-2xl border bg-card p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setWaitlistOpen(false)}
              aria-label="Close"
              className="absolute top-3 right-3 rounded-md p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="space-y-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">Closed beta</p>
                <h2 id="install-waitlist-title" className="mt-1 text-xl font-semibold text-foreground">
                  Join the {storeLabel} waitlist
                </h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  We're inviting users in small batches. Leave your email and we'll send the
                  TestFlight / Play closed-beta link when your turn comes up.
                </p>
              </div>
              <WaitlistForm
                target={platform === "ios" ? "MOBILE_IOS" : "MOBILE_ANDROID"}
                source={`install-prompt-${platform}`}
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
