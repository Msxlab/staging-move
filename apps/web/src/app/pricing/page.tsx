import Link from "next/link";
import { Check, Lock, Sparkles } from "lucide-react";
import {
  BILLING_PLAN_ORDER,
  BILLING_PLAN_DEFINITIONS,
  UPCOMING_BILLING_PLAN_ORDER,
  UPCOMING_BILLING_PLAN_DEFINITIONS,
} from "@/lib/shared-billing";
import { getUserSession } from "@/lib/user-auth";

export default async function PricingPage() {
  const session = await getUserSession();
  const ctaHref = session ? "/settings/subscription" : "/sign-up";
  const ctaLabel = session ? "Manage subscription" : "Start free trial";

  return (
    <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col px-6 py-12">
      <div className="mx-auto max-w-3xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-orange-300">
          <Sparkles className="h-3.5 w-3.5" /> Pricing
        </div>
        <h1 className="mt-6 text-4xl font-bold tracking-tight text-white md:text-5xl">
          One plan today, more on the way
        </h1>
        <p className="mx-auto mt-4 max-w-2xl text-base text-white/60">
          Start with the free trial and upgrade to Individual when you&apos;re
          ready. Family and Pro are rolling out next — click{" "}
          <Link href="/contact" className="underline hover:text-white">let us know</Link>{" "}
          to be notified at launch.
        </p>
      </div>

      <div className="mt-12 grid gap-6 md:grid-cols-2 xl:grid-cols-4">
        {/* Available plans (FREE_TRIAL + INDIVIDUAL) */}
        {BILLING_PLAN_ORDER.map((planKey) => {
          const plan = BILLING_PLAN_DEFINITIONS[planKey];
          const isPopular = planKey === "INDIVIDUAL";
          return (
            <div
              key={planKey}
              className={`relative overflow-hidden rounded-3xl border bg-white/5 p-6 backdrop-blur-xl ${isPopular ? "border-orange-500/40 ring-1 ring-orange-500/20" : "border-white/10"}`}
            >
              {isPopular ? (
                <div className="absolute right-4 top-4 rounded-full border border-orange-500/30 bg-orange-500/20 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-orange-200">
                  Most popular
                </div>
              ) : null}
              <div>
                <p className="text-sm font-medium text-white/60">{plan.displayName}</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-bold text-white">{plan.priceLabel}</span>
                  <span className="pb-1 text-sm text-white/40">{plan.periodLabel}</span>
                </div>
                {plan.yearlyPriceLabel ? (
                  <p className="mt-2 text-sm text-white/40">or {plan.yearlyPriceLabel}</p>
                ) : null}
                <p className="mt-4 text-sm text-white/50">{plan.shortDescription}</p>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-white/70">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-emerald-400" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href={ctaHref}
                  className={`inline-flex w-full items-center justify-center rounded-2xl px-4 py-3 text-sm font-semibold transition ${planKey === "INDIVIDUAL" ? "bg-orange-500 text-white hover:bg-orange-600" : "border border-white/10 text-white/70 hover:bg-white/5"}`}
                >
                  {planKey === "FREE_TRIAL" ? ctaLabel : `Choose ${plan.displayName}`}
                </Link>
              </div>
            </div>
          );
        })}

        {/* Upcoming plans — teaser cards */}
        {UPCOMING_BILLING_PLAN_ORDER.map((planKey) => {
          const plan = UPCOMING_BILLING_PLAN_DEFINITIONS[planKey];
          return (
            <div
              key={planKey}
              aria-disabled="true"
              className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/[0.02] p-6 backdrop-blur-xl"
            >
              <div className="absolute right-4 top-4 rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-200">
                Coming soon
              </div>
              <div>
                <p className="text-sm font-medium text-white/50">{plan.displayName}</p>
                <div className="mt-3 flex items-end gap-2">
                  <span className="text-4xl font-bold text-white/60">{plan.priceLabel}</span>
                  <span className="pb-1 text-sm text-white/30">{plan.periodLabel}</span>
                </div>
                {plan.yearlyPriceLabel ? (
                  <p className="mt-2 text-sm text-white/30">or {plan.yearlyPriceLabel}</p>
                ) : null}
                <p className="mt-4 text-sm text-white/40">{plan.shortDescription}</p>
              </div>
              <ul className="mt-6 space-y-3">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-3 text-sm text-white/50">
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-white/30" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-8">
                <Link
                  href="/contact"
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-white/10 px-4 py-3 text-sm font-semibold text-white/60 transition hover:bg-white/5"
                >
                  <Lock className="h-3.5 w-3.5" />
                  Notify me at launch
                </Link>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
