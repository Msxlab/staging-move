import type { EffectiveEntitlement } from "./entitlement";

/**
 * Master switch name for the "free consumer pivot" (everyone resolves to PRO,
 * everything free). Read on web via the DB FeatureFlag (`isFeatureEnabled`);
 * shared/pure code receives the resolved boolean as a parameter (never reads an
 * ambient env inside a pure function — see docs/ai/free-pivot/16 H1).
 */
export const CONSUMER_FREE_FLAG = "CONSUMER_FREE";

/**
 * Apply the consumer-free override to a resolved entitlement.
 *
 * IMPORTANT: call this ONLY on CONSUMER read paths (web `getUserPlan`,
 * `buildUnifiedEntitlementSnapshot` / `/api/profile`, the mobile snapshot).
 * Admin paths MUST pass the RAW entitlement (do not call this) so manual grants,
 * expiries, refunds, real tiers, and warnings stay truthful. `getEffectiveEntitlement`
 * itself is intentionally left UNTOUCHED (the billing-truth core), so the
 * preserve-suite is unaffected and the override is fully reversible.
 *
 * Reversible: `enabled === false` returns the input unchanged.
 *
 * Safe by construction — it upgrades ONLY a pure free / campaign / no-row
 * consumer: `managementKind === "none"` AND not already premium. It NEVER
 * touches a real payment row:
 *   - an active payer (or active manual grant) is already `hasPremium` → skipped;
 *   - a lapsed / refunded / canceled / past-due Stripe or store row resolves to
 *     `managementKind` "stripe"/"store" → skipped, so seat reconciliation and
 *     admin truth still see the real lapsed state (docs/ai/free-pivot/16 H3);
 *   - an admin-managed row ("admin", e.g. an expired manual grant) → skipped,
 *     left to the admin layer (conservative).
 *
 * The upgraded shape is chosen so the existing `getUserPlan` ladder yields PRO
 * limits and the consumer snapshot reads as active+paid (no "choose a plan"
 * contradiction, docs/ai/free-pivot/16 M1): hasAccess/hasPremium = true,
 * effectivePlan = "PRO", accessType = "PAID", effectiveStatus = "PAID_ACTIVE".
 * `managementKind` / `billingProvider` / `isManualOverride` are left as-is so the
 * consumer UI never offers to "manage" a subscription that does not exist.
 */
export function applyConsumerFreeOverride(
  result: EffectiveEntitlement,
  enabled: boolean,
): EffectiveEntitlement {
  if (!enabled) return result;
  if (result.hasPremium) return result; // active payer / active manual grant
  if (result.managementKind !== "none") return result; // real provider/admin row (H3)

  return {
    ...result,
    hasAccess: true,
    hasPremium: true,
    effectivePlan: "PRO",
    effectiveStatus: "PAID_ACTIVE",
    accessType: "PAID",
    reason: `${result.reason} · consumer-free override`,
  };
}
