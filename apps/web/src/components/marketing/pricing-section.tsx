"use client";

import { useEffect, useState, type ComponentType } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";
import {
  Baby,
  Bell,
  Building2,
  Car,
  CheckCircle2,
  CloudRain,
  Crown,
  Download,
  FileText,
  Headset,
  Home,
  Map,
  ShieldCheck,
  Sparkles,
  Truck,
  Users,
  Wallet,
  Wifi,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { BILLING_PLAN_DEFINITIONS, billingPriceLabelForInterval } from "@locateflow/shared";
import { PlanCompareTable } from "./plan-compare-table";

type BillingCycle = "yearly" | "monthly";
type PaidPlanId = "INDIVIDUAL" | "FAMILY" | "PRO";
type Feature = { icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>; label: string };

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
  /**
   * CONSUMER_FREE pivot: when true, the whole paid 3-tier/billing-cycle layout is
   * replaced by one active "Free — everything included" card plus coming-soon
   * Concierge/Business placeholders (no price, no checkout). The server page reads
   * isFeatureEnabled(CONSUMER_FREE) and passes the resolved boolean. Off (default)
   * → the original paid layout renders unchanged (fully reversible).
   */
  consumerFree?: boolean;
}

const PLAN_FEATURES: Record<PaidPlanId, Feature[]> = {
  INDIVIDUAL: [
    { icon: Home, label: "Up to 10 homes" },
    { icon: Building2, label: "100 service provider records" },
    { icon: Map, label: "New Home Dossier: flood zone, school district & moving-day weather" },
    { icon: Car, label: "Vehicle VIN decode & NHTSA recall check" },
    { icon: CloudRain, label: "Move-week weather alerts & weekly digest" },
    { icon: Wifi, label: "Smart provider suggestions with FCC broadband & utility data (where available)" },
    { icon: Bell, label: "Bills and renewal reminders" },
    { icon: Wallet, label: "Per-home monthly budgets" },
    { icon: Truck, label: "Smart moving planner" },
    { icon: Building2, label: "Custom providers" },
    { icon: Download, label: "CSV and PDF export" },
  ],
  FAMILY: [
    { icon: Users, label: "Up to 6 members (you + 5)" },
    { icon: Building2, label: "15 addresses" },
    { icon: Wrench, label: "500 services" },
    { icon: Sparkles, label: "AI move briefing when available — your move, explained" },
    { icon: Map, label: "Real map on route & address cards" },
    { icon: Map, label: "New Home Dossier: flood zone, school district & moving-day weather" },
    { icon: Wifi, label: "Smart provider suggestions with FCC broadband & utility data (where available)" },
    { icon: Users, label: "Shared household workspace" },
    { icon: ShieldCheck, label: "Member roles and invites" },
    { icon: Baby, label: "Child accounts" },
    { icon: Download, label: "CSV and PDF export" },
  ],
  PRO: [
    { icon: Crown, label: "Everything in Family" },
    { icon: Users, label: "Up to 10 members" },
    { icon: Building2, label: "25 addresses" },
    { icon: Wrench, label: "1,000 services" },
    { icon: Truck, label: "FMCSA-registered mover suggestions" },
    { icon: FileText, label: "New Home Dossier PDF export" },
    { icon: Map, label: "Up to 3 concurrent move plans" },
    { icon: FileText, label: "Tax & property export (CSV + PDF)" },
    { icon: Headset, label: "Priority support" },
  ],
};

const PLAN_COPY: Record<PaidPlanId, { kicker: string; description: string; badge?: string }> = {
  INDIVIDUAL: {
    kicker: "For one person",
    description: "Track addresses, services, renewals, move tasks, and budgets in one calm place.",
    badge: "Most popular",
  },
  FAMILY: {
    kicker: "For households",
    description: "Share one household workspace with members, roles, more addresses, and more tracked services.",
  },
  PRO: {
    kicker: "For power users",
    description: "Higher limits for multi-property owners, portfolios, home offices, and heavier workflows.",
    badge: "Most capacity",
  },
};

function parseAmount(label: string | null | undefined): number | null {
  if (!label) return null;
  const match = label.match(/([0-9]+(?:\.[0-9]{1,2})?)/);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return Number.isFinite(value) ? value : null;
}

function splitPriceLabel(label: string) {
  const [amount, ...suffixParts] = label.split("/");
  const suffix = suffixParts.length ? `/${suffixParts.join("/")}` : "";
  return { amount: amount || label, suffix };
}

function annualSavings(planId: PaidPlanId, annualLabel: string, monthlyLabel: string) {
  const annual = parseAmount(annualLabel);
  const monthly = parseAmount(monthlyLabel);
  if (!annual || !monthly) return null;
  const monthlyYear = monthly * 12;
  if (monthlyYear <= annual) return null;
  return {
    savedUsd: monthlyYear - annual,
    percent: Math.round(((monthlyYear - annual) / monthlyYear) * 100),
    planId,
  };
}

function formatSavingsAmount(value: number): string {
  return value.toFixed(value % 1 === 0 ? 0 : 2);
}

function priceLabelForPlan(
  planId: PaidPlanId,
  cycle: BillingCycle,
  annualOffer: PublicCampaignForPricing | null,
  monthlyOffer: PublicCampaignForPricing | null,
): string {
  const def = BILLING_PLAN_DEFINITIONS[planId];
  if (cycle === "monthly") {
    if (planId === "INDIVIDUAL" && monthlyOffer) return monthlyOffer.displayPriceLabel;
    return billingPriceLabelForInterval(planId, "MONTH");
  }
  if (planId === "INDIVIDUAL" && annualOffer) return annualOffer.displayPriceLabel;
  return def.yearlyPriceLabel || billingPriceLabelForInterval(planId, "YEAR");
}

function planHref(href: string, planId: PaidPlanId, cycle: BillingCycle): string {
  if (!href.startsWith("/")) return href;
  const [path, rawQuery = ""] = href.split("?");
  const params = new URLSearchParams(rawQuery);
  params.set("plan", planId);
  params.set("billingInterval", cycle === "monthly" ? "MONTH" : "YEAR");
  return `${path}?${params.toString()}`;
}

function ctaLabelForPlan(
  planId: PaidPlanId,
  cycle: BillingCycle,
  props: {
    intent: PricingSectionProps["ctaIntent"];
    loggedIn: boolean;
    annualOffer: PublicCampaignForPricing | null;
    monthlyOffer: PublicCampaignForPricing | null;
  },
): string {
  if (props.intent === "manage") return "Manage subscription";
  if (planId === "INDIVIDUAL" && cycle === "yearly" && props.annualOffer?.ctaText) {
    return props.annualOffer.ctaText;
  }
  if (planId === "INDIVIDUAL" && cycle === "monthly" && props.monthlyOffer?.ctaText) {
    return props.monthlyOffer.ctaText;
  }
  if (props.loggedIn || props.intent === "upgrade") return `Choose ${BILLING_PLAN_DEFINITIONS[planId].displayName}`;
  return planId === "INDIVIDUAL" && cycle === "yearly" ? "Get started" : `Choose ${BILLING_PLAN_DEFINITIONS[planId].displayName}`;
}

function BillingTabs({
  active,
  onChange,
  bestSavings,
}: {
  active: BillingCycle;
  onChange: (next: BillingCycle) => void;
  bestSavings: number | null;
}) {
  return (
    <div
      role="group"
      aria-label="Billing interval"
      className="mx-auto mb-8 flex max-w-sm items-center gap-1 rounded-full border bg-muted/30 p-1"
    >
      <button
        type="button"
        aria-pressed={active === "yearly"}
        onClick={() => onChange("yearly")}
        className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          active === "yearly"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Annual
        {bestSavings ? (
          <span
            className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold ${
              active === "yearly"
                ? "bg-primary-foreground/15 text-primary-foreground"
                : "bg-tone-emerald-bg text-tone-emerald-fg"
            }`}
          >
            Best value - save up to {bestSavings}%
          </span>
        ) : null}
      </button>
      <button
        type="button"
        aria-pressed={active === "monthly"}
        onClick={() => onChange("monthly")}
        className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition-colors ${
          active === "monthly"
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-muted-foreground hover:text-foreground"
        }`}
      >
        Monthly
      </button>
    </div>
  );
}

function PlanCard({
  planId,
  cycle,
  ctaHref,
  ctaLabel,
  annualOffer,
  monthlyOffer,
}: {
  planId: PaidPlanId;
  cycle: BillingCycle;
  ctaHref: string;
  ctaLabel: string;
  annualOffer: PublicCampaignForPricing | null;
  monthlyOffer: PublicCampaignForPricing | null;
}) {
  const def = BILLING_PLAN_DEFINITIONS[planId];
  const copy = PLAN_COPY[planId];
  const priceLabel = priceLabelForPlan(planId, cycle, annualOffer, monthlyOffer);
  const price = splitPriceLabel(priceLabel);
  const savings = annualSavings(
    planId,
    priceLabelForPlan(planId, "yearly", annualOffer, monthlyOffer),
    priceLabelForPlan(planId, "monthly", annualOffer, monthlyOffer),
  );
  const isIndividualTrial = planId === "INDIVIDUAL" && cycle === "yearly" && Boolean(annualOffer?.trialLabel);
  const isHighlighted = planId === "INDIVIDUAL";
  const badge = isIndividualTrial ? `${annualOffer?.trialLabel} free` : copy.badge;

  return (
    <article
      className={`flex h-full flex-col rounded-2xl border bg-card p-6 shadow-sm ${
        isHighlighted ? "border-primary shadow-md" : "border-border"
      }`}
    >
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-primary">{copy.kicker}</p>
          {badge ? (
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                planId === "PRO"
                  ? "bg-tone-foil-bg text-tone-foil-fg"
                  : "bg-primary/10 text-primary"
              }`}
            >
              {badge}
            </span>
          ) : null}
        </div>
        <h3 className="text-2xl font-semibold">{def.displayName}</h3>
        <p className="mt-2 min-h-[3rem] text-sm leading-6 text-muted-foreground">{copy.description}</p>
      </div>

      <div className="mb-5">
        <span className="text-4xl font-bold tracking-tight">{price.amount}</span>
        <span className="text-sm text-muted-foreground">
          {isIndividualTrial ? `${price.suffix} after trial` : price.suffix}
        </span>
        {isIndividualTrial ? <p className="mt-1 text-xs text-muted-foreground">Today: $0</p> : null}
        {cycle === "yearly" && savings ? (
          <p className="mt-2 text-xs font-medium text-tone-emerald-fg">
            Save ${formatSavingsAmount(savings.savedUsd)}/year vs monthly ({savings.percent}% off)
          </p>
        ) : null}
        {cycle === "monthly" ? (
          <p className="mt-2 text-xs text-muted-foreground">Billed monthly. Cancel anytime.</p>
        ) : null}
      </div>

      <ul className="grid flex-1 gap-2.5 text-sm">
        {PLAN_FEATURES[planId].map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-3.5 w-3.5" aria-hidden />
            </span>
            <span className="leading-snug">{label}</span>
          </li>
        ))}
      </ul>

      <div className="mt-6">
        {/* Pro wears the champagne foil — the one premium moment on this
            grid. Individual keeps the highlighted primary fill. */}
        <Button
          asChild
          variant={planId === "PRO" ? "foil" : isHighlighted ? "default" : "outline"}
          className="w-full"
        >
          <Link href={planHref(ctaHref, planId, cycle)}>
            {ctaLabel}
          </Link>
        </Button>
      </div>
    </article>
  );
}

// CONSUMER_FREE: every feature is included for everyone now, so the Free card
// lists the breadth of the product (drawn from the former paid tiers) rather
// than a metered subset.
const FREE_INCLUDED: Feature[] = [
  { icon: Home, label: "All your homes & addresses" },
  { icon: Map, label: "New Home Dossier: flood, schools, weather, hazards, radon, air & more" },
  { icon: Sparkles, label: "AI move briefing — your move, explained" },
  { icon: Wifi, label: "Smart, data-checked provider suggestions (FCC broadband & utility data where available)" },
  { icon: Truck, label: "FMCSA-registered mover suggestions & smart moving planner" },
  { icon: Map, label: "Real route maps, per-home budgets, reminders & checklists" },
  { icon: Users, label: "Shared household workspace, member roles & child accounts" },
  { icon: Download, label: "New Home Dossier PDF + CSV/PDF export" },
];

type ComingSoonOffer = {
  key: "concierge" | "business";
  name: string;
  kicker: string;
  description: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
};

const COMING_SOON_OFFERS: ComingSoonOffer[] = [
  {
    key: "concierge",
    name: "Concierge",
    kicker: "Coming soon",
    description:
      "Done-for-you moving help: a real concierge handles setup, transfers, and scheduling so you don't have to.",
    icon: Headset,
  },
  {
    key: "business",
    name: "Business",
    kicker: "Coming soon",
    description:
      "Tools for movers, agents & partners — qualified leads, a partner dashboard, and sponsored placements.",
    icon: Building2,
  },
];

// Module-scoped: dedupe offer_viewed impressions to once per offer per page
// session, so SPA re-mounts don't flood analytics (audit P2-12).
const firedOfferImpressions = new Set<string>();

function ComingSoonCard({ offer }: { offer: ComingSoonOffer }) {
  const [interested, setInterested] = useState(false);
  const Icon = offer.icon;

  const handleInterest = () => {
    if (interested) return;
    // The interest event IS the capture mechanism for now (a full waitlist is a
    // later monetization step). concierge gets its own dedicated signal too.
    trackEvent("offer_clicked", { offer_key: offer.key, surface: "pricing" });
    if (offer.key === "concierge") {
      trackEvent("concierge_interest_clicked", { surface: "pricing" });
    }
    setInterested(true);
  };

  return (
    <article className="flex h-full flex-col rounded-2xl border border-dashed border-border bg-muted/20 p-6">
      <div className="mb-5">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{offer.kicker}</p>
          <span className="rounded-full bg-muted px-2.5 py-0.5 text-[11px] font-semibold text-muted-foreground">
            Not yet available
          </span>
        </div>
        <h3 className="flex items-center gap-2 text-2xl font-semibold text-muted-foreground">
          <Icon className="h-5 w-5" aria-hidden />
          {offer.name}
        </h3>
        <p className="mt-2 min-h-[3rem] text-sm leading-6 text-muted-foreground">{offer.description}</p>
      </div>
      <div className="mt-auto">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleInterest}
          disabled={interested}
          aria-pressed={interested}
        >
          {interested ? "Thanks — we'll be in touch" : "I'm interested"}
        </Button>
      </div>
    </article>
  );
}

function ConsumerFreePricing({
  ctaHref,
  headingLevel,
}: {
  ctaHref: string;
  headingLevel: "h1" | "h2";
}) {
  const Heading = headingLevel;

  useEffect(() => {
    // One impression per coming-soon offer PER PAGE SESSION — guard against
    // re-mounts (SPA navigation, StrictMode double-invoke) flooding UserEvent
    // rows on a high-traffic page (audit P2-12).
    COMING_SOON_OFFERS.forEach((offer) => {
      if (firedOfferImpressions.has(offer.key)) return;
      firedOfferImpressions.add(offer.key);
      trackEvent("offer_viewed", { offer_key: offer.key, surface: "pricing" });
    });
  }, []);

  return (
    <section id="pricing" className="container py-20">
      <div className="mx-auto mb-10 max-w-3xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Free — every feature included
        </div>
        <Heading className="mb-4 text-3xl font-bold">LocateFlow is free for your whole move</Heading>
        <p className="text-lg text-muted-foreground">
          No subscription, no credit card. Every feature, for every move — Concierge and Business are on the way.
        </p>
      </div>

      <div
        id="pricing-plan-grid"
        aria-label="Plans"
        className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3"
      >
        {/* Active Free card */}
        <article className="flex h-full flex-col rounded-2xl border border-primary bg-card p-6 shadow-md">
          <div className="mb-5">
            <div className="mb-2 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-primary">For everyone</p>
              <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
                Everything included
              </span>
            </div>
            <h3 className="text-2xl font-semibold">Free</h3>
            <p className="mt-2 min-h-[3rem] text-sm leading-6 text-muted-foreground">
              The complete LocateFlow — every home, every feature, no limits to unlock.
            </p>
          </div>

          <div className="mb-5">
            <span className="text-4xl font-bold tracking-tight">$0</span>
            <span className="text-sm text-muted-foreground">/forever</span>
            <p className="mt-2 text-xs text-muted-foreground">No credit card. No trial to expire.</p>
          </div>

          <ul className="grid flex-1 gap-2.5 text-sm">
            {FREE_INCLUDED.map(({ icon: Icon, label }) => (
              <li key={label} className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" aria-hidden />
                </span>
                <span className="leading-snug">{label}</span>
              </li>
            ))}
          </ul>

          <div className="mt-6">
            <Button asChild variant="default" className="w-full">
              <Link href={ctaHref}>Get started free</Link>
            </Button>
          </div>
        </article>

        {COMING_SOON_OFFERS.map((offer) => (
          <ComingSoonCard key={offer.key} offer={offer} />
        ))}
      </div>

      <p className="mx-auto mt-8 max-w-3xl text-center text-sm text-muted-foreground">
        LocateFlow tracks your services and move workflow. It does not log into or change your accounts with any
        provider on your behalf — it gives you guided checklists, reminders, and links so you update each provider
        yourself through their official channel.
      </p>

      <div className="mx-auto mt-6 flex max-w-4xl flex-wrap justify-center gap-x-5 gap-y-2 text-sm">
        <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
        <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
      </div>
    </section>
  );
}

export function PricingSection({
  ctaHref,
  ctaLabelLoggedIn,
  ctaIntent,
  campaign,
  offers,
  headingLevel = "h2",
  consumerFree = false,
}: PricingSectionProps) {
  if (consumerFree) {
    return <ConsumerFreePricing ctaHref={ctaHref} headingLevel={headingLevel} />;
  }
  const annualOffer = offers?.annualTrial ?? campaign ?? null;
  const monthlyOffer = offers?.monthlyPaid ?? null;
  const [billingCycle, setBillingCycle] = useState<BillingCycle>("yearly");
  const Heading = headingLevel;

  const allSavings = (["INDIVIDUAL", "FAMILY", "PRO"] as PaidPlanId[])
    .map((planId) =>
      annualSavings(
        planId,
        priceLabelForPlan(planId, "yearly", annualOffer, monthlyOffer),
        priceLabelForPlan(planId, "monthly", annualOffer, monthlyOffer),
      ),
    )
    .filter(Boolean) as Array<{ percent: number }>;
  const bestSavings = allSavings.length
    ? Math.max(...allSavings.map((entry) => entry.percent))
    : null;

  const headline =
    billingCycle === "yearly"
      ? annualOffer?.publicHeadline || "Simple pricing for every move and household"
      : monthlyOffer?.publicHeadline || "Monthly plans when you want flexibility";
  const subheadline =
    billingCycle === "yearly"
      ? annualOffer?.publicSubheadline || "Save with annual billing across Individual, Family, and Pro."
      : monthlyOffer?.publicSubheadline || "Start monthly and keep the same address, service, reminder, and document workflows.";

  return (
    <section id="pricing" className="container py-20">
      <div className="mx-auto mb-10 max-w-3xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          Individual, Family, Pro
        </div>
        <Heading className="mb-4 text-3xl font-bold">{headline}</Heading>
        <p className="text-lg text-muted-foreground">{subheadline}</p>
      </div>

      <BillingTabs active={billingCycle} onChange={setBillingCycle} bestSavings={bestSavings} />

      <div
        id="pricing-plan-grid"
        aria-label={`Plans — ${billingCycle === "yearly" ? "annual" : "monthly"} billing`}
        className="mx-auto grid max-w-6xl gap-5 lg:grid-cols-3"
      >
        {(["INDIVIDUAL", "FAMILY", "PRO"] as PaidPlanId[]).map((planId) => (
          <PlanCard
            key={planId}
            planId={planId}
            cycle={billingCycle}
            ctaHref={ctaHref}
            ctaLabel={ctaLabelForPlan(planId, billingCycle, {
              intent: ctaIntent,
              loggedIn: ctaLabelLoggedIn,
              annualOffer,
              monthlyOffer,
            })}
            annualOffer={annualOffer}
            monthlyOffer={monthlyOffer}
          />
        ))}
      </div>

      {/* Honest side-by-side matrix under the cards. Includes the Free tier
          (which has no card above) and derives every cell from the enforced
          plan constants — see plan-compare-table.tsx for the source map. */}
      <PlanCompareTable />

      <div className="mx-auto mt-6 max-w-4xl rounded-2xl border bg-muted/30 p-6">
        <div className="mb-4 flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Clear subscription terms</h3>
        </div>
        <div className="grid gap-4 text-sm leading-6 text-muted-foreground sm:grid-cols-2">
          <p>Free Access and Free Trial are separate. Free Access does not require a payment method and does not auto-charge.</p>
          <p>Checkout shows today&apos;s due amount, billing interval, renewal terms, and first charge date before you subscribe.</p>
          <p>Annual Individual trial terms are shown before payment. Monthly plans renew monthly until canceled.</p>
          <p>Family and Pro require web billing. If a price is not configured, checkout will tell you before any subscription is created.</p>
          <p className="sm:col-span-2">
            Smart provider suggestions with FCC broadband &amp; utility data are included on Individual and up. Free gets
            provider suggestions from our catalog. Where shown, FCC suggestions reflect coverage reported by providers to
            the FCC at the area level — reported coverage data, not a guarantee of service at your address.
          </p>
        </div>
        <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm">
          <Link href="/terms" className="underline hover:text-foreground">Terms</Link>
          <Link href="/billing-policy" className="underline hover:text-foreground">Billing Policy</Link>
          <Link href="/refund" className="underline hover:text-foreground">Refund Policy</Link>
          <Link href="/privacy" className="underline hover:text-foreground">Privacy Policy</Link>
        </div>
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-[11px] text-muted-foreground">
        LocateFlow tracks your services and move workflow. It does not log into or change your accounts with any provider on your behalf — it gives you guided checklists, reminders, and links so you update each provider yourself through their official channel.
      </p>
    </section>
  );
}
