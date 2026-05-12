"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Check, Crown, ShieldCheck, Sparkles } from "lucide-react";
import {
  BILLING_PLAN_DEFINITIONS,
  buildCheckoutDisclosureText,
  buildTrialConsentLabel,
  deriveUserSubscriptionState,
  type UnifiedEntitlementSnapshot,
} from "@/lib/shared-billing";
import { RevealModal } from "@/components/premium/reveal-modal";
import { planToStickerTier } from "@/components/premium/premium-sticker";
import { trackEvent } from "@/lib/analytics";

type SubscriptionRecord = {
  plan?: string | null;
  status?: string | null;
  provider?: string | null;
  stripeCustomerId?: string | null;
  stripeSubscriptionId?: string | null;
  accessType?: string | null;
  billingInterval?: string | null;
  trialEndsAt?: string | null;
  freeAccessEndsAt?: string | null;
  firstChargeAt?: string | null;
  firstChargeAmount?: number | null;
  currentPeriodEndsAt?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  premiumUntil?: string | null;
  cancelAtPeriodEnd?: boolean | null;
  autoRenew?: boolean | null;
};

type ProfileResponse = {
  subscription?: SubscriptionRecord | null;
  entitlement?: UnifiedEntitlementSnapshot | null;
};

type PublicTrialCampaign = {
  campaignCode: string;
  accessType: string;
  publicHeadline: string;
  publicSubheadline: string | null;
  checkoutDisclosureCopy: string | null;
  displayPriceLabel: string;
  trialDays: number | null;
  billingInterval: string | null;
  ctaText: string;
  priceCopy: string;
  trialLabel: string | null;
};

type PublicSubscriptionOffers = {
  annualTrial?: PublicTrialCampaign | null;
  monthlyPaid?: PublicTrialCampaign | null;
};

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function formatDateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function intervalLabel(subscription: SubscriptionRecord | null | undefined) {
  return subscription?.billingInterval === "MONTH" ? "Monthly" : "Annual";
}

function stateTitle(state: string, subscription?: SubscriptionRecord | null) {
  const interval = intervalLabel(subscription);
  switch (state) {
    case "FREE_ACCESS":
      return "Free Access";
    case "FREE_ACCESS_EXPIRED":
      return "Free Access ended";
    case "TRIALING":
      return "Individual Annual Trial";
    case "TRIAL_CANCELED":
      return "Trial canceled";
    case "ACTIVE":
      return `Individual ${interval}`;
    case "CANCEL_AT_PERIOD_END":
      return `Individual ${interval}`;
    case "PAST_DUE":
    case "GRACE_PERIOD":
      return "Payment needs attention";
    case "PENDING_CHECKOUT":
      return "Activating checkout";
    default:
      return "Subscription";
  }
}

function statusBadge(state: string) {
  if (["FREE_ACCESS", "TRIALING", "ACTIVE", "GRACE_PERIOD"].includes(state)) {
    return "border border-tone-emerald-br bg-tone-emerald-bg text-tone-emerald-fg";
  }
  if (["FREE_ACCESS_EXPIRED", "PAST_DUE", "PENDING_CHECKOUT"].includes(state)) {
    return "border border-tone-honey-br bg-tone-honey-bg text-tone-honey-fg";
  }
  return "border border-border bg-foreground/5 text-muted-foreground";
}

function statusLabel(state: string) {
  if (state === "PENDING_CHECKOUT") return "PROCESSING";
  if (state === "UNKNOWN") return "LOADING";
  return state.replaceAll("_", " ");
}

function isStripeCheckoutActivated(subscription: SubscriptionRecord | null | undefined) {
  if (!subscription) return false;
  if (subscription.provider !== "STRIPE") return false;
  if (subscription.accessType === "FREE_ACCESS") return false;
  return subscription.status === "TRIALING" || subscription.status === "ACTIVE";
}

export default function SubscriptionManagementPage() {
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [entitlement, setEntitlement] = useState<UnifiedEntitlementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [acceptedAnnualTerms, setAcceptedAnnualTerms] = useState(false);
  const [acceptedMonthlyTerms, setAcceptedMonthlyTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [waitingForActivation, setWaitingForActivation] = useState(false);
  const [publicCampaign, setPublicCampaign] = useState<PublicTrialCampaign | null>(null);
  const [monthlyOffer, setMonthlyOffer] = useState<PublicTrialCampaign | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const successFlag = searchParams.get("success") === "true";
  const justUpgradedPlan = successFlag ? searchParams.get("plan") : null;
  const justUpgradedTier = planToStickerTier(justUpgradedPlan);
  const [revealOpen, setRevealOpen] = useState(false);
  const activationTrackedRef = useRef(false);
  const stuckCheckoutRecoveryRef = useRef(false);

  async function load() {
    setError(null);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const data = (await response.json()) as ProfileResponse & { error?: string };
      if (!response.ok) throw new Error(data.error || "Failed to load subscription.");
      setSubscription(data.subscription || null);
      setEntitlement(data.entitlement || null);
      return data;
    } catch (err: any) {
      setError(err?.message || "Failed to load subscription.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function loadPublicCampaign() {
    try {
      const response = await fetch("/api/acquisition/public-trial-campaign", { cache: "no-store" });
      const data = (await response.json()) as {
        campaign?: PublicTrialCampaign | null;
        offers?: PublicSubscriptionOffers | null;
      };
      setPublicCampaign(response.ok ? data.offers?.annualTrial || data.campaign || null : null);
      setMonthlyOffer(response.ok ? data.offers?.monthlyPaid || null : null);
    } catch {
      setPublicCampaign(null);
      setMonthlyOffer(null);
    }
  }

  useEffect(() => {
    setLoading(true);
    void load();
    void loadPublicCampaign();
  }, []);

  // Stripe Checkout returns the user here while the `customer.subscription.*`
  // webhook is still in flight. Poll a short window so the page resolves to
  // TRIALING/ACTIVE before we celebrate — otherwise the reveal modal would
  // flash the success animation while the underlying state is still pending.
  useEffect(() => {
    if (!successFlag) return;
    let cancelled = false;
    setWaitingForActivation(true);
    let attempts = 0;
    const maxAttempts = 12; // ~24s total at 2s interval
    const tick = async () => {
      if (cancelled) return;
      const data = await load();
      attempts += 1;
      const sub = data?.subscription || null;
      const isActivated = isStripeCheckoutActivated(sub);
      if (isActivated || attempts >= maxAttempts) {
        if (!cancelled) setWaitingForActivation(false);
        return;
      }
      setTimeout(tick, 2000);
    };
    void tick();
    return () => {
      cancelled = true;
    };
  }, [successFlag]);

  // If the user lands here with a PENDING_CHECKOUT row but no `?success=true`
  // (e.g. they hit the browser back button from Stripe Checkout — Stripe does
  // not fire its `cancel_url` in that path), reset the stuck row immediately
  // instead of leaving the page on "Activating checkout…" for up to 30 min
  // until the cron sweeper runs.
  useEffect(() => {
    if (loading) return;
    if (successFlag) return;
    if (waitingForActivation) return;
    if (stuckCheckoutRecoveryRef.current) return;
    if (subscription?.status !== "PENDING_CHECKOUT") return;
    if (subscription?.stripeSubscriptionId) return;
    stuckCheckoutRecoveryRef.current = true;
    void (async () => {
      try {
        await fetch("/api/stripe/checkout/cancel", { method: "POST" });
      } catch {
        // best-effort; the cron sweep will catch it within 30 min
      }
      await load();
    })();
  }, [loading, successFlag, waitingForActivation, subscription?.status, subscription?.stripeSubscriptionId]);

  useEffect(() => {
    if (!justUpgradedTier) return;
    if (waitingForActivation) return;
    if (!subscription) return;
    if (!isStripeCheckoutActivated(subscription)) return;
    if (!activationTrackedRef.current) {
      activationTrackedRef.current = true;
      const cycle = subscription.billingInterval === "MONTH" ? "monthly" : "yearly";
      trackEvent(subscription.status === "TRIALING" ? "trial_started" : "subscription_started", {
        plan: "individual",
        cycle,
      });
    }
    setRevealOpen(true);
    router.replace("/settings/subscription", { scroll: false });
  }, [justUpgradedTier, router, waitingForActivation, subscription]);

  const currentState = useMemo(
    () => deriveUserSubscriptionState(subscription || null),
    [subscription],
  );
  const currentProvider = entitlement?.provider || subscription?.provider || "TRIAL";
  const trialEndLabel = formatDateLabel(entitlement?.trialEndsAt || subscription?.trialEndsAt);
  const freeAccessEndLabel = formatDateLabel(entitlement?.freeAccessEndsAt || subscription?.freeAccessEndsAt);
  const periodEndLabel = formatDateLabel(
    entitlement?.currentPeriodEndsAt ||
      subscription?.currentPeriodEndsAt ||
      subscription?.stripeCurrentPeriodEnd ||
      subscription?.premiumUntil,
  );
  const firstChargeDate = subscription?.firstChargeAt
    ? new Date(subscription.firstChargeAt)
    : addDays(new Date(), publicCampaign?.trialDays || 90);
  const firstChargeLabel = formatDateLabel(firstChargeDate.toISOString());
  const subscriptionPriceLabel = subscription?.firstChargeAmount
    ? `$${subscription.firstChargeAmount}/${subscription?.billingInterval === "MONTH" ? "month" : "year"}`
    : BILLING_PLAN_DEFINITIONS.INDIVIDUAL.yearlyPriceLabel ||
      `$${BILLING_PLAN_DEFINITIONS.INDIVIDUAL.yearlyPriceUsd ?? 39.99}/year`;
  const offerPriceLabel = publicCampaign?.displayPriceLabel || subscriptionPriceLabel;
  const monthlyDisclosure = monthlyOffer?.checkoutDisclosureCopy ||
    (monthlyOffer
      ? `Today: ${monthlyOffer.displayPriceLabel}. Your Individual Monthly subscription starts today and renews monthly until you cancel.`
      : null);
  const checkoutDisclosure = buildCheckoutDisclosureText({
    firstChargeAt: firstChargeDate,
    firstChargeAmount: offerPriceLabel,
  });
  const canManageStripeBilling = currentProvider === "STRIPE" && Boolean(subscription?.stripeCustomerId);
  // Store-managed subscriptions (Apple / Google) cannot be cancelled or
  // modified through Stripe Customer Portal — store policy requires the
  // user to manage them in iOS Settings → Subscriptions or Play Store →
  // Subscriptions. Tell the user where to go so they don't search for a
  // missing button.
  const storeManageHint =
    currentProvider === "APP_STORE"
      ? "Manage or cancel this subscription in iOS Settings → Apple ID → Subscriptions."
      : currentProvider === "PLAY_STORE"
        ? "Manage or cancel this subscription in the Google Play Store app → Payments & subscriptions."
        : null;
  // Trialing, active, and pending-checkout users have either already started
  // the annual plan or are mid-checkout — re-offering the trial CTA in those
  // states confused users into thinking the trial hadn't begun. Also hide
  // it while we're polling for Stripe activation so a Free Access user
  // returning from Checkout doesn't see "Start annual trial" stacked under
  // the "Activating…" banner.
  const showAnnualTrialOffer =
    !waitingForActivation &&
    ["FREE_ACCESS", "FREE_ACCESS_EXPIRED", "CANCELED"].includes(currentState) &&
    Boolean(publicCampaign || monthlyOffer);

  async function startAnnualTrial() {
    if (!acceptedAnnualTerms) {
      setError("Please review and accept the annual trial subscription terms to continue.");
      return;
    }
    setProcessing("CHECKOUT");
    setError(null);
    trackEvent("checkout_started", { plan: "individual", cycle: "yearly", has_trial: true });
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "INDIVIDUAL",
          billingInterval: "YEAR",
          ...(publicCampaign?.campaignCode ? { campaignCode: publicCampaign.campaignCode } : {}),
          acceptedSubscriptionTerms: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.url) throw new Error(data?.error || "Failed to start checkout.");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Failed to start checkout.");
      setProcessing(null);
    }
  }

  async function startMonthlyPlan() {
    if (!acceptedMonthlyTerms) {
      setError("Please review and accept the monthly subscription terms to continue.");
      return;
    }
    setProcessing("MONTHLY_CHECKOUT");
    setError(null);
    trackEvent("checkout_started", { plan: "individual", cycle: "monthly", has_trial: false });
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          plan: "INDIVIDUAL",
          billingInterval: "MONTH",
          ...(monthlyOffer?.campaignCode ? { campaignCode: monthlyOffer.campaignCode } : {}),
          acceptedSubscriptionTerms: true,
        }),
      });
      const data = await response.json();
      if (!response.ok || !data?.url) throw new Error(data?.error || "Failed to start checkout.");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Failed to start checkout.");
      setProcessing(null);
    }
  }

  async function subscriptionAction(action: "cancel_trial" | "cancel_renewal" | "resume_renewal") {
    setProcessing(action);
    setError(null);
    try {
      const response = await fetch("/api/subscription/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error || "Failed to update subscription.");
      await load();
    } catch (err: any) {
      setError(err?.message || "Failed to update subscription.");
    } finally {
      setProcessing(null);
    }
  }

  async function openPortal() {
    setProcessing("MANAGE");
    setError(null);
    try {
      const response = await fetch("/api/stripe/portal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      const data = await response.json();
      if (!response.ok || !data?.url) throw new Error(data?.error || "Failed to open billing.");
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Failed to open billing.");
      setProcessing(null);
    }
  }

  const primaryDetail = (() => {
    if (currentState === "FREE_ACCESS") return `Access ends on ${freeAccessEndLabel || "the scheduled end date"}.`;
    if (currentState === "FREE_ACCESS_EXPIRED") return "Choose an Individual plan to continue full access.";
    if (currentState === "TRIALING") return `Trial ends on ${trialEndLabel || "the scheduled trial end date"}. Next charge: ${subscriptionPriceLabel} on ${firstChargeLabel}.`;
    if (currentState === "TRIAL_CANCELED") return `Your trial remains active until ${trialEndLabel || "the trial end date"}. You will not be billed.`;
    if (currentState === "ACTIVE") return `Renews on ${periodEndLabel || "the renewal date"}.`;
    if (currentState === "CANCEL_AT_PERIOD_END") return `Your plan remains active until ${periodEndLabel || "the period end date"}. It will not renew.`;
    if (currentState === "GRACE_PERIOD") return "Your payment needs attention. Access continues during the short grace period.";
    if (currentState === "PAST_DUE") return "Update billing to continue full access.";
    if (currentState === "PENDING_CHECKOUT") return "Activating checkout... we are confirming with Stripe. This usually takes a few seconds.";
    return "Review your current LocateFlow access.";
  })();
  const offerHeadline = publicCampaign?.publicHeadline || monthlyOffer?.publicHeadline || "Upgrade to Individual";
  const offerSubheadline =
    publicCampaign?.publicSubheadline ||
    monthlyOffer?.publicSubheadline ||
    (publicCampaign
      ? "Individual Annual, then annual billing."
      : monthlyOffer
        ? "Monthly billing starts today."
        : "Review the current Individual offer before checkout.");
  const offerTrialLabel = publicCampaign?.trialLabel || null;
  const offerCtaLabel =
    processing === "CHECKOUT"
      ? "Opening checkout..."
      : publicCampaign?.ctaText ||
        (currentState === "FREE_ACCESS" ? "Continue with annual" : "Upgrade to Individual Annual");
  const monthlyCtaLabel = processing === "MONTHLY_CHECKOUT"
    ? "Opening checkout..."
    : monthlyOffer?.ctaText || "Subscribe monthly";

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings" className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-muted-foreground transition hover:bg-foreground/5 hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscription</h1>
          <p className="text-sm text-muted-foreground">Manage Individual access and billing</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">{error}</div>
      ) : null}

      {waitingForActivation ? (
        <div className="rounded-2xl border border-tone-honey-br bg-tone-honey-bg p-5 text-tone-honey-fg">
          <p className="text-base font-medium">Activating your annual trial…</p>
          <p className="mt-1 text-sm text-tone-honey-fg/80">
            Stripe just confirmed your checkout. We are syncing your subscription — this usually takes a few seconds.
          </p>
        </div>
      ) : null}

      {loading ? (
        <div className="rounded-2xl border border-border bg-foreground/5 p-10 text-center text-muted-foreground">Loading subscription...</div>
      ) : (
        <>
          <div className="rounded-2xl border border-tone-orange-br bg-tone-orange-bg p-5 backdrop-blur-xl">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="rounded-xl border border-tone-orange-br bg-tone-orange-bg p-2.5">
                  <Crown className="h-5 w-5 text-tone-orange-fg" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-semibold text-foreground">{stateTitle(currentState, subscription)}</h2>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${statusBadge(currentState)}`}>
                      {statusLabel(currentState)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{primaryDetail}</p>
                  {currentState === "TRIALING" ? (
                    <p className="mt-1 text-sm text-muted-foreground">Auto-renewal: On</p>
                  ) : null}
                  {currentState === "ACTIVE" ? (
                    <p className="mt-1 text-sm text-muted-foreground">Auto-renewal: On</p>
                  ) : null}
                  {currentState === "TRIAL_CANCELED" || currentState === "CANCEL_AT_PERIOD_END" ? (
                    <p className="mt-1 text-sm text-muted-foreground">Auto-renewal: Off</p>
                  ) : null}
                </div>
              </div>
              <div className="flex flex-wrap gap-2 sm:justify-end">
                {currentState === "TRIALING" ? (
                  <button
                    type="button"
                    onClick={() => void subscriptionAction("cancel_trial")}
                    disabled={Boolean(processing)}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5 disabled:opacity-60"
                  >
                    {processing === "cancel_trial" ? "Updating..." : "Cancel trial"}
                  </button>
                ) : null}
                {currentState === "ACTIVE" ? (
                  <button
                    type="button"
                    onClick={() => void subscriptionAction("cancel_renewal")}
                    disabled={Boolean(processing)}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5 disabled:opacity-60"
                  >
                    {processing === "cancel_renewal" ? "Updating..." : "Cancel renewal"}
                  </button>
                ) : null}
                {(currentState === "TRIAL_CANCELED" || currentState === "CANCEL_AT_PERIOD_END") && subscription?.stripeSubscriptionId ? (
                  <button
                    type="button"
                    onClick={() => void subscriptionAction("resume_renewal")}
                    disabled={Boolean(processing)}
                    className="rounded-xl bg-tone-orange-fg px-4 py-2 text-sm font-medium text-white transition hover:bg-tone-orange-bg disabled:opacity-60"
                  >
                    {processing === "resume_renewal" ? "Updating..." : "Resume renewal"}
                  </button>
                ) : null}
                {canManageStripeBilling ? (
                  <button
                    type="button"
                    onClick={() => void openPortal()}
                    disabled={processing === "MANAGE"}
                    className="rounded-xl border border-border px-4 py-2 text-sm font-medium text-foreground transition hover:bg-foreground/5 disabled:opacity-60"
                  >
                    {processing === "MANAGE" ? "Opening..." : "Manage billing"}
                  </button>
                ) : null}
              </div>
              {storeManageHint ? (
                <p className="mt-3 text-xs text-muted-foreground">{storeManageHint}</p>
              ) : null}
            </div>
          </div>

          {showAnnualTrialOffer ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl border border-tone-emerald-br bg-tone-emerald-bg p-2.5">
                <Sparkles className="h-5 w-5 text-tone-emerald-fg" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">{offerHeadline}</h2>
                <p className="text-sm text-muted-foreground">{offerSubheadline}</p>
              </div>
            </div>

            <div className={publicCampaign && monthlyOffer ? "grid gap-4 md:grid-cols-2" : "space-y-4"}>
              {publicCampaign ? (
                <div className="rounded-2xl border border-tone-orange-br bg-tone-orange-bg p-6">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-tone-orange-fg">
                    Annual trial
                  </div>
                  <h3 className="text-lg font-bold text-foreground">{publicCampaign.publicHeadline}</h3>
                  {publicCampaign.publicSubheadline ? (
                    <p className="mt-1 text-sm text-muted-foreground">{publicCampaign.publicSubheadline}</p>
                  ) : null}

                  <div className="mt-4 grid gap-3 grid-cols-3">
                    <div className="rounded-xl border border-border bg-background/40 p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Today</p>
                      <p className="mt-1 text-xl font-bold text-foreground">$0</p>
                    </div>
                    {offerTrialLabel ? (
                      <div className="rounded-xl border border-border bg-background/40 p-3">
                        <p className="text-[11px] uppercase text-muted-foreground">Trial</p>
                        <p className="mt-1 text-xl font-bold text-foreground">{offerTrialLabel}</p>
                      </div>
                    ) : null}
                    <div className="rounded-xl border border-border bg-background/40 p-3">
                      <p className="text-[11px] uppercase text-muted-foreground">Annual plan starts</p>
                      <p className="mt-1 text-sm font-semibold text-foreground">{firstChargeLabel}</p>
                    </div>
                  </div>

                  <div className="mt-4 rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-tone-emerald-fg" />
                      <span>{publicCampaign.checkoutDisclosureCopy || checkoutDisclosure}</span>
                    </div>
                  </div>

                  <label className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={acceptedAnnualTerms}
                      onChange={(event) => setAcceptedAnnualTerms(event.target.checked)}
                    />
                    <span>{buildTrialConsentLabel(firstChargeDate)}</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => void startAnnualTrial()}
                    disabled={processing === "CHECKOUT" || !acceptedAnnualTerms}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-tone-orange-fg px-4 py-3 text-sm font-semibold text-white transition hover:bg-tone-orange-bg disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {offerCtaLabel}
                  </button>
                </div>
              ) : null}

              {monthlyOffer ? (
                <div className="rounded-2xl border border-border bg-foreground/5 p-6">
                  <div className="mb-1 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Monthly option
                  </div>
                  <div className="flex items-baseline justify-between gap-3">
                    <h3 className="text-lg font-bold text-foreground">
                      {monthlyOffer.publicHeadline || "Subscribe monthly"}
                    </h3>
                    <span className="text-2xl font-bold text-foreground">{monthlyOffer.displayPriceLabel}</span>
                  </div>
                  {monthlyOffer.publicSubheadline ? (
                    <p className="mt-1 text-sm text-muted-foreground">{monthlyOffer.publicSubheadline}</p>
                  ) : null}

                  <div className="mt-4 rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-tone-emerald-fg" />
                      <span>{monthlyDisclosure || `Today: ${monthlyOffer.displayPriceLabel}. Renews monthly until you cancel.`}</span>
                    </div>
                  </div>

                  <label className="mt-3 flex items-start gap-2 rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
                    <input
                      type="checkbox"
                      className="mt-0.5"
                      checked={acceptedMonthlyTerms}
                      onChange={(event) => setAcceptedMonthlyTerms(event.target.checked)}
                    />
                    <span>I understand my Individual Monthly subscription starts today and renews monthly until I cancel.</span>
                  </label>

                  <button
                    type="button"
                    onClick={() => void startMonthlyPlan()}
                    disabled={processing === "MONTHLY_CHECKOUT" || !acceptedMonthlyTerms}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-3 text-sm font-semibold text-foreground transition hover:bg-foreground/5 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Check className="h-4 w-4" />
                    {monthlyCtaLabel}
                  </button>
                </div>
              ) : null}
            </div>

            <div className="rounded-xl border border-border bg-background/40 p-3 text-xs text-muted-foreground">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span>Legal:</span>
                <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
                <Link href="/billing-policy" className="underline hover:text-foreground">Billing Policy</Link>
                <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
              </div>
            </div>
          </div>
          ) : null}
        </>
      )}

      {justUpgradedTier && (
        <RevealModal
          open={revealOpen}
          tier={justUpgradedTier}
          stickerStyle="medal"
          onClose={() => setRevealOpen(false)}
        />
      )}
    </div>
  );
}
