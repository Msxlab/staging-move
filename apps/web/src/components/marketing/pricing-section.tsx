"use client";

import { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Shield } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import {
  BILLING_PLAN_DEFINITIONS,
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
  const tPricing = useTranslations("pricing");
  const tBilling = useTranslations("billing");
  const tLanding = useTranslations("landing");
  const tErrors = useTranslations("errors");
  const tCommon = useTranslations("common");

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
        <h2 className="text-3xl font-bold mb-4">{tPricing("title")}</h2>
        <p className="text-muted-foreground text-lg">
          {tPricing("subtitle")} {tLanding("noCreditCard")}.
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
            type="button"
            role="tab"
            aria-selected={cycle === "monthly"}
            onClick={() => setCycle("monthly")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              cycle === "monthly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tBilling("cycle_monthly")}
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={cycle === "yearly"}
            onClick={() => setCycle("yearly")}
            className={`rounded-full px-5 py-1.5 text-sm font-medium transition-colors ${
              cycle === "yearly"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {tBilling("cycle_yearly")}
            <span className="ml-2 inline-flex items-center rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
              -{YEARLY_SAVINGS_PCT}%
            </span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 max-w-xl mx-auto">
        {/* Individual — the only live paid plan */}
        <div className="rounded-xl border-2 border-primary p-8 space-y-6 relative bg-card shadow-lg">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-semibold px-3 py-1 rounded-full">
            {tPricing("cta_current")}
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
              {ctaLabelLoggedIn ? tErrors("goToDashboard") : tPricing("cta_trial")}
            </Button>
          </Link>
          <p className="text-[11px] text-center text-muted-foreground">
            {tLanding("noCreditCard")} · {tLanding("cancelAnytime")}
          </p>
          <div className="rounded-lg border bg-muted/40 p-3 text-xs text-muted-foreground">
            <div className="mb-1 flex items-center justify-center gap-2 font-medium text-foreground">
              <Shield className="h-3.5 w-3.5" />
              Current product scope
            </div>
            LocateFlow provides local task tracking, provider directory
            guidance, and move organization. It does not update external
            provider accounts or guarantee provider availability at an
            address.
          </div>
        </div>
      </div>
    </section>
  );
}
