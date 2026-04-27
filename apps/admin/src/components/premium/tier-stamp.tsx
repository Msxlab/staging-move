import { Sparkles, UsersRound, User } from "lucide-react";

type Tier = "INDIVIDUAL" | "FAMILY" | "PRO";

const TIER_META: Record<
  Tier,
  { label: string; Icon: typeof Sparkles; classExt: string }
> = {
  INDIVIDUAL: { label: "INDV", Icon: User, classExt: "tier-individual" },
  FAMILY: { label: "FAM", Icon: UsersRound, classExt: "tier-family" },
  PRO: { label: "PRO", Icon: Sparkles, classExt: "tier-pro" },
};

/**
 * Compact champagne-and-rose tier badge for admin tables. Pro carries a
 * subtle inset foil gradient so the eye lands on power users first.
 *
 * Returns `null` for trial / unknown tiers — those rows stay clean.
 */
export function TierStamp({ plan }: { plan: string | null | undefined }) {
  if (!plan) return null;
  const upper = plan.toUpperCase();
  if (upper !== "INDIVIDUAL" && upper !== "FAMILY" && upper !== "PRO") return null;
  const tier = upper as Tier;
  const { label, Icon, classExt } = TIER_META[tier];
  return (
    <span
      className={`tier-stamp ${classExt}`}
      title={`${tier.charAt(0) + tier.slice(1).toLowerCase()} plan`}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" strokeWidth={2.25} />
      {label}
    </span>
  );
}
