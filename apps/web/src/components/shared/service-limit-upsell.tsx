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
      title: "Unlock your full move plan",
      body: "Your free plan organizes your home. Upgrade to Individual to unlock your full personalized move plan — checklist, countdown, state guide, provider migration, and move tracking.",
      primary: "Unlock with Individual",
      secondary: "Maybe later",
    };
  }

  // Address-limit paywall: copy is address-specific (never "active services")
  // and stays friendly even when the API sends no numbers — the caller maps
  // unknown upgrade-required codes onto ADDRESS_LIMIT_REACHED defensively, so
  // raw server enums never leak into the UI.
  if (isAddressLimitCode(details?.code)) {
    const addressLimit = typeof details?.limit === "number" ? details.limit : null;
    const atTopTier = addressLimit !== null && addressLimit >= PRO_MAX_ADDRESSES;
    return {
      title: "You've reached your address limit",
      body: atTopTier
        ? `Your plan includes up to ${addressLimit} saved addresses — our highest cap. Contact support if you need additional capacity.`
        : addressLimit !== null
          ? `Your current plan includes up to ${addressLimit} saved address${addressLimit === 1 ? "" : "es"}. Upgrade to keep adding addresses — up to ${PRO_MAX_ADDRESSES} on Pro.`
          : `You've reached the address limit for your current plan. Upgrade to keep adding addresses — up to ${PRO_MAX_ADDRESSES} on Pro.`,
      primary: "Upgrade",
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
    const trialLabel = formatTrialLabel(campaign.trialDays);
    const headline =
      campaign.publicHeadline ||
      (trialLabel ? `Start ${trialLabel} free` : "Upgrade to Individual Annual");
    const priceCopy = campaign.displayPriceLabel
      ? `${campaign.displayPriceLabel}${trialLabel ? " after trial" : ""}`
      : "annual billing";
    const tier = accessType === "FREE_TRIAL" ? "Free Trial" : "Free Access";
    const upgradeCopy = trialLabel ? headline : `${headline} to keep adding services`;
    return {
      title: "You've reached your service limit",
      body: `${tier} includes up to ${limit} active services. ${upgradeCopy}. ${priceCopy}.`,
      primary: headline,
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
    body: `${tier} includes up to ${limit} active services. Upgrade to Individual Annual to keep adding services.`,
    primary: "Upgrade to Individual Annual",
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

        {typeof details?.current === "number" && typeof details?.limit === "number" ? (
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
