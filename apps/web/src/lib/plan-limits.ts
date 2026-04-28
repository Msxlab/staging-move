import { prisma } from "@/lib/db";
import { ONBOARDING_COMPLETED_EVENT } from "@/lib/legal";

/**
 * Plan limits configuration.
 * FREE_TRIAL: 7-day full-feature trial
 * INDIVIDUAL: Full features for single user
 */
const PLAN_LIMITS: Record<string, {
  maxAddresses: number;
  maxServices: number;
}> = {
  FREE_TRIAL: {
    maxAddresses: 2,
    maxServices: 10,
  },
  INDIVIDUAL: {
    maxAddresses: 10,
    maxServices: 100,
  },
};

const SETUP_GRACE_LIMITS = {
  maxAddresses: 2,
  maxServices: 10,
  maxCustomProviders: 10,
  maxMovingPlans: 1,
};

const NON_TRACKED_SERVICE_ACTIONS = [
  "CANCEL",
  "CANCELED",
  "CANCELLED",
  "REMOVE",
  "REMOVED",
  "ARCHIVE",
  "ARCHIVED",
];

export const ACTIVE_TRACKED_SERVICE_WHERE = {
  deletedAt: null,
  isActive: true,
  OR: [
    { migrationAction: null },
    { migrationAction: { notIn: NON_TRACKED_SERVICE_ACTIONS } },
  ],
};

export type PlanName = keyof typeof PLAN_LIMITS;

export interface UserPlan {
  plan: string;
  status: string;
  isActive: boolean;
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

/**
 * Get the current user's plan and limits.
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  const plan = subscription?.plan || "FREE_TRIAL";
  const status = subscription?.status || "FREE_ACCESS";
  const accessType = subscription?.accessType || (!subscription ? "FREE_ACCESS" : null);
  const effectivePlan =
    accessType === "FREE_ACCESS" || accessType === "FREE_TRIAL"
      ? "FREE_TRIAL"
      : plan;

  // Check if trial expired
  let isTrialExpired = false;
  if (accessType === "FREE_ACCESS") {
    const freeAccessEndsAt = (subscription as any)?.freeAccessEndsAt as Date | null | undefined;
    isTrialExpired = subscription ? !freeAccessEndsAt || new Date() > freeAccessEndsAt : false;
  } else if (accessType === "FREE_TRIAL") {
    isTrialExpired = subscription
      ? !subscription.trialEndsAt || new Date() > subscription.trialEndsAt
      : false;
  } else if (plan === "FREE_TRIAL") {
    isTrialExpired = subscription
      ? !subscription.trialEndsAt || new Date() > subscription.trialEndsAt
      : false;
  }

  const isActive = ["ACTIVE", "TRIALING", "TRIAL_CANCELED", "FREE_ACCESS"].includes(status) && !isTrialExpired;
  const limits = PLAN_LIMITS[effectivePlan] || PLAN_LIMITS.FREE_TRIAL;

  return { plan: effectivePlan, status, isActive, isTrialExpired, limits };
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
export async function canCreateAddress(userId: string): Promise<PlanLimitCheck> {
  const userPlan = await getUserPlan(userId);
  const count = await prisma.address.count({ where: { userId, deletedAt: null } });

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
export async function canCreateService(userId: string): Promise<PlanLimitCheck> {
  const userPlan = await getUserPlan(userId);
  const count = await prisma.service.count({
    where: {
      userId,
      ...ACTIVE_TRACKED_SERVICE_WHERE,
    },
  });

  if (!userPlan.isActive) {
    if (await isInSetupGrace(userId)) {
      if (count < SETUP_GRACE_LIMITS.maxServices) {
        return { allowed: true, setupGrace: true, current: count, limit: SETUP_GRACE_LIMITS.maxServices };
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
 * Check if user can create a new moving plan.
 */
export async function canCreateMovingPlan(userId: string): Promise<PlanLimitCheck> {
  const userPlan = await getUserPlan(userId);

  if (!userPlan.isActive) {
    if (await isInSetupGrace(userId)) {
      const count = await prisma.movingPlan.count({ where: { userId, deletedAt: null } });
      if (count < SETUP_GRACE_LIMITS.maxMovingPlans) {
        return { allowed: true, setupGrace: true, current: count, limit: SETUP_GRACE_LIMITS.maxMovingPlans };
      }
      // Setup user hit their first-plan allowance. Surface the setup-specific
      // code rather than falling through to inactivePlanBlock, which would
      // (incorrectly) tell the user their trial has ended.
      return {
        allowed: false,
        code: "SETUP_MOVING_PLAN_LIMIT_REACHED",
        reason: `You can plan up to ${SETUP_GRACE_LIMITS.maxMovingPlans} move during setup. Upgrade to plan additional moves.`,
        upgradeRequired: true,
        current: count,
        limit: SETUP_GRACE_LIMITS.maxMovingPlans,
      };
    }
    return inactivePlanBlock(userPlan, "movingPlan");
  }

  return { allowed: true };
}

export async function canCreateMovingDestinationAddress(userId: string): Promise<PlanLimitCheck> {
  const existingMovingPlanCount = await prisma.movingPlan.count({ where: { userId, deletedAt: null } });
  if (existingMovingPlanCount === 0 && await isInSetupGrace(userId)) {
    return { allowed: true, setupGrace: true, current: existingMovingPlanCount, limit: SETUP_GRACE_LIMITS.maxMovingPlans };
  }
  return canCreateAddress(userId);
}

/**
 * Check if user can create new paid-workflow artifacts.
 * Existing data remains readable, and completing already-created move tasks
 * stays available so users are not blocked from finishing local tracking.
 */
export async function canGenerateMoveTasks(userId: string): Promise<PlanLimitCheck> {
  const userPlan = await getUserPlan(userId);

  if (!userPlan.isActive) {
    // Setup users have already been allowed to create their first moving
    // plan; gating /api/move-tasks for them would let the plan exist but
    // refuse the very tasks the onboarding flow asks the user to act on.
    // canCreateMovingPlan caps the *count* of plans, so there is no abuse
    // delta in mirroring that allowance here.
    if (await isInSetupGrace(userId)) {
      return { allowed: true, setupGrace: true };
    }
    return inactivePlanBlock(userPlan, "moveTasks");
  }

  return { allowed: true };
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

  return { allowed: true };
}
