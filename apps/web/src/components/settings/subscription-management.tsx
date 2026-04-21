"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Check, Crown, Lock, Sparkles } from "lucide-react";
import {
  BILLING_PLAN_ORDER,
  BILLING_PLAN_DEFINITIONS,
  UPCOMING_BILLING_PLAN_ORDER,
  UPCOMING_BILLING_PLAN_DEFINITIONS,
  type UnifiedEntitlementSnapshot,
} from "@/lib/shared-billing";

type Cycle = "monthly" | "yearly";

type SubscriptionRecord = {
  plan?: string | null;
  status?: string | null;
  provider?: string | null;
  stripeCustomerId?: string | null;
  trialEndsAt?: string | null;
  currentPeriodEndsAt?: string | null;
  stripeCurrentPeriodEnd?: string | null;
  premiumUntil?: string | null;
};

type ProfileResponse = {
  subscription?: SubscriptionRecord | null;
  entitlement?: UnifiedEntitlementSnapshot | null;
};

function formatDateLabel(value?: string | null) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

function getProviderLabel(provider?: string | null) {
  switch (provider) {
    case "STRIPE":
      return "Managed in Stripe";
    case "APP_STORE":
      return "Managed in the App Store";
    case "PLAY_STORE":
      return "Managed in Google Play";
    case "ADMIN":
      return "Granted by admin";
    default:
      return "Trial access";
  }
}

export default function SubscriptionManagementPage() {
  const [subscription, setSubscription] = useState<SubscriptionRecord | null>(null);
  const [entitlement, setEntitlement] = useState<UnifiedEntitlementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [cycle, setCycle] = useState<Cycle>("yearly");

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch("/api/profile", { cache: "no-store" });
      const data = (await response.json()) as ProfileResponse & { error?: string };
      if (!response.ok) {
        throw new Error(data.error || "Failed to load subscription.");
      }
      setSubscription(data.subscription || null);
      setEntitlement(data.entitlement || null);
    } catch (err: any) {
      setError(err?.message || "Failed to load subscription.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void load();
  }, []);

  const currentPlanKey = entitlement?.plan || subscription?.plan || "FREE_TRIAL";
  const currentStatus = entitlement?.status || subscription?.status || "TRIALING";
  const currentProvider = entitlement?.provider || subscription?.provider || "TRIAL";
  const currentPlan = useMemo(() => {
    const definition = BILLING_PLAN_DEFINITIONS[currentPlanKey as keyof typeof BILLING_PLAN_DEFINITIONS];
    return definition || BILLING_PLAN_DEFINITIONS.FREE_TRIAL;
  }, [currentPlanKey]);
  const renewalLabel = formatDateLabel(
    entitlement?.currentPeriodEndsAt || subscription?.currentPeriodEndsAt || subscription?.stripeCurrentPeriodEnd || subscription?.premiumUntil
  );
  const trialLabel = formatDateLabel(entitlement?.trialEndsAt || subscription?.trialEndsAt);
  const canManageStripeBilling = currentProvider === "STRIPE" && !!subscription?.stripeCustomerId;

  async function startCheckout(plan: "INDIVIDUAL") {
    setProcessing(plan);
    setError(null);
    try {
      const response = await fetch("/api/stripe/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ plan, cycle }),
      });
      const data = await response.json();
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Failed to start checkout.");
      }
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Failed to start checkout.");
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
      if (!response.ok || !data?.url) {
        throw new Error(data?.error || "Failed to open the billing portal.");
      }
      window.location.href = data.url;
    } catch (err: any) {
      setError(err?.message || "Failed to open the billing portal.");
      setProcessing(null);
    }
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-8">
      <div className="flex items-center gap-4">
        <Link href="/settings" className="inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm text-white/50 transition hover:bg-white/5 hover:text-white">
          <ArrowLeft className="h-4 w-4" /> Back
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-white">Subscription</h1>
          <p className="text-sm text-white/40">Manage your plan across web, iOS, and Android</p>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="flex items-center justify-between rounded-2xl border border-orange-500/30 bg-orange-500/5 p-4 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-orange-500/20 bg-orange-500/10 p-2.5">
            <Crown className="h-5 w-5 text-orange-400" />
          </div>
          <div>
            <span className="text-sm font-medium text-white">{currentPlan.displayName}</span>
            <span className="block text-xs text-white/40">
              {renewalLabel
                ? `Renews: ${renewalLabel}`
                : trialLabel
                  ? `Trial ends: ${trialLabel}`
                  : getProviderLabel(currentProvider)}
            </span>
            <span className="mt-1 block text-[11px] text-white/30">{getProviderLabel(currentProvider)}</span>
          </div>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-[11px] font-medium ${currentStatus === "ACTIVE" || currentStatus === "TRIALING" ? "border border-emerald-500/20 bg-emerald-500/10 text-emerald-400" : "border border-white/10 bg-white/5 text-white/50"}`}>
          {currentStatus}
        </span>
      </div>

      <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-center backdrop-blur-xl">
        <Crown className="mx-auto h-8 w-8 text-orange-400" />
        <h2 className="mt-4 text-2xl font-bold text-white">One entitlement, every platform</h2>
        <p className="mx-auto mt-2 max-w-2xl text-sm text-white/50">
          Web billing stays on Stripe. iPhone and Android purchases are validated server-side and synced into the same entitlement record.
        </p>
      </div>

      {loading ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 p-10 text-center text-white/50">Loading subscription...</div>
      ) : (
        <>
          {/* Billing cycle toggle — applies to the Individual upgrade button
              and also makes Family/Pro teaser prices match what the user is
              comparing against. */}
          <div className="flex justify-center">
            <div
              role="tablist"
              aria-label="Billing cycle"
              className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1"
            >
              <button
                role="tab"
                aria-selected={cycle === "monthly"}
                onClick={() => setCycle("monthly")}
                className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${
                  cycle === "monthly"
                    ? "bg-orange-500 text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Monthly
              </button>
              <button
                role="tab"
                aria-selected={cycle === "yearly"}
                onClick={() => setCycle("yearly")}
                className={`rounded-full px-5 py-1.5 text-sm font-medium transition ${
                  cycle === "yearly"
                    ? "bg-orange-500 text-white"
                    : "text-white/50 hover:text-white"
                }`}
              >
                Yearly
                <span className="ml-2 inline-flex items-center rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                  Save 17%
                </span>
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            {BILLING_PLAN_ORDER.map((planKey) => {
              const plan = BILLING_PLAN_DEFINITIONS[planKey];
              const isCurrent = currentPlanKey === planKey;
              const isPaid = planKey === "INDIVIDUAL";
              const paidPlanKey = planKey === "INDIVIDUAL" ? planKey : null;

              const displayPrice =
                cycle === "yearly" && plan.yearlyPriceLabel
                  ? plan.yearlyPriceLabel.split("/")[0]
                  : plan.priceLabel;
              const displayPeriod = cycle === "yearly" ? "/year" : plan.periodLabel;

              return (
                <div key={planKey} className={`relative overflow-hidden rounded-2xl border bg-white/5 backdrop-blur-xl ${isCurrent ? "border-orange-500/40 ring-1 ring-orange-500/20" : "border-white/10"}`}>
                  {isCurrent ? (
                    <div className="absolute right-3 top-3">
                      <span className="flex items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/20 px-2 py-0.5 text-[9px] font-medium text-orange-300">
                        <Sparkles className="h-2.5 w-2.5" /> Current
                      </span>
                    </div>
                  ) : null}
                  <div className="p-5 pb-3">
                    <h3 className="text-base font-semibold text-white">{plan.displayName}</h3>
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-white">{displayPrice}</span>
                      <span className="text-sm text-white/40"> {displayPeriod}</span>
                    </div>
                    {cycle === "yearly" && plan.yearlyPriceLabel ? (
                      <span className="mt-1 block text-[11px] text-white/30">Billed as {plan.yearlyPriceLabel}</span>
                    ) : null}
                  </div>
                  <div className="space-y-3 px-5 pb-5">
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs text-white/60">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
                          {feature}
                        </li>
                      ))}
                    </ul>

                    {isCurrent ? (
                      canManageStripeBilling ? (
                        <button
                          type="button"
                          onClick={() => void openPortal()}
                          disabled={processing === "MANAGE"}
                          className="w-full rounded-xl border border-white/10 py-2 text-sm font-medium text-white transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {processing === "MANAGE" ? "Opening..." : "Manage Billing"}
                        </button>
                      ) : (
                        <button type="button" disabled className="w-full cursor-not-allowed rounded-xl border border-white/10 py-2 text-sm text-white/30">
                          Current Plan
                        </button>
                      )
                    ) : isPaid ? (
                      <button
                        type="button"
                        onClick={() => {
                          if (!paidPlanKey) return;
                          void startCheckout(paidPlanKey);
                        }}
                        disabled={processing === planKey}
                        className="w-full rounded-xl py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-60 bg-orange-500 text-white hover:bg-orange-600"
                      >
                        {processing === planKey
                          ? "Redirecting..."
                          : `Upgrade — ${cycle === "yearly" ? "yearly" : "monthly"}`}
                      </button>
                    ) : (
                      <button type="button" disabled className="w-full cursor-not-allowed rounded-xl border border-white/10 py-2 text-sm text-white/30">
                        Included by default
                      </button>
                    )}
                  </div>
                </div>
              );
            })}

            {/* Upcoming plan teasers — locked CTAs so the user sees the roadmap
                but can't try to subscribe to something that doesn't exist yet. */}
            {UPCOMING_BILLING_PLAN_ORDER.map((planKey) => {
              const plan = UPCOMING_BILLING_PLAN_DEFINITIONS[planKey];
              const displayPrice =
                cycle === "yearly" && plan.yearlyPriceLabel
                  ? plan.yearlyPriceLabel.split("/")[0]
                  : plan.priceLabel;
              const displayPeriod = cycle === "yearly" ? "/year" : plan.periodLabel;
              return (
                <div
                  key={planKey}
                  aria-disabled="true"
                  className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.02] backdrop-blur-xl"
                >
                  <div className="absolute right-3 top-3">
                    <span className="flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[9px] font-medium text-amber-300">
                      <Sparkles className="h-2.5 w-2.5" /> Coming soon
                    </span>
                  </div>
                  <div className="p-5 pb-3">
                    <h3 className="text-base font-semibold text-white/70">{plan.displayName}</h3>
                    <div className="mt-2">
                      <span className="text-2xl font-bold text-white/70">{displayPrice}</span>
                      <span className="text-sm text-white/30"> {displayPeriod}</span>
                    </div>
                    {cycle === "yearly" && plan.yearlyPriceLabel ? (
                      <span className="mt-1 block text-[11px] text-white/30">Billed as {plan.yearlyPriceLabel}</span>
                    ) : null}
                  </div>
                  <div className="space-y-3 px-5 pb-5">
                    <ul className="space-y-2">
                      {plan.features.map((feature) => (
                        <li key={feature} className="flex items-start gap-2 text-xs text-white/50">
                          <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-white/30" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/contact"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-sm font-medium text-white/50 transition hover:bg-white/5"
                    >
                      <Lock className="h-3.5 w-3.5" /> Notify me at launch
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
