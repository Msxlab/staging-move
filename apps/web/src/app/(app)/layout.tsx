import type { ReactNode } from "react";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { destroyUserSession, requireDbUserId } from "@/lib/auth";
import { getPostAuthUserState, resolvePostAuthRedirect } from "@/lib/post-auth-redirect";
import { normalizeAppRedirectPath } from "@/lib/safe-redirect";
import { loadShowBudgetPreference } from "@/lib/user-preferences";
import { prisma } from "@/lib/db";
import { isWorkspaceModelEnabled } from "@/lib/workspace-context";
import { resolveConsumerEntitlement } from "@/lib/consumer-entitlement";

/**
 * Show the Household/Workspace nav entry only when the workspace model is on AND
 * the user is a Family/Pro owner OR an invited member of someone's workspace. A
 * solo Individual owner (their auto-provisioned single-seat workspace) gets no
 * entry. Best-effort: any failure hides the entry rather than breaking the app.
 */
async function resolveShowWorkspace(userId: string): Promise<boolean> {
  if (!(await isWorkspaceModelEnabled())) return false;
  const [sub, invitedMember] = await Promise.all([
    prisma.subscription.findUnique({ where: { userId } }),
    prisma.workspaceMember.findFirst({
      where: { userId, role: { not: "OWNER" } },
      select: { id: true },
    }),
  ]);
  const plan = String((await resolveConsumerEntitlement(sub)).entitlement.effectivePlan);
  return plan === "FAMILY" || plan === "PRO" || Boolean(invitedMember);
}

/**
 * The user's effective plan tier ("FAMILY" | "PRO" | "INDIVIDUAL" | ...), used by
 * AppShell to apply the per-plan accent theme. Independent of the workspace flag —
 * a Family/Pro user is themed even if the workspace model is off. Best-effort: any
 * failure returns null (base theme).
 */
async function resolvePlanTier(userId: string): Promise<string | null> {
  try {
    const sub = await prisma.subscription.findUnique({ where: { userId } });
    return String((await resolveConsumerEntitlement(sub)).entitlement.effectivePlan);
  } catch {
    return null;
  }
}

async function getCurrentAppPath() {
  const headerStore = await headers();
  return normalizeAppRedirectPath(
    headerStore.get("x-locateflow-pathname"),
    "/dashboard",
  );
}

async function getAppGateState(): Promise<
  | { redirectTo: string }
  | { userId: string }
> {
  const currentPath = await getCurrentAppPath();
  let userId: string;
  try {
    userId = await requireDbUserId({ distinguishDeleted: true });
  } catch (error: any) {
    if (error?.message === "ACCOUNT_DELETED") {
      redirect("/sign-in?error=account-unavailable");
    }
    if (error?.message === "UNAUTHORIZED") {
      redirect(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
    }
    return { redirectTo: "/sign-in" };
  }

  try {
    const target = resolvePostAuthRedirect(await getPostAuthUserState(userId), currentPath);
    return target === currentPath ? { userId } : { redirectTo: target };
  } catch (error: any) {
    if (error?.message === "AUTH_STATE_USER_UNAVAILABLE") {
      await destroyUserSession().catch(() => null);
      redirect(`/sign-in?redirect=${encodeURIComponent(currentPath)}`);
    }
    throw error;
  }
}

export default async function AppLayout({ children }: { children: ReactNode }) {
  const gate = await getAppGateState();
  if ("redirectTo" in gate) {
    redirect(gate.redirectTo);
  }

  const showBudget = await loadShowBudgetPreference(gate.userId).catch(() => true);
  const showWorkspace = await resolveShowWorkspace(gate.userId).catch(() => false);
  const planTier = await resolvePlanTier(gate.userId);

  return (
    <AppShell showBudget={showBudget} showWorkspace={showWorkspace} planTier={planTier}>
      {children}
    </AppShell>
  );
}
