"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  BILLING_PLAN_DEFINITIONS,
  UPCOMING_BILLING_PLAN_DEFINITIONS,
  UPCOMING_BILLING_PLAN_ORDER,
  TRIAL_DURATION_DAYS,
} from "@locateflow/shared";

type Cycle = "monthly" | "yearly";

interface PricingSectionProps {
  ctaHref: string;
  ctaLabelLoggedIn: boolean;
}

// Savings label for the yearly toggle. Hard-coded from INDIVIDUAL's
// monthly vs yearly ratio — update here if plan prices change.
const YEARLY_SAVINGS_PCT = Math.round(
  (1 -
    BILLING_PLAN_DEFINITIONS.INDIVIDUAL.yearlyPriceUsd! /
      (BILLING_PLAN_DEFINITIONS.INDIVIDUAL.monthlyPriceUsd * 12)) *
    100,
);

export function PricingSection({ ctaHref, ctaLabelLoggedIn }: PricingSectionProps) {
  const [cycle, setCycle] = useState<Cycle>("yearly");

  const individual = BILLING_PLAN_DEFINITIONS.INDIVIDUAL;

  // Resolve Individual price based on toggle
  const individualPrice =
    cycle === "yearly" && individual.yearlyPriceLabel
      ? individual.yearlyPriceLabel.split("/")[0]
      : individual.priceLabel;
  const individualPeriod =
    cycle === "yearly" ? "/year" : individual.periodLabel;

  return (
    <section id="pricing" className="container py-20">
      <div className="text-center mb-10">
        <h2 className="text-3xl font-bold mb-4">Simple, Transparent Pricing</h2>
        <p className="text-muted-foreground text-lg">
          Start free, upgrade when you need more. No credit card for the{" "}
          {TRIAL_DURATION_DAYS}-day trial.
        </p>
      </div>

      {/* Monthly/Yearly toggle */}
      <div className="flex justify-center mb-12">
        <div
          role="tablist"
          aria-label="Billing cycle"
          className="inline-flex items-center rounded-full border bg-card p-1 shadow-sm"
        >
          <button
            role="tab"
            aria-selected={cycle === "monthly"}
            onClick={() => setCycle("monthly")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              cycle === "monthly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
          <button
            role="tab"
            aria-selected={cycle === "yearly"}
            onClick={() => setCycle("yearly")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              cycle === "yearly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Yearly
            <span className="ml-2 inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              Save {YEARLY_SAVINGS_PCT}%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
        {/* Individual — the only live paid plan */}
        <div className="rounded-xl border-2 border-primary p-8 space-y-6 relative bg-card shadow-lg md:scale-[1.02]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
            Available now
          </div>
          <div>
            <h3 className="text-xl font-semibold">{individual.displayName}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {individual.shortDescription}
            </p>
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold tracking-tight">
                {individualPrice}
              </span>
              <span className="text-muted-foreground">{individualPeriod}</span>
            </div>
            {cycle === "yearly" ? (
              <p className="text-xs text-muted-foreground mt-1">
                Billed annually · {individual.yearlyPriceLabel}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground mt-1">
                Billed monthly · cancel anytime
              </p>
            )}
          </div>
          <ul className="space-y-3 text-sm">
            {individual.features.map((f) => (
              <li key={f} className="flex items-start gap-2">
                <CheckCircle2 className="h-4 w-4 text-success mt-0.5 shrink-0" />
                <span>{f}</span>
              </li>
            ))}
          </ul>
          <Link
            href={`${ctaHref}${ctaHref.includes("?") ? "&" : "?"}cycle=${cycle}`}
            className="block"
          >
            <Button className="w-full">
              {ctaLabelLoggedIn ? "Go to Dashboard" : "Start Free Trial"}
            </Button>
          </Link>
          <p className="text-[11px] text-center text-muted-foreground">
            Free {TRIAL_DURATION_DAYS}-day trial · No credit card required
          </p>
        </div>

        {/* Coming-soon teasers */}
        {UPCOMING_BILLING_PLAN_ORDER.map((key) => {
          const plan = UPCOMING_BILLING_PLAN_DEFINITIONS[key];
          const price =
            cycle === "yearly" && plan.yearlyPriceLabel
              ? plan.yearlyPriceLabel.split("/")[0]
              : plan.priceLabel;
          const period = cycle === "yearly" ? "/year" : plan.periodLabel;
          return (
            <div
              key={plan.id}
              className="rounded-xl border p-8 space-y-6 relative bg-card/60 text-muted-foreground"
              aria-disabled="true"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-500/90 text-white text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1.5">
                <Sparkles className="h-3 w-3" /> Coming soon
              </div>
              <div>
                <h3 className="text-xl font-semibold text-foreground/80">
                  {plan.displayName}
                </h3>
                <p className="text-sm mt-1">{plan.shortDescription}</p>
              </div>
              <div>
                <div className="flex items-baseline gap-1">
                  <span className="text-5xl font-bold tracking-tight text-foreground/70">
                    {price}
                  </span>
                  <span>{period}</span>
                </div>
                {plan.yearlyPriceLabel ? (
                  <p className="text-xs mt-1">
                    {cycle === "yearly"
                      ? `Billed annually · ${plan.yearlyPriceLabel}`
                      : "Switch to yearly to save"}
                  </p>
                ) : null}
              </div>
              <ul className="space-y-3 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 opacity-40" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Button variant="outline" className="w-full" disabled>
                <Lock className="h-3.5 w-3.5 mr-2" /> Coming soon
              </Button>
              <p className="text-[11px] text-center">
                Want early access?{" "}
                <Link href="/contact" className="underline hover:text-foreground">
                  Let us know
                </Link>
              </p>
            </div>
          );
        })}
      </div>

      <p className="text-center text-xs text-muted-foreground mt-8">
        Prices in USD. Taxes may apply based on your region.
      </p>
    </section>
  );
}
