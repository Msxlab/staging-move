"use client";

import { useCallback, useMemo, useState } from "react";
import { loadStripe, type Stripe } from "@stripe/stripe-js";
import { EmbeddedCheckout, EmbeddedCheckoutProvider } from "@stripe/react-stripe-js";

/**
 * Inline Stripe Checkout (Embedded mode).
 *
 * Instead of redirecting to checkout.stripe.com, we mount Stripe's checkout
 * form inside an iframe right here on the pricing page. The user sees Apple
 * Pay / Google Pay / Link wallet buttons at the top of the embedded form
 * automatically — Stripe detects wallet capability and surfaces those
 * one-tap options on Safari / Chrome when the visitor's device supports
 * them and our Stripe Dashboard has Apple Pay domain verification in place.
 *
 * Why inline instead of the redirect? Two reasons:
 *   1. Conversion: redirecting to checkout.stripe.com costs roughly 15% of
 *      starting users — the third-party domain triggers a moment of
 *      hesitation ("did this just send me somewhere else?"). Keeping the
 *      flow on locateflow.com removes that friction.
 *   2. Wallet visibility: the Apple Pay button is the killer feature on
 *      iOS Safari, and it now lives one tap below the price headline
 *      instead of behind a redirect.
 *
 * The hosted-redirect path still exists (the legacy "Continue with annual"
 * button on the subscription page calls /api/stripe/checkout without
 * `uiMode: "embedded"` and gets a `url` back). Both paths share the same
 * server-side session-create logic, the same campaign snapshots, the same
 * `customer.subscription.*` webhook handler. This is purely a UI variant.
 */

const PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;

// `loadStripe` is documented as something you should call exactly once at
// module scope. We can't do that here because the publishable key might be
// missing in some preview environments, so we lazily memo-lazy-load on the
// first mount that has both a key and a clientSecret.
let stripePromise: Promise<Stripe | null> | null = null;
function getStripe(): Promise<Stripe | null> {
  if (!PUBLISHABLE_KEY) return Promise.resolve(null);
  if (!stripePromise) stripePromise = loadStripe(PUBLISHABLE_KEY);
  return stripePromise;
}

export type EmbeddedCheckoutCardProps = {
  /** "INDIVIDUAL" — only plan we sell today. */
  plan: "INDIVIDUAL";
  /** Stripe billing interval, matches the server route's `billingInterval`. */
  billingInterval: "MONTH" | "YEAR";
  /** Acquisition campaign code, when the visitor is on a campaign offer. */
  campaignCode?: string | null;
  /** Compact label for the trigger button (e.g. "Subscribe — $3.99/mo"). */
  triggerLabel: string;
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
  /** Optional CSS classes applied to the trigger button. */
  triggerClassName?: string;
  /**
   * Required acknowledgement that the parent has shown the subscription
   * disclosure UI and the user has accepted it. The server route enforces
   * `acceptedSubscriptionTerms === true`, but the embedded card itself
   * also refuses to launch without an explicit `true` to keep future
   * mount sites from silently bypassing the gate.
   */
  termsAccepted: boolean;
};

type IntentState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "ready"; clientSecret: string }
  // `recovery: "billing"` means the failure is an existing-subscription /
  // past-due conflict the user can resolve in the Stripe customer portal, so
  // the error surface renders a one-tap "Open billing settings" button instead
  // of a dead-end message.
  | { status: "error"; message: string; recovery?: "billing" };

export function EmbeddedCheckoutCard({
  plan,
  billingInterval,
  campaignCode,
  triggerLabel,
  disabled = false,
  onPendingChange,
  triggerClassName,
  termsAccepted,
}: EmbeddedCheckoutCardProps) {
  const [intent, setIntent] = useState<IntentState>({ status: "idle" });
  const [billingBusy, setBillingBusy] = useState(false);

  // Recovery path for an existing/past-due subscription: open the Stripe
  // customer portal so the user can fix billing instead of being stuck on the
  // checkout error. The portal route works for past-due subscriptions.
  const openBillingPortal = useCallback(async () => {
    if (billingBusy) return;
    setBillingBusy(true);
    try {
      const res = await fetch("/api/stripe/portal", { method: "POST" });
      const data = (await res.json()) as { url?: string; error?: string };
      if (res.ok && data.url) {
        window.location.href = data.url;
        return;
      }
      setIntent({
        status: "error",
        message: data.error || "Could not open billing settings. Please try again.",
      });
    } catch {
      setIntent({
        status: "error",
        message: "Could not open billing settings. Please try again.",
      });
    } finally {
      setBillingBusy(false);
    }
  }, [billingBusy]);

  const launch = useCallback(async () => {
    if (disabled || intent.status === "loading") return;
    if (!termsAccepted) {
      setIntent({
        status: "error",
        message:
          "Please confirm you have read and accepted the subscription terms before continuing.",
      });
      return;
    }
    if (!PUBLISHABLE_KEY) {
      setIntent({
        status: "error",
        message:
          "Express checkout is not configured for this environment. Use the standard subscribe button instead.",
      });
      return;
    }
    setIntent({ status: "loading" });
    onPendingChange?.(true);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan,
          billingInterval,
          ...(campaignCode ? { campaignCode } : {}),
          acceptedSubscriptionTerms: true,
          uiMode: "embedded",
        }),
      });
      const data = (await response.json()) as {
        clientSecret?: string;
        error?: string;
        code?: string;
      };
      if (!response.ok || !data.clientSecret) {
        // The server hands back a machine-readable code for conflicts the user
        // can resolve in billing settings; surface a recovery CTA for those
        // instead of a plain error.
        const recoverable =
          data.code === "BILLING_NEEDS_ATTENTION" || data.code === "ALREADY_ACTIVE";
        setIntent({
          status: "error",
          message: data.error || "Failed to start checkout.",
          ...(recoverable ? { recovery: "billing" as const } : {}),
        });
        onPendingChange?.(false);
        return;
      }
      setIntent({ status: "ready", clientSecret: data.clientSecret });
    } catch (error: any) {
      setIntent({ status: "error", message: error?.message || "Failed to start checkout." });
      onPendingChange?.(false);
    }
  }, [disabled, intent.status, onPendingChange, plan, billingInterval, campaignCode, termsAccepted]);

  const options = useMemo(() => {
    if (intent.status !== "ready") return null;
    return { clientSecret: intent.clientSecret };
  }, [intent]);

  if (intent.status === "ready" && options) {
    return (
      <div className="rounded-2xl border border-border bg-card/40 p-2 shadow-sm">
        <EmbeddedCheckoutProvider stripe={getStripe()} options={options}>
          <EmbeddedCheckout />
        </EmbeddedCheckoutProvider>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => void launch()}
        disabled={disabled || intent.status === "loading"}
        className={
          triggerClassName ||
          "inline-flex w-full items-center justify-center gap-2 rounded-xl bg-foreground px-4 py-3 text-sm font-semibold text-background transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {intent.status === "loading" ? "Opening secure checkout..." : triggerLabel}
      </button>
      {intent.status === "error" ? (
        <div className="space-y-2">
          <p className="text-xs text-destructive">{intent.message}</p>
          {intent.recovery === "billing" ? (
            <button
              type="button"
              onClick={() => void openBillingPortal()}
              disabled={billingBusy}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-accent disabled:cursor-not-allowed disabled:opacity-60"
            >
              {billingBusy ? "Opening billing settings..." : "Open billing settings"}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
