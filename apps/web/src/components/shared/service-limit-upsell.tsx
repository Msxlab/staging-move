"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Sparkles, X, ArrowRight } from "lucide-react";
import { isUnlimited } from "@/components/shared/service-usage-indicator";

export interface ServiceLimitDetails {
  code?: string | null;
  limit?: number | null;
  current?: number | null;
  accessType?: string | null;
  plan?: string | null;
  eligibleForTrial?: boolean | null;
  subscription?: {
    accessType?: string | null;
    plan?: string | null;
    eligibleForTrial?: boolean | null;
  } | null;
  campaign?: {
    code?: string | null;
    publicHeadline?: string | null;
    displayPriceLabel?: string | null;
    trialDays?: number | null;
    accessType?: string | null;
    billingInterval?: string | null;
  } | null;
  monthlyOffer?: {
    code?: string | null;
    publicHeadline?: string | null;
    displayPriceLabel?: string | null;
    trialDays?: number | null;
    accessType?: string | null;
    billingInterval?: string | null;
  } | null;
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
  /**
   * CONSUMER_FREE pivot: a full-access free user has no service/address cap to
   * upsell against, so this limit-reached modal would be a contradiction.
   * Defaults to `false` so flag-OFF callers behave EXACTLY as before. When
   * `true`, the modal never renders.
   */
  consumerFree?: boolean;
}

const DEFAULT_LIMIT = 10;

// Address-limit reuse: the addresses flow funnels its 403 limit responses
// through this same polished modal instead of a raw error box. Pro's real cap
// (25 addresses) keeps the upsell honest — never advertise "unlimited".
const ADDRESS_LIMIT_CODES = new Set(["ADDRESS_LIMIT_REACHED", "SETUP_ADDRESS_LIMIT_REACHED"]);
const PRO_MAX_ADDRESSES = 25;

export function isAddressLimitCode(code?: string | null): boolean {
  return Boolean(code && ADDRESS_LIMIT_CODES.has(code));
}

function formatTrialLabel(days?: number | null) {
  const normalizedDays = Number(days || 0);
  if (normalizedDays <= 0) return null;
  return `${normalizedDays} day${normalizedDays === 1 ? "" : "s"}`;
}

export function buildServiceLimitCopy(details?: ServiceLimitDetails | null) {
  const limit = details?.limit ?? DEFAULT_LIMIT;
  const accessType = details?.subscription?.accessType ?? details?.accessType ?? null;
  const eligibleForTrial =
    details?.subscription?.eligibleForTrial ?? details?.eligibleForTrial ?? true;
  const campaign = details?.campaign || details?.monthlyOffer || null;

  // Move-plan paywall (freemium): the moving plan is an Individual+ feature.
  // Free users organizing their home hit this when they try to create or
  // generate a move plan. Copy is move-specific, not service-limit-specific.
  if (details?.code === "MOVING_PLAN_UPGRADE_REQUIRED") {
    return {
      title: "Your full move plan should be included",
      body: "Full-access staging includes the personalized checklist, countdown, state guide, provider migration, and move tracking. Review your access if this gate appears.",
      primary: "Review access",
      secondary: "Maybe later",
    };
  }

  // Address-limit fallback: staging should be full-access, so a limit response
  // is treated as an access/capacity mismatch rather than an upgrade prompt.
  if (isAddressLimitCode(details?.code)) {
    const addressLimit = typeof details?.limit === "number" ? details.limit : null;
    const atTopTier = addressLimit !== null && addressLimit >= PRO_MAX_ADDRESSES;
    return {
      title: atTopTier ? "Address capacity needs review" : "Your address access needs review",
      body: atTopTier
        ? `Your plan includes up to ${addressLimit} saved addresses — our highest cap. Contact support if you need additional capacity.`
        : addressLimit !== null
          ? `Full-access staging should include Pro address capacity. This account currently reports ${addressLimit} saved address${addressLimit === 1 ? "" : "es"}; review access if this cap appears.`
          : `Full-access staging should include Pro address capacity. Review access if this cap appears while adding an address.`,
      primary: "Review access",
      secondary: "Maybe later",
    };
  }

  // Paid users hit the Individual Annual ceiling — there's no higher tier
  // to upsell into, so the modal switches to a contact-support shape and
  // the primary CTA opens subscription management instead of checkout.
  if (!eligibleForTrial || accessType === "PAID") {
    return {
      title: "You've reached your service limit",
      body: `Your Individual plan includes up to ${limit} active services. Contact support if you need additional capacity.`,
      primary: "Manage subscription",
      secondary: "Maybe later",
    };
  }

  if (campaign) {
    const tier = accessType === "FREE_TRIAL" ? "Free Trial" : "Free Access";
    return {
      title: "Your service access needs review",
      body: `${tier} currently reports up to ${limit} active services. Full-access staging should include the higher service capacity; review access if this cap appears.`,
      primary: "Review access",
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
    title: "Your service access needs review",
    body: `${tier} currently reports up to ${limit} active services. Full-access staging should include the higher service capacity; review access if this cap appears.`,
    primary: "Review access",
    secondary: "Maybe later",
  };
}

export function ServiceLimitUpsell({ open, details, onClose, returnTo, consumerFree = false }: ServiceLimitUpsellProps) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement | null>(null);

  useEffect(() => {
    if (!open || consumerFree) return;
    closeRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, consumerFree]);

  // CONSUMER_FREE: full-access free users have no cap to upsell — suppress the
  // whole modal. Flag OFF (default) falls through to the unchanged behavior.
  if (!open || consumerFree) return null;

  const copy = buildServiceLimitCopy(details);
  const eligibleForTrial =
    details?.subscription?.eligibleForTrial ?? details?.eligibleForTrial ?? true;
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
      className="fixed inset-0 z-[100] flex items-center justify-center bg-foreground/40 backdrop-blur-sm backdrop-blur-sm px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-md rounded-2xl border border-tone-orange-br bg-background p-6 shadow-2xl"
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
          <div className="rounded-xl border border-tone-orange-br bg-tone-orange-bg p-2.5">
            <Sparkles className="h-5 w-5 text-tone-orange-fg" />
          </div>
          <h2 className="text-lg font-semibold text-foreground">{copy.title}</h2>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">{copy.body}</p>

        {typeof details?.current === "number" &&
        typeof details?.limit === "number" &&
        !isUnlimited(details.limit) ? (
          <p className="mt-3 text-xs text-muted-foreground">
            {isAddressLimitCode(details?.code) ? "Addresses saved" : "Services tracked"}: {details.current} / {details.limit}
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
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-tone-orange-fg px-4 py-2 text-sm font-semibold text-white transition hover:opacity-90"
          >
            {copy.primary}
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
