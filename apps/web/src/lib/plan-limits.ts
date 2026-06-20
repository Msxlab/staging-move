import { prisma } from "@/lib/db";
import { ONBOARDING_COMPLETED_EVENT } from "@/lib/legal";
import { activeTrackedServiceWhereForScope } from "@/lib/service-active";
import { findSubscriptionForEntitlement } from "@/lib/billing";
import { getEffectiveEntitlement } from "@/lib/shared-billing";
import { isWorkspaceModelEnabled } from "@/lib/workspace-context";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { CONSUMER_FREE_FLAG, consumerFreeApplies } from "@locateflow/shared";
export { ACTIVE_TRACKED_SERVICE_WHERE } from "@/lib/service-active";

/**
 * Plan limits configuration (canonical §C1, docs 20/30).
 * FREE_TRIAL: full-feature trial floor
 * INDIVIDUAL: single user
 * FAMILY: household (6 members)
 * PRO: power users / portfolios (10 members)
 *
 * Seat ceilings live in workspace-entitlements.ts; these are the per-owner
 * address/service caps enforced on write.
 */
/**
 * Sentinel for an "unlimited" cap. Deliberately a large finite integer rather
 * than `Infinity`: the count check (`count >= limit`) can never trip, and if a
 * limit is ever JSON-serialized to a client it stays a real number instead of
 * collapsing to `null` (which `JSON.stringify(Infinity)` would produce). Any
 * user-facing reason string that interpolates a cap must guard on this so we
 * never print a giant number — see `canCreateService`, where the
 * `SERVICE_LIMIT_REACHED` branch is unreachable for unlimited plans.
 */
export const UNLIMITED = Number.MAX_SAFE_INTEGER;

const PLAN_LIMITS: Record<string, {
  maxAddresses: number;
  maxServices: number;
  maxCustomProviders: number;
}> = {
  // FREE = thin teaser tier (owner 2026-06-10): 3 addresses, 10 services.
  // The move plan itself is gated separately (see canCreateMovingPlan).
  // `maxCustomProviders` is an ABUSE ceiling, not a paywall: generous enough that
  // no real user hits it, finite so a single account can't create unbounded
  // userCustomProvider rows (the active path previously had no count check).
  FREE_TRIAL: {
    maxAddresses: 3,
    maxServices: 10,
    maxCustomProviders: 25,
  },
  INDIVIDUAL: {
    maxAddresses: 10,
    maxServices: 100,
    maxCustomProviders: 100,
  },
  FAMILY: {
    maxAddresses: 15,
    maxServices: 500,
    maxCustomProviders: 300,
  },
  PRO: {
    maxAddresses: 25,
    maxServices: 1000,
    maxCustomProviders: 1000,
  },
};

// Pre-completion (setup) caps. During onboarding/setup, services stay
// uncapped so a new user can bulk-import their existing accounts without
// hitting the wall mid-import; the thin-Free 10-service steady-state cap
// (PLAN_LIMITS.FREE_TRIAL) applies only AFTER setup completes. The
// moving-plan allowance is removed entirely — free users never create a
// plan, they get the value-first teaser + upgrade CTA (see canCreateMovingPlan).
const SETUP_GRACE_LIMITS = {
  maxAddresses: 3,
  maxServices: UNLIMITED,
  maxCustomProviders: 10,
};

export type PlanName = keyof typeof PLAN_LIMITS;

export interface UserPlan {
  plan: string;
  status: string;
  isActive: boolean;
  hasPremium: boolean;
  isTrialExpired: boolean;
  limits: typeof PLAN_LIMITS[string];
}

export interface PlanLimitCheck {
  allowed: boolean;
  code?: string;
  reason?: string;
  upgradeRequired?: boolean;
  setupGrace?: boolean;
  current?: number;
  limit?: number;
}

export interface PlanLimitScope {
  workspaceId?: string | null;
  planOwnerUserId?: string | null;
}

/**
 * Get the current user's plan and limits.
 *
 * Delegates to getEffectiveEntitlement so plan-limit gating, /api/profile,
 * and admin display all interpret the same Subscription row identically.
 *
 * Special case: a missing Subscription row is treated as active default
 * Free Access. ensureSubscriptionDefaults runs at every register/OAuth
 * path, so a missing row should only happen for legacy data — denying
 * access there would lock those users out of the setup-grace path.
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const subscription = await findSubscriptionForEntitlement(userId);
  // CONSUMER_FREE: every consumer resolves to PRO (everything free), reversibly.
  // Read once. Admin never calls getUserPlan (it reads getEffectiveEntitlement
  // directly), so admin truth stays on the raw entitlement.
  const consumerFree = await isFeatureEnabled(CONSUMER_FREE_FLAG);

  if (!subscription) {
    if (consumerFree) {
      return {
        plan: "PRO",
        status: "FREE_ACCESS",
        isActive: true,
        hasPremium: true,
        isTrialExpired: false,
        limits: PLAN_LIMITS.PRO,
      };
    }
    return {
      plan: "FREE_TRIAL",
      status: "FREE_ACCESS",
      isActive: true,
      hasPremium: false,
      isTrialExpired: false,
      limits: PLAN_LIMITS.FREE_TRIAL,
    };
  }

  const effective = getEffectiveEntitlement(subscription);
  const status = subscription.status || "FREE_ACCESS";

  // CONSUMER_FREE short-circuit: a free / no-management consumer resolves to PRO
  // (full features + PRO abuse caps). Real or lapsed payers and admin grants are
  // excluded by consumerFreeApplies (H3) and fall through to the normal ladder.
  if (consumerFreeApplies(effective, consumerFree)) {
    return {
      plan: "PRO",
      status,
      isActive: true,
      hasPremium: true,
      isTrialExpired: false,
      limits: PLAN_LIMITS.PRO,
    };
  }
  const accessType = (subscription as { accessType?: string | null }).accessType;

  // Free Access and Free Trial keep users on FREE_TRIAL feature limits
  // even when the underlying plan tier is higher — the trial is a taste of
  // premium with metered limits. Manual admin premium and provider-paid
  // ACTIVE subscriptions get the granted tier's limits (INDIVIDUAL/FAMILY/PRO);
  // a manual grant with no resolvable tier falls back to INDIVIDUAL since the
  // whole point of the grant is full access. Everyone else is held to
  // FREE_TRIAL limits even when they keep read-only access.
  const tier = effective.effectivePlan;
  const paidTier: PlanName | null =
    tier === "INDIVIDUAL" || tier === "FAMILY" || tier === "PRO" ? tier : null;
  let effectivePlan: PlanName;
  if (effective.isManualOverride && effective.hasPremium) {
    effectivePlan = paidTier ?? "INDIVIDUAL";
  } else if (accessType === "FREE_TRIAL" || accessType === "FREE_ACCESS") {
    effectivePlan = "FREE_TRIAL";
  } else if (effective.hasPremium && paidTier) {
    effectivePlan = paidTier;
  } else {
    effectivePlan = "FREE_TRIAL";
  }

  const isTrialExpired =
    effective.effectiveStatus === "FREE_ACCESS_EXPIRED" ||
    effective.effectiveStatus === "PROVIDER_TRIAL_EXPIRED" ||
    effective.effectiveStatus === "MANUAL_PREMIUM_EXPIRED";

  const limits = PLAN_LIMITS[effectivePlan] || PLAN_LIMITS.FREE_TRIAL;

  return {
    plan: effectivePlan,
    status,
    isActive: effective.hasAccess,
    hasPremium: effective.hasPremium,
    isTrialExpired,
    limits,
  };
}

export async function getPlanForLimitScope(userId: string, scope: PlanLimitScope = {}): Promise<UserPlan> {
  return getUserPlan(scope.planOwnerUserId || userId);
}

export async function getUserPlanForDefaultWorkspace(userId: string): Promise<UserPlan> {
  if (!(await isWorkspaceModelEnabled().catch(() => false))) return getUserPlan(userId);

  const member = await prisma.workspaceMember.findFirst({
    where: {
      userId,
      status: { in: ["ACTIVE", "OVERFLOW"] },
    },
    orderBy: { joinedAt: "asc" },
    select: {
      workspace: { select: { ownerUserId: true } },
    },
  });
  return getUserPlan(member?.workspace?.ownerUserId || userId);
}

function recordScopeWhere(userId: string, scope: PlanLimitScope = {}) {
  return scope.workspaceId ? { workspaceId: scope.workspaceId } : { userId };
}

function serviceScope(userId: string, scope: PlanLimitScope = {}) {
  return scope.workspaceId ? { userId, workspaceId: scope.workspaceId } : { userId };
}

async function isInSetupGrace(userId: string): Promise<boolean> {
  const completed = await prisma.userEvent.findFirst({
    where: { userId, event: ONBOARDING_COMPLETED_EVENT },
    select: { id: true },
  });
  return !completed;
}

function inactivePlanBlock(userPlan: UserPlan, action: "address" | "service" | "customProvider" | "movingPlan" | "moveTasks"): PlanLimitCheck {
  if (userPlan.isTrialExpired) {
    const actionText = action === "moveTasks"
      ? "generate new move tasks"
      : action === "customProvider"
        ? "add new custom providers"
        : action === "movingPlan"
          ? "create new moving plans"
          : action === "address"
            ? "add more addresses"
            : "add more services";
    return {
      allowed: false,
      code: "TRIAL_EXPIRED",
      reason: `Your trial has ended. Upgrade to ${actionText}.`,
      upgradeRequired: true,
    };
  }

  return {
    allowed: false,
    code: "SUBSCRIPTION_INACTIVE",
    reason: "Your subscription is not active. Please upgrade to continue.",
    upgradeRequired: true,
  };
}

/**
 * Check if user can create a new address (enforce plan limits).
 */
export async function canCreateAddress(userId: string, scope: PlanLimitScope = {}): Promise<PlanLimitCheck> {
  const userPlan = await getPlanForLimitScope(userId, scope);
  const count = await prisma.address.count({ where: { ...recordScopeWhere(userId, scope), deletedAt: null } });

  if (!userPlan.isActive) {
    if (await isInSetupGrace(userId)) {
      if (count < SETUP_GRACE_LIMITS.maxAddresses) {
        return { allowed: true, setupGrace: true, current: count, limit: SETUP_GRACE_LIMITS.maxAddresses };
      }
      return {
        allowed: false,
        code: "SETUP_ADDRESS_LIMIT_REACHED",
        reason: `You can add up to ${SETUP_GRACE_LIMITS.maxAddresses} addresses during setup. Upgrade to add more.`,
        upgradeRequired: true,
        current: count,
        limit: SETUP_GRACE_LIMITS.maxAddresses,
      };
    }
    return inactivePlanBlock(userPlan, "address");
  }

  if (count >= userPlan.limits.maxAddresses) {
    return {
      allowed: false,
      code: "ADDRESS_LIMIT_REACHED",
      reason: `Your ${userPlan.plan} plan allows up to ${userPlan.limits.maxAddresses} address(es). Please upgrade to add more.`,
      upgradeRequired: true,
      current: count,
      limit: userPlan.limits.maxAddresses,
    };
  }

  return { allowed: true };
}

/**
 * Check if user can create a new service.
 */
export async function canCreateService(userId: string, scope: PlanLimitScope = {}): Promise<PlanLimitCheck> {
  const userPlan = await getPlanForLimitScope(userId, scope);
  const count = await prisma.service.count({ where: activeTrackedServiceWhereForScope(serviceScope(userId, scope)) });

  if (!userPlan.isActive) {
    if (await isInSetupGrace(userId)) {
      // Setup services are unlimited (mirrors the FREE_TRIAL floor), so the
      // SETUP_SERVICE_LIMIT_REACHED branch is unreachable and we never emit the
      // UNLIMITED sentinel as a user-facing `limit`. Guard kept defensively in
      // case the setup cap is ever lowered to a real number again.
      if (count < SETUP_GRACE_LIMITS.maxServices) {
        return SETUP_GRACE_LIMITS.maxServices >= UNLIMITED
          ? { allowed: true, setupGrace: true, current: count }
          : { allowed: true, setupGrace: true, current: count, limit: SETUP_GRACE_LIMITS.maxServices };
      }
      return {
        allowed: false,
        code: "SETUP_SERVICE_LIMIT_REACHED",
        reason: `You can add up to ${SETUP_GRACE_LIMITS.maxServices} services during setup. Continue without providers or upgrade to add more.`,
        upgradeRequired: true,
        current: count,
        limit: SETUP_GRACE_LIMITS.maxServices,
      };
    }
    return inactivePlanBlock(userPlan, "service");
  }

  if (count >= userPlan.limits.maxServices) {
    return {
      allowed: false,
      code: "SERVICE_LIMIT_REACHED",
      reason: `Your ${userPlan.plan} plan allows up to ${userPlan.limits.maxServices} services. Please upgrade.`,
      upgradeRequired: true,
      current: count,
      limit: userPlan.limits.maxServices,
    };
  }

  return { allowed: true };
}

/**
 * Check if the user can create a moving plan.
 *
 * FREEMIUM CONTRACT: the moving plan is the paid unlock. Only paid tiers
 * (Individual/Family/Pro — i.e. `hasPremium`) may create one. Everyone else,
 * including a FREE *active* user (FREE_TRIAL limits, `isActive:true`,
 * `hasPremium:false`) and a setup-grace user, is blocked with a single
 * upgrade-required signal. The onboarding/dashboard clients render the
 * value-first teaser + "Unlock with Individual" CTA off this code rather than
 * persisting a plan, so the gate must key on **paid tier**, never `isActive`.
 *
 * The prior setup-grace "1 free moving plan" allowance is removed entirely —
 * free never creates a plan.
 */
export async function canCreateMovingPlan(userId: string, scope: PlanLimitScope = {}): Promise<PlanLimitCheck> {
  const userPlan = await getPlanForLimitScope(userId, scope);

  if (userPlan.hasPremium) {
    return { allowed: true };
  }

  return {
    allowed: false,
    code: "MOVING_PLAN_UPGRADE_REQUIRED",
    reason: "Upgrade to Individual to unlock your full move plan.",
    upgradeRequired: true,
  };
}

/**
 * Destination-address check for the moving-plan create flow. Since free users
 * can no longer create a moving plan at all (canCreateMovingPlan blocks them
 * first), this is only reached by paid users, and it simply applies their
 * normal per-tier address cap. The old setup-grace bypass (which granted a free
 * destination address for the first move) is gone with the moving-plan
 * allowance.
 */
export async function canCreateMovingDestinationAddress(userId: string, scope: PlanLimitScope = {}): Promise<PlanLimitCheck> {
  return canCreateAddress(userId, scope);
}

/**
 * Check if the user can GENERATE move tasks (a paid-workflow artifact).
 *
 * Move-task generation is part of the paid move plan, so only paid tiers may
 * generate. A FREE user (active, post-setup, or in setup) is blocked with the
 * same MOVING_PLAN_UPGRADE_REQUIRED signal as plan creation — they have no
 * plan to generate tasks for in the first place.
 *
 * Read stays open: GET /api/move-tasks is ungated, so a former paid user who
 * lapsed (or a free user) keeps any existing move tasks readable. Generation
 * and mutation stay paid-only: this gate fires on POST/PATCH /api/move-tasks
 * and syncSuggestedMoveTasks.
 */
export async function canGenerateMoveTasks(userId: string, scope: PlanLimitScope = {}): Promise<PlanLimitCheck> {
  const userPlan = await getPlanForLimitScope(userId, scope);

  if (userPlan.hasPremium) {
    return { allowed: true };
  }

  // Lapsed paid users (trial expired / inactive) keep their tier-specific
  // copy so the messaging matches their actual state. Everyone else — free
  // active and setup users — gets the upgrade-required teaser signal.
  if (!userPlan.isActive) {
    return inactivePlanBlock(userPlan, "moveTasks");
  }

  return {
    allowed: false,
    code: "MOVING_PLAN_UPGRADE_REQUIRED",
    reason: "Upgrade to Individual to unlock your full move plan.",
    upgradeRequired: true,
  };
}

export async function canCreateCustomProvider(userId: string): Promise<PlanLimitCheck> {
  const userPlan = await getUserPlan(userId);

  if (!userPlan.isActive) {
    if (await isInSetupGrace(userId)) {
      const count = await prisma.userCustomProvider.count({ where: { userId, deletedAt: null } });
      if (count < SETUP_GRACE_LIMITS.maxCustomProviders) {
        return { allowed: true, setupGrace: true, current: count, limit: SETUP_GRACE_LIMITS.maxCustomProviders };
      }
      return {
        allowed: false,
        code: "SETUP_CUSTOM_PROVIDER_LIMIT_REACHED",
        reason: `You can add up to ${SETUP_GRACE_LIMITS.maxCustomProviders} custom providers during setup. Continue without providers or upgrade to add more.`,
        upgradeRequired: true,
        current: count,
        limit: SETUP_GRACE_LIMITS.maxCustomProviders,
      };
    }
    return inactivePlanBlock(userPlan, "customProvider");
  }

  // Active path: enforce a per-owner ABUSE ceiling (finite, not a paywall).
  // Previously this path returned { allowed: true } with no count check, so a
  // single account could create unbounded custom providers — the only guards
  // were the route's rate limit (velocity) and the pending-review cap (review
  // queue only). This caps cumulative rows. Finite value → safe to interpolate;
  // intentionally NOT `upgradeRequired` (everything is free — no tier to buy).
  const count = await prisma.userCustomProvider.count({ where: { userId, deletedAt: null } });
  if (count >= userPlan.limits.maxCustomProviders) {
    return {
      allowed: false,
      code: "CUSTOM_PROVIDER_LIMIT_REACHED",
      reason: `You've reached the maximum of ${userPlan.limits.maxCustomProviders} custom providers.`,
      current: count,
      limit: userPlan.limits.maxCustomProviders,
    };
  }

  return { allowed: true };
}
