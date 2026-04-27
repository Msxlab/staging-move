import { Sparkles, UsersRound, User, Hourglass } from "lucide-react";

type Tier = "INDIVIDUAL" | "FAMILY" | "PRO" | "FREE_TRIAL";

const TIER_META: Record<
  Tier,
  { label: string; Icon: typeof Sparkles; classExt: string; title: string }
> = {
  FREE_TRIAL: { label: "TRIAL", Icon: Hourglass, classExt: "tier-trial", title: "Free trial" },
  INDIVIDUAL: { label: "INDV", Icon: User, classExt: "tier-individual", title: "Individual plan" },
  FAMILY: { label: "FAM", Icon: UsersRound, classExt: "tier-family", title: "Family plan" },
  PRO: { label: "PRO", Icon: Sparkles, classExt: "tier-pro", title: "Pro plan" },
};

/**
 * Compact champagne-and-rose tier badge for admin tables.
 *
 * Renders for every recognized plan including FREE_TRIAL so every row
 * gets a tier marker — Pro carries a subtle inset foil gradient so the
 * eye lands on power users first.
 *
 * Returns `null` only for unknown / null plans.
 */
export function TierStamp({ plan }: { plan: string | null | undefined }) {
  if (!plan) return null;
  const upper = plan.toUpperCase();
  if (
    upper !== "INDIVIDUAL" &&
    upper !== "FAMILY" &&
    upper !== "PRO" &&
    upper !== "FREE_TRIAL"
  ) {
    return null;
  }
  const tier = upper as Tier;
  const { label, Icon, classExt, title } = TIER_META[tier];
  return (
    <span className={`tier-stamp ${classExt}`} title={title}>
      <Icon className="h-2.5 w-2.5" aria-hidden="true" strokeWidth={2.25} />
      {label}
    </span>
  );
}
