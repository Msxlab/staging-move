import Link from "next/link";
import { Baby, Building2, Crown, MapPin, Users, Wrench } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BILLING_PLAN_DEFINITIONS } from "@locateflow/shared";

/**
 * Family & Pro tiers, rendered additively below the Individual PricingSection.
 *
 * Content is intentionally limited to capabilities that are real and enforced
 * today (seat/address/service limits, workspace membership + roles + invites,
 * child accounts). Aspirational/flag-gated features (Partner Hub & automatic
 * connectors, cross-member "shared services" visibility, address labels,
 * advanced export) are deliberately NOT advertised here — they are not
 * enforced yet and/or intersect the connector legal posture, so they wait for
 * the feature to ship + legal sign-off. Prices come from BILLING_PLAN_DEFINITIONS.
 *
 * The CTA routes to the same upgrade target as the Individual card (sign-up or
 * settings), where subscription terms are presented before checkout. Self-serve
 * purchase additionally requires the Family/Pro Stripe price IDs to be set.
 */

type PlanBullet = { icon: typeof Users; label: string };

const FAMILY_BULLETS: PlanBullet[] = [
  { icon: Users, label: "Up to 6 members (1 owner + 5)" },
  { icon: Building2, label: "17 addresses" },
  { icon: Wrench, label: "250 services" },
  { icon: Users, label: "Shared household workspace — invite members, assign roles" },
  { icon: Baby, label: "Child accounts (no financial visibility)" },
];

const PRO_BULLETS: PlanBullet[] = [
  { icon: Users, label: "Up to 10 members" },
  { icon: Building2, label: "25 addresses" },
  { icon: Wrench, label: "1,000 services" },
  { icon: Crown, label: "Everything in Family" },
  { icon: MapPin, label: "Built for multi-property owners and power users" },
];

interface WorkspacePlansSectionProps {
  /** Same upgrade target the Individual card uses (sign-up or settings). */
  ctaHref: string;
  /** Logged-in users see "Manage subscription"; visitors see "Create account". */
  loggedIn: boolean;
}

function priceLine(planId: "FAMILY" | "PRO"): string {
  const def = BILLING_PLAN_DEFINITIONS[planId];
  const monthly = `${def.priceLabel}${def.periodLabel}`;
  const yearly = def.yearlyPriceLabel ? ` · ${def.yearlyPriceLabel}` : "";
  return `${monthly}${yearly}`;
}

function PlanCard({
  name,
  tagline,
  planId,
  bullets,
  ctaHref,
  ctaLabel,
  highlight,
}: {
  name: string;
  tagline: string;
  planId: "FAMILY" | "PRO";
  bullets: PlanBullet[];
  ctaHref: string;
  ctaLabel: string;
  highlight?: boolean;
}) {
  return (
    <div
      className={`flex flex-col rounded-2xl border bg-card p-6 ${
        highlight ? "border-primary shadow-md" : "border-border"
      }`}
    >
      <div className="mb-1 flex items-center justify-between">
        <h3 className="text-xl font-semibold">{name}</h3>
        {highlight ? (
          <span className="rounded-full bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold text-primary">
            Most capacity
          </span>
        ) : null}
      </div>
      <p className="text-sm text-muted-foreground">{tagline}</p>
      <p className="mt-3 text-lg font-semibold tracking-tight">{priceLine(planId)}</p>
      <ul className="mt-4 flex-1 space-y-2.5 text-sm">
        {bullets.map(({ icon: Icon, label }) => (
          <li key={label} className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </span>
            <span className="leading-snug text-foreground">{label}</span>
          </li>
        ))}
      </ul>
      <div className="mt-6">
        <Link href={ctaHref} className="block">
          <Button variant={highlight ? "default" : "outline"} className="w-full">
            {ctaLabel}
          </Button>
        </Link>
      </div>
    </div>
  );
}

export function WorkspacePlansSection({ ctaHref, loggedIn }: WorkspacePlansSectionProps) {
  const ctaLabel = loggedIn ? "Manage subscription" : "Create account";

  return (
    <section id="family-pro" className="container pb-8">
      <div className="mx-auto mb-8 max-w-2xl text-center">
        <div className="mb-3 inline-flex items-center gap-2 rounded-full border bg-card px-3 py-1 text-xs font-medium text-muted-foreground">
          <Users className="h-3.5 w-3.5 text-primary" />
          Family &amp; Pro
        </div>
        <h2 className="text-2xl font-bold sm:text-3xl">Share one workspace with your household or team</h2>
        <p className="mt-3 text-muted-foreground">
          Everything in Individual, plus extra members, addresses, and services. Family and Pro are
          billed and managed on the web.
        </p>
      </div>

      <div className="mx-auto grid max-w-3xl gap-4 sm:grid-cols-2">
        <PlanCard
          name="Family"
          tagline="For households sharing a home and bills."
          planId="FAMILY"
          bullets={FAMILY_BULLETS}
          ctaHref={ctaHref}
          ctaLabel={ctaLabel}
        />
        <PlanCard
          name="Pro"
          tagline="For power users, portfolios, and home offices."
          planId="PRO"
          bullets={PRO_BULLETS}
          ctaHref={ctaHref}
          ctaLabel={ctaLabel}
          highlight
        />
      </div>

      <p className="mx-auto mt-4 max-w-3xl text-center text-[11px] text-muted-foreground">
        Subscription terms, price, and renewal are shown before you subscribe. Members each sign in
        with their own account; plans coordinate membership and roles and do not expose one
        member&apos;s financial details to another.
      </p>
    </section>
  );
}
