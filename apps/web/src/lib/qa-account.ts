import { rawPrisma } from "@/lib/db";
import { normalizeRuntimeConfigValue } from "@/lib/shared-runtime-config";

export const QA_RESETTABLE_ACCOUNT_EMAIL_KEY = "QA_RESETTABLE_ACCOUNT_EMAIL";
export const STORE_REVIEW_ACCOUNT_EMAILS_KEY = "STORE_REVIEW_ACCOUNT_EMAILS";
const STORE_REVIEW_ACCOUNT_EMAIL_KEYS = [
  STORE_REVIEW_ACCOUNT_EMAILS_KEY,
  "GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS",
  "APPLE_SANDBOX_PURCHASE_USER_EMAILS",
] as const;

type QaAccountResetSkipReason =
  | "config_disabled"
  | "email_not_allowlisted"
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

function parseEmailList(value: string | null | undefined): string[] {
  const raw = normalizeRuntimeConfigValue(value);
  if (!raw) return [];
  const emails = raw
    .split(/[,\n;]/)
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
  if (emails.length === 0 || !emails.every((email) => SINGLE_EMAIL_PATTERN.test(email))) {
    return [];
  }
  return [...new Set(emails)];
}

export function getQaResettableAccountEmail(
  env: Record<string, string | undefined> = process.env,
): string | null {
  const email = normalizeEmail(env[QA_RESETTABLE_ACCOUNT_EMAIL_KEY]);
  if (!email || !SINGLE_EMAIL_PATTERN.test(email)) return null;
  return email;
}

export function getStoreReviewAccountEmails(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return [
    ...new Set(STORE_REVIEW_ACCOUNT_EMAIL_KEYS.flatMap((key) => parseEmailList(env[key]))),
  ];
}

export function isAllowlistedQaEmail(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const allowlistedEmail = getQaResettableAccountEmail(env);
  return Boolean(allowlistedEmail && normalizeEmail(email) === allowlistedEmail);
}

export function isStoreReviewAccountEmail(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  const normalized = normalizeEmail(email);
  return Boolean(normalized && getStoreReviewAccountEmails(env).includes(normalized));
}

export function isAutoVerifiedTestEmail(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): boolean {
  return isAllowlistedQaEmail(email, env) || isStoreReviewAccountEmail(email, env);
}

function getSignupResettableTestEmail(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
  extraStoreReviewEmails: readonly string[] = [],
): string | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const qaEmail = getQaResettableAccountEmail(env);
  if (qaEmail && normalized === qaEmail) return qaEmail;
  const reviewEmails = new Set([
    ...getStoreReviewAccountEmails(env),
    ...extraStoreReviewEmails.map((item) => normalizeEmail(item)).filter((item): item is string => Boolean(item)),
  ]);
  return reviewEmails.has(normalized) ? normalized : null;
}

async function resetExactAllowlistedQaUser(input: {
  user: { id: string; email: string | null };
  allowlistedEmail: string;
}): Promise<QaAccountResetResult> {
  const { user, allowlistedEmail } = input;
  if (normalizeEmail(user.email) !== allowlistedEmail) {
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

export async function resetAllowlistedQaAccountForSignup(input: {
  email: string | null | undefined;
  storeReviewEmails?: readonly string[];
}): Promise<QaAccountResetResult> {
  const allowlistedEmail = getSignupResettableTestEmail(
    input.email,
    process.env,
    input.storeReviewEmails ?? [],
  );
  if (!allowlistedEmail) {
    const hasResettableConfig =
      Boolean(getQaResettableAccountEmail()) ||
      getStoreReviewAccountEmails().length > 0 ||
      Boolean(input.storeReviewEmails?.length);
    return {
      reset: false,
      reason: hasResettableConfig ? "email_not_allowlisted" : "config_disabled",
    };
  }

  if (normalizeEmail(input.email) !== allowlistedEmail) {
    return { reset: false, reason: "email_not_allowlisted" };
  }

  const user = await rawPrisma.user.findUnique({
    where: { email: allowlistedEmail },
    select: { id: true, email: true },
  });
  if (!user) return { reset: true };

  return resetExactAllowlistedQaUser({ user, allowlistedEmail });
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

  return resetExactAllowlistedQaUser({ user, allowlistedEmail });
}
