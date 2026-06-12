import { getUserSession } from "@/lib/auth";
import { getPlanForLimitScope, type UserPlan } from "@/lib/plan-limits";
import {
  planLimitScopeForDataScope,
  resolveWorkspaceDataScope,
  type WorkspaceDataScope,
} from "@/lib/workspace-data-scope";
import { planFeatures, type WorkspacePlanFeatures } from "@locateflow/shared";

type BooleanFeatureKey = {
  [K in keyof WorkspacePlanFeatures]: WorkspacePlanFeatures[K] extends boolean ? K : never;
}[keyof WorkspacePlanFeatures];

export async function getRequestEntitlement(
  request: Request,
  userId: string,
): Promise<{
  scope: WorkspaceDataScope;
  plan: UserPlan;
  features: WorkspacePlanFeatures;
}> {
  const scope = await resolveWorkspaceDataScope(request, userId);
  const plan = await getPlanForLimitScope(userId, planLimitScopeForDataScope(scope));
  return { scope, plan, features: planFeatures(plan.plan) };
}

export async function requestHasPlanFeature(
  request: Request,
  userId: string,
  feature: BooleanFeatureKey,
): Promise<boolean> {
  const entitlement = await getRequestEntitlement(request, userId);
  return entitlement.features[feature] === true;
}

export async function optionalRequestHasPlanFeature(
  request: Request,
  feature: BooleanFeatureKey,
): Promise<boolean> {
  const session = await getUserSession({ invalidateOnFingerprintMismatch: false }).catch(() => null);
  if (!session?.userId) return false;
  return requestHasPlanFeature(request, session.userId, feature).catch(() => false);
}
