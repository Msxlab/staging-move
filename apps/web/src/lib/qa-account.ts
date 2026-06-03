import { rawPrisma } from "@/lib/db";
import { normalizeRuntimeConfigValue } from "@/lib/shared-runtime-config";

export const QA_RESETTABLE_ACCOUNT_EMAIL_KEY = "QA_RESETTABLE_ACCOUNT_EMAIL";

type QaAccountResetSkipReason =
  | "config_disabled"
  | "session_not_allowlisted"
  | "user_not_allowlisted"
  | "owned_workspace_has_other_members";

export type QaAccountResetResult =
  | { reset: true }
  | { reset: false; reason: QaAccountResetSkipReason };

const SINGLE_EMAIL_PATTERN = /^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$/;

function normalizeEmail(value: string | null | undefined): string | null {
  return normalizeRuntimeConfigValue(value)?.toLowerCase() ?? null;
}

export function getQaResettableAccountEmail(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const email = normalizeEmail(env[QA_RESETTABLE_ACCOUNT_EMAIL_KEY]);
  if (!email || !SINGLE_EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function isAllowlistedQaEmail(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const allowlistedEmail = getQaResettableAccountEmail(env);
  return Boolean(allowlistedEmail && normalizeEmail(email) === allowlistedEmail);
}

export async function resetAllowlistedQaAccountOnLogout(input: {
  userId: string | null | undefined;
  sessionEmail: string | null | undefined;
}): Promise<QaAccountResetResult> {
  const allowlistedEmail = getQaResettableAccountEmail();
  if (!allowlistedEmail) return { reset: false, reason: "config_disabled" };

  if (!input.userId || normalizeEmail(input.sessionEmail) !== allowlistedEmail) {
    return { reset: false, reason: "session_not_allowlisted" };
  }

  const user = await rawPrisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true },
  });
  if (!user || normalizeEmail(user.email) !== allowlistedEmail) {
    return { reset: false, reason: "user_not_allowlisted" };
  }

  let blockedReason: QaAccountResetSkipReason | null = null;

  await rawPrisma.$transaction(async (tx) => {
    const ownedWorkspaces = await tx.workspace.findMany({
      where: { ownerUserId: user.id },
      select: { id: true },
    });

    for (const workspace of ownedWorkspaces) {
      const otherMember = await tx.workspaceMember.findFirst({
        where: {
          workspaceId: workspace.id,
          userId: { not: user.id },
        },
        select: { id: true },
      });
      if (otherMember) {
        blockedReason = "owned_workspace_has_other_members";
        return;
      }
    }

    const ownedWorkspaceIds = ownedWorkspaces.map((workspace) => workspace.id);

    await tx.workspaceAuthChallenge.deleteMany({ where: { userId: user.id } });
    await tx.notificationQueue.deleteMany({ where: { userId: user.id } });
    await tx.auditLog.deleteMany({ where: { userId: user.id } });
    await tx.gDPRRequest.deleteMany({ where: { userId: user.id } });
    await tx.waitlistSignup.deleteMany({
      where: {
        OR: [
          { userId: user.id },
          { email: allowlistedEmail },
        ],
      },
    });
    await tx.emailLog.deleteMany({ where: { to: allowlistedEmail } });
    await tx.movingPlan.deleteMany({
      where: {
        OR: [
          { userId: user.id },
          ...(ownedWorkspaceIds.length > 0
            ? [{ workspaceId: { in: ownedWorkspaceIds } }]
            : []),
        ],
      },
    });

    if (ownedWorkspaceIds.length > 0) {
      await tx.workspace.deleteMany({
        where: {
          ownerUserId: user.id,
          id: { in: ownedWorkspaceIds },
        },
      });
    }

    await tx.user.delete({ where: { id: user.id } });
  });

  if (blockedReason) return { reset: false, reason: blockedReason };
  return { reset: true };
}
