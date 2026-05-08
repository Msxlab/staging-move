"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bell,
  Building2,
  Download,
  FileText,
  Home,
  Languages,
  Map,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Truck,
  Wallet,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BILLING_PLAN_DEFINITIONS } from "@locateflow/shared";

type IndividualFeature = { icon: LucideIcon; label: string; desc: string };

const INDIVIDUAL_FEATURES: IndividualFeature[] = [
  { icon: Home, label: "Up to 10 homes", desc: "Primary, rental, family, second home — each with its own services." },
  { icon: Building2, label: "Service provider records", desc: "Account #, login, contract, contacts, auto-renewal." },
  { icon: Bell, label: "Bills & renewal reminders", desc: "Email + in-app alerts before due and renew dates." },
  { icon: Wallet, label: "Per-home monthly budgets", desc: "Planned vs actual, savings rate, category breakdown." },
  { icon: Truck, label: "Smart moving planner", desc: "From → to address, move date, auto-suggested move tasks." },
  { icon: FileText, label: "Document storage", desc: "Leases, bills, receipts, proof-of-address — attached per service." },
  { icon: Map, label: "US state-by-state guidance", desc: "DMV, voter, utility, tax & insurance notes for moves." },
  { icon: Smartphone, label: "Web + iOS + Android", desc: "One subscription, all devices, synced." },
  { icon: Languages, label: "English & Español", desc: "Full UI translations." },
  { icon: Download, label: "Export anytime (CSV & PDF)", desc: "Your data, downloadable whenever you want." },
];

function FeatureGrid() {
  return (
    <ul className="mt-2 grid gap-x-4 gap-y-3 text-sm sm:grid-cols-2">
      {INDIVIDUAL_FEATURES.map(({ icon: Icon, label, desc }) => (
        <li key={label} className="flex items-start gap-2.5">
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
            <Icon className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
          <span className="leading-snug">
            <span className="block font-medium text-foreground">{label}</span>
            <span className="block text-xs text-muted-foreground">{desc}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

function parseAmount(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/([0-9]+(?:\.[0-9]{1,2})?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function computeAnnualSavings(
  annualLabel: string | null | undefined,
  monthlyLabel: string | null | undefined,
): { savedUsd: number; percent: number } | null {
  const annual = parseAmount(annualLabel);
  const monthly = parseAmount(monthlyLabel);
  if (!annual || !monthly) return null;
  const yearOfMonthly = monthly * 12;
  if (yearOfMonthly <= annual) return null;
  const savedUsd = yearOfMonthly - annual;
  const percent = Math.round((savedUsd / yearOfMonthly) * 100);
  return { savedUsd, percent };
}

type PublicCampaignForPricing = {
  accessType?: string | null;
  publicHeadline: string;
  publicSubheadline: string | null;
  displayPriceLabel: string;
  trialDays: number | null;
  billingInterval?: string | null;
  ctaText: string;
  priceCopy: string;
  trialLabel: string | null;
};

type PublicOffersForPricing = {
  annualTrial?: PublicCampaignForPricing | null;
  monthlyPaid?: PublicCampaignForPricing | null;
};

interface PricingSectionProps {
  ctaHref: string;
  ctaLabelLoggedIn: boolean;
  ctaIntent?: "anonymous" | "manage" | "upgrade";
  campaign?: PublicCampaignForPricing | null;
  offers?: PublicOffersForPricing | null;
  headingLevel?: "h1" | "h2";
}

function resolveCtaLabel(
  intent: PricingSectionProps["ctaIntent"],
  loggedIn: boolean,
  campaign?: PublicCampaignForPricing | null,
): string {
  if (intent === "manage") return "Manage subscription";
  if (intent === "upgrade") return campaign?.ctaText || "Continue with annual";
  return loggedIn ? "Manage subscription" : campaign?.ctaText || "Create account";
}

function splitPriceLabel(label: string) {
  const [amount, suffix] = label.split("/");
  return {
    amount: amount || label,
    suffix: suffix ? `/${suffix}` : "",
  };
}

export function PricingSection({
  ctaHref,
  ctaLabelLoggedIn,
  ctaIntent,
  campaign,
  offers,
  headingLevel = "h2",
}: PricingSectionProps) {
  const plan = BILLING_PLAN_DEFINITIONS.INDIVIDUAL;
  const annualOffer = offers?.annualTrial ?? campaign ?? null;
  const monthlyOffer = offers?.monthlyPaid ?? null;
  const hasTwoOffers = Boolean(annualOffer && monthlyOffer);

  const [activePlan, setActivePlan] = useState<"yearly" | "monthly">(
    annualOffer ? "yearly" : monthlyOffer ? "monthly" : "yearly",
  );

  // If only one of the two offers is available, lock the toggle to it.
  const effectivePlan = !monthlyOffer
    ? "yearly"
    : !annualOffer
      ? "monthly"
      : activePlan;

  const yearlyPriceLabel =
    annualOffer?.displayPriceLabel || plan.yearlyPriceLabel || `$${plan.yearlyPriceUsd ?? 39.99}/year`;
  const monthlyPriceLabel: string = monthlyOffer
    ? monthlyOffer.displayPriceLabel
    : `$${plan.monthlyPriceUsd}/month`;

  const monthlyLabelForSavings = monthlyOffer
    ? monthlyOffer.displayPriceLabel
    : annualOffer
      ? `$${plan.monthlyPriceUsd}/month`
      : null;
  const annualSavings = annualOffer && monthlyLabelForSavings
    ? computeAnnualSavings(yearlyPriceLabel, monthlyLabelForSavings)
    : null;

  const headline =
    (effectivePlan === "monthly"
      ? monthlyOffer?.publicHeadline || annualOffer?.publicHeadline
      : annualOffer?.publicHeadline || monthlyOffer?.publicHeadline) || plan.displayName;

  const subheadline =
    (effectivePlan === "monthly"
      ? monthlyOffer?.publicSubheadline || annualOffer?.publicSubheadline
      : annualOffer?.publicSubheadline || monthlyOffer?.publicSubheadline) ||
    "One calm place to track addresses, services, renewal dates, moving tasks, and exports.";

  const yearlyPriceParts = splitPriceLabel(yearlyPriceLabel);
  const monthlyPriceParts = splitPriceLabel(monthlyPriceLabel);

  const yearlyIntro = annualOffer?.trialLabel
    ? `${annualOffer.trialLabel} free, then annual billing`
    : "Annual billing";

  const yearlyCtaLabel = resolveCtaLabel(ctaIntent, ctaLabelLoggedIn, annualOffer);
  const monthlyCtaLabel =
    ctaIntent === "manage" ? "Manage subscription" : monthlyOffer?.ctaText || "Subscribe monthly";

  const monthlyApproxYear = (() => {
    const m = parseAmount(monthlyPriceLabel);
    if (!m) return null;
    const a = parseAmount(yearlyPriceLabel);
    const yearOfMonthly = m * 12;
    if (a && yearOfMonthly <= a) return null;
    return yearOfMonthly;
  })();

  const Heading = headingLevel;

  const renderYearlyPanel = Boolean(annualOffer) || !monthlyOffer;
  const renderMonthlyPanel = Boolean(monthlyOffer);

  return (
    <section id="pricing" className="container py-20">
      <div className="mx-auto mb-10 max-w-2xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Individual
        </div>
        <Heading className="text-3xl font-bold mb-4">{headline}</Heading>
        <p className="text-muted-foreground text-lg">{subheadline}</p>
      </div>

      {hasTwoOffers ? (
        <div
          role="tablist"
          aria-label="Billing interval"
          className="mx-auto mb-8 flex max-w-sm items-center gap-1 rounded-full border bg-muted/30 p-1"
        >
          <button
            type="button"
            role="tab"
            id="tab-yearly"
            aria-selected={effectivePlan === "yearly"}
            aria-controls="panel-yearly"
            onClick={() => setActivePlan("yearly")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              effectivePlan === "yearly"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Annual
            {annualSavings ? (
              <span
                className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
                  effectivePlan === "yearly"
                    ? "bg-primary-foreground/15 text-primary-foreground"
                    : "bg-tone-emerald-bg text-tone-emerald-fg"
                }`}
              >
                Save {annualSavings.percent}%
              </span>
            ) : null}
          </button>
          <button
            type="button"
            role="tab"
            id="tab-monthly"
            aria-selected={effectivePlan === "monthly"}
            aria-controls="panel-monthly"
            onClick={() => setActivePlan("monthly")}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
              effectivePlan === "monthly"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Monthly
          </button>
        </div>
      ) : null}

      <div className="mx-auto max-w-2xl">
        <div className="flex flex-col rounded-2xl border-2 border-primary bg-card p-7 shadow-lg">
          {renderYearlyPanel ? (
            <div
              id={hasTwoOffers ? "panel-yearly" : undefined}
              role={hasTwoOffers ? "tabpanel" : undefined}
              aria-labelledby={hasTwoOffers ? "tab-yearly" : undefined}
              hidden={hasTwoOffers && effectivePlan !== "yearly"}
            >
              <div className="mb-5">
                <p className="text-sm font-medium text-primary">{yearlyIntro}</p>
                <h3 className="mt-2 text-2xl font-semibold">{plan.displayName}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Built for one person keeping household services and moving details organized.
                </p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold tracking-tight">{yearlyPriceParts.amount}</span>
                <span className="text-muted-foreground">
                  {annualOffer?.trialLabel ? `${yearlyPriceParts.suffix} after trial` : yearlyPriceParts.suffix}
                </span>
                {annualOffer?.trialLabel ? (
                  <p className="mt-1 text-xs text-muted-foreground">Today: $0</p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  {annualSavings ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-tone-emerald-br bg-tone-emerald-bg px-2.5 py-1 text-[11px] font-medium text-tone-emerald-fg">
                      Save ${annualSavings.savedUsd.toFixed(annualSavings.savedUsd % 1 === 0 ? 0 : 2)}/year vs monthly
                      <span className="text-tone-emerald-fg/70">({annualSavings.percent}% off)</span>
                    </span>
                  ) : null}
                  {annualOffer?.trialLabel ? (
                    <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                      <Sparkles className="h-3 w-3" /> First {annualOffer.trialLabel} free
                    </span>
                  ) : null}
                </div>
              </div>
            </div>
          ) : null}

          {renderMonthlyPanel ? (
            <div
              id={hasTwoOffers ? "panel-monthly" : undefined}
              role={hasTwoOffers ? "tabpanel" : undefined}
              aria-labelledby={hasTwoOffers ? "tab-monthly" : undefined}
              hidden={hasTwoOffers && effectivePlan !== "monthly"}
            >
              <div className="mb-5">
                <p className="text-sm font-medium text-primary">Monthly billing, no commitment</p>
                <h3 className="mt-2 text-2xl font-semibold">{plan.displayName}</h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Same Individual plan, billed monthly. Cancel anytime, no annual commitment.
                </p>
              </div>
              <div className="mb-6">
                <span className="text-5xl font-bold tracking-tight">{monthlyPriceParts.amount}</span>
                <span className="text-muted-foreground">{monthlyPriceParts.suffix}</span>
                {monthlyApproxYear ? (
                  <p className="mt-1 text-xs text-muted-foreground">
                    ≈ ${monthlyApproxYear.toFixed(monthlyApproxYear % 1 === 0 ? 0 : 2)}/year billed monthly
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
                    <ShieldCheck className="h-3 w-3" /> Cancel anytime
                  </span>
                </div>
              </div>
            </div>
          ) : null}

          <div className="rounded-xl border bg-background/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              Everything included
            </p>
            <FeatureGrid />
          </div>

          <div className="mt-auto pt-7">
            {renderYearlyPanel ? (
              <div hidden={hasTwoOffers && effectivePlan !== "yearly"}>
                <Link href={ctaHref} className="block">
                  <Button className="w-full">{yearlyCtaLabel}</Button>
                </Link>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  Trial length, price, renewal date, and payment method requirements are shown before you subscribe.
                </p>
              </div>
            ) : null}
            {renderMonthlyPanel ? (
              <div hidden={hasTwoOffers && effectivePlan !== "monthly"}>
                <Link href={ctaHref} className="block">
                  <Button className="w-full">{monthlyCtaLabel}</Button>
                </Link>
                <p className="mt-3 text-center text-[11px] text-muted-foreground">
                  No trial on monthly. Renews each month until you cancel from Settings.
                </p>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      <div className="mx-auto mt-6 max-w-2xl rounded-2xl border bg-muted/30 p-7">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Clear subscription terms</h3>
        </div>
        <div className="grid gap-4 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
          <p>Free Access and Free Trial are separate. Free Access does not require a payment method and does not auto-charge.</p>
          <p>The Individual Annual trial requires a payment method. Checkout shows today&apos;s due amount, trial length, first charge date, and annual renewal terms.</p>
          <p>The Individual Monthly option starts today and renews monthly when a monthly campaign is active.</p>
          <p>You can cancel trial or renewal online from Settings. Refund eligibility is handled under the Refund Policy and store rules when applicable.</p>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
          <Link href="/billing-policy" className="underline hover:text-foreground">Billing Policy</Link>
          <Link href="/refund" className="underline hover:text-foreground">Refund Policy</Link>
          <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
        </div>
      </div>
    </section>
  );
}
