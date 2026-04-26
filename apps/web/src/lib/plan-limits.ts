import { prisma } from "@/lib/db";

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

export type PlanName = keyof typeof PLAN_LIMITS;

export interface UserPlan {
  plan: string;
  status: string;
  isActive: boolean;
  isTrialExpired: boolean;
  limits: typeof PLAN_LIMITS[string];
}

/**
 * Get the current user's plan and limits.
 */
export async function getUserPlan(userId: string): Promise<UserPlan> {
  const subscription = await prisma.subscription.findUnique({
    where: { userId },
  });

  const plan = subscription?.plan || "FREE_TRIAL";
  const status = subscription?.status || "TRIALING";

  // Check if trial expired
  let isTrialExpired = false;
  if (plan === "FREE_TRIAL") {
    isTrialExpired = !subscription?.trialEndsAt || new Date() > subscription.trialEndsAt;
  }

  const isActive = ["ACTIVE", "TRIALING"].includes(status) && !isTrialExpired;
  const limits = PLAN_LIMITS[plan] || PLAN_LIMITS.FREE_TRIAL;

  return { plan, status, isActive, isTrialExpired, limits };
}

/**
 * Check if user can create a new address (enforce plan limits).
 */
export async function canCreateAddress(userId: string): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
  const userPlan = await getUserPlan(userId);

  if (!userPlan.isActive) {
    return { allowed: false, reason: userPlan.isTrialExpired ? "Your free trial has expired. Please upgrade to continue." : "Your subscription is not active.", upgradeRequired: true };
  }

  const count = await prisma.address.count({ where: { userId } });
  if (count >= userPlan.limits.maxAddresses) {
    return { allowed: false, reason: `Your ${userPlan.plan} plan allows up to ${userPlan.limits.maxAddresses} address(es). Please upgrade to add more.`, upgradeRequired: true };
  }

  return { allowed: true };
}

/**
 * Check if user can create a new service.
 */
export async function canCreateService(userId: string): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
  const userPlan = await getUserPlan(userId);

  if (!userPlan.isActive) {
    return { allowed: false, reason: userPlan.isTrialExpired ? "Your free trial has expired. Please upgrade to continue." : "Your subscription is not active.", upgradeRequired: true };
  }

  const count = await prisma.service.count({ where: { userId } });
  if (count >= userPlan.limits.maxServices) {
    return { allowed: false, reason: `Your ${userPlan.plan} plan allows up to ${userPlan.limits.maxServices} services. Please upgrade.`, upgradeRequired: true };
  }

  return { allowed: true };
}

/**
 * Check if user can create a new moving plan.
 */
export async function canCreateMovingPlan(userId: string): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
  const userPlan = await getUserPlan(userId);

  if (!userPlan.isActive) {
    return { allowed: false, reason: userPlan.isTrialExpired ? "Your free trial has expired. Please upgrade to continue." : "Your subscription is not active.", upgradeRequired: true };
  }

  return { allowed: true };
}

/**
 * Check if user can create new paid-workflow artifacts.
 * Existing data remains readable, and completing already-created move tasks
 * stays available so users are not blocked from finishing local tracking.
 */
export async function canGenerateMoveTasks(userId: string): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
  const userPlan = await getUserPlan(userId);

  if (!userPlan.isActive) {
    return {
      allowed: false,
      reason: userPlan.isTrialExpired
        ? "Your free trial has expired. Please upgrade to generate new move tasks."
        : "Your subscription is not active. Please upgrade to generate new move tasks.",
      upgradeRequired: true,
    };
  }

  return { allowed: true };
}

export async function canCreateCustomProvider(userId: string): Promise<{ allowed: boolean; reason?: string; upgradeRequired?: boolean }> {
  const userPlan = await getUserPlan(userId);

  if (!userPlan.isActive) {
    return {
      allowed: false,
      reason: userPlan.isTrialExpired
        ? "Your free trial has expired. Please upgrade to add new custom providers."
        : "Your subscription is not active. Please upgrade to add new custom providers.",
      upgradeRequired: true,
    };
  }

  return { allowed: true };
}
