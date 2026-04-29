"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, ArrowRight } from "lucide-react";

export interface ServiceLimitDetails {
  code?: string | null;
  limit?: number | null;
  current?: number | null;
  accessType?: string | null;
  plan?: string | null;
  eligibleForTrial?: boolean | null;
  upgradePath?: string | null;
}

interface ServiceLimitUpsellProps {
  open: boolean;
  details?: ServiceLimitDetails | null;
  onClose: () => void;
  /**
   * If the caller provides a returnTo path, anonymous-redirect flows can
   * preserve it so the user lands back on the same screen after sign-up.
   */
  returnTo?: string | null;
}

const DEFAULT_LIMIT = 10;

export function buildServiceLimitCopy(details?: ServiceLimitDetails | null) {
  const limit = details?.limit ?? DEFAULT_LIMIT;
  const accessType = details?.accessType || null;
  const eligibleForTrial = details?.eligibleForTrial ?? true;

  // Paid users hit the Individual Annual ceiling — there's no higher tier
  // to upsell into, so the modal switches to a contact-support shape and
  // the primary CTA opens subscription management instead of checkout.
  if (!eligibleForTrial || accessType === "PAID") {
    return {
      title: "You've reached your service limit",
      body: `Your Individual Annual plan includes up to ${limit} active services. Contact support if you need additional capacity.`,
      primary: "Manage subscription",
      secondary: "Maybe later",
    };
  }

  const tier =
    accessType === "FREE_TRIAL"
      ? "Free Trial"
      : accessType === "FREE_ACCESS"
        ? "Free Access"
        : "Free Access";
  return {
    title: "You've reached your service limit",
    body: `${tier} includes up to ${limit} active services. Start Individual Annual with 3 months free to keep adding services.`,
    primary: "Start 3 months free",
    secondary: "Maybe later",
  };
}

export function ServiceLimitUpsell({ open, details, onClose, returnTo }: ServiceLimitUpsellProps) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  const copy = buildServiceLimitCopy(details);
  const eligibleForTrial = details?.eligibleForTrial ?? true;
  const targetPath = details?.upgradePath || "/settings/subscription";

  function handleUpgrade() {
    const safeReturnTo = returnTo && returnTo.startsWith("/") ? returnTo : null;
    if (!eligibleForTrial) {
      // Trialing/active users hit a different limit (paid tier ceiling).
      // Send them to subscription management so they can review, not
      // re-trigger checkout.
      router.push("/settings/subscription");
      return;
    }
    router.push(targetPath + (safeReturnTo ? `?returnTo=${encodeURIComponent(safeReturnTo)}` : ""));
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy.title}
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-orange-500/30 bg-background p-6 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          ref={closeRef}
          type="button"
          onClick={onClose}
          aria-label="Close upgrade prompt"
          className="absolute right-3 top-3 rounded-full p-1.5 text-muted-foreground hover:bg-foreground/5 hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>

        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-orange-500/30 bg-orange-500/10 p-2.5">
            <Sparkles className="h-5 w-5 text-orange-400" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">{copy.body}</p>

        {typeof details?.current === "number" && typeof details?.limit === "number" ? (
          <p className="mt-3 text-xs text-muted-foreground">
            Services tracked: {details.current} / {details.limit}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5"
          >
            {copy.secondary}
          </button>
          <button
            type="button"
            onClick={handleUpgrade}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-orange-500 px-4 py-2 text-sm font-semibold text-white transition hover:bg-orange-600"
          >
            {copy.primary}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
