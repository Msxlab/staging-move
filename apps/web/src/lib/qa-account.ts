import { rawPrisma } from "@/lib/db";
import {
  DEFAULT_BILLING_PLAN,
  type BillingPlan,
} from "@/lib/shared-billing";
import { normalizeRuntimeConfigValue } from "@/lib/shared-runtime-config";

export const QA_RESETTABLE_ACCOUNT_EMAIL_KEY = "QA_RESETTABLE_ACCOUNT_EMAIL";
export const QA_PERSONA_ACCOUNTS_KEY = "QA_PERSONA_ACCOUNTS";
export const STORE_REVIEW_ACCOUNT_EMAILS_KEY = "STORE_REVIEW_ACCOUNT_EMAILS";
const STORE_REVIEW_ACCOUNT_EMAIL_KEYS = [
  STORE_REVIEW_ACCOUNT_EMAILS_KEY,
  "GOOGLE_PLAY_TEST_PURCHASE_USER_EMAILS",
  "APPLE_SANDBOX_PURCHASE_USER_EMAILS",
] as const;

const QA_PERSONA_GRANT_SOURCE = "QA_PERSONA";
const QA_PERSONA_PREMIUM_YEARS = 10;
const QA_FREE_ACCESS_DAYS = 14;
const QA_PERSONA_PLANS = new Set<BillingPlan>([
  "FREE_TRIAL",
  "INDIVIDUAL",
  "FAMILY",
  "PRO",
]);

type QaAccountResetSkipReason =
  | "config_disabled"
  | "email_not_allowlisted"
  | "session_not_allowlisted"
  | "user_not_allowlisted"
  | "owned_workspace_has_other_members";

export type QaAccountResetResult =
  | { reset: true }
  | { reset: false; reason: QaAccountResetSkipReason };

export type QaPersonaGrantResult =
  | { applied: true; email: string; plan: BillingPlan }
  | { applied: false; reason: "not_qa_persona" | "config_disabled" };

export interface QaPersonaAccount {
  email: string;
  plan: BillingPlan;
}

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

function parseQaPersonaPlan(value: string | null | undefined): BillingPlan | null {
  const raw = normalizeRuntimeConfigValue(value)?.toUpperCase();
  if (!raw) return null;
  const plan = raw === "FREE" ? DEFAULT_BILLING_PLAN : raw;
  return QA_PERSONA_PLANS.has(plan as BillingPlan) ? (plan as BillingPlan) : null;
}

function parseQaPersonaAccounts(value: string | null | undefined): QaPersonaAccount[] {
  const raw = normalizeRuntimeConfigValue(value);
  if (!raw) return [];
  const entries = raw
    .split(/[,\n;]/)
    .map((entry) => entry.trim())
    .filter(Boolean);
  if (entries.length === 0) return [];

  const parsed: QaPersonaAccount[] = [];
  const seen = new Set<string>();
  for (const entry of entries) {
    const [emailRaw, planRaw, ...extra] = entry.split(":");
    if (!emailRaw || !planRaw || extra.length > 0) return [];
    const email = normalizeEmail(emailRaw);
    const plan = parseQaPersonaPlan(planRaw);
    if (!email || !SINGLE_EMAIL_PATTERN.test(email) || !plan) return [];
    if (!seen.has(email)) {
      parsed.push({ email, plan });
      seen.add(email);
    }
  }
  return parsed;
}

export function getQaPersonaAccounts(
  env: Record<string, string | undefined> = process.env,
): QaPersonaAccount[] {
  const personas = parseQaPersonaAccounts(env[QA_PERSONA_ACCOUNTS_KEY]);
  const legacyQaEmail = getQaResettableAccountEmail(env);
  if (legacyQaEmail && !personas.some((persona) => persona.email === legacyQaEmail)) {
    personas.unshift({ email: legacyQaEmail, plan: DEFAULT_BILLING_PLAN });
  }
  return personas;
}

export function getQaPersonaAccountForEmail(
  email: string | null | undefined,
  env: Record<string, string | undefined> = process.env,
): QaPersonaAccount | null {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  return getQaPersonaAccounts(env).find((persona) => persona.email === normalized) ?? null;
}

export function getQaResettableAccountEmails(
  env: Record<string, string | undefined> = process.env,
): string[] {
  return getQaPersonaAccounts(env).map((persona) => persona.email);
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
  return Boolean(getQaPersonaAccountForEmail(email, env));
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
  if (getQaPersonaAccountForEmail(normalized, env)) return normalized;
  const reviewEmails = new Set([
    ...getStoreReviewAccountEmails(env),
    ...extraStoreReviewEmails.map((item) => normalizeEmail(item)).filter((item): item is string => Boolean(item)),
  ]);
  return reviewEmails.has(normalized) ? normalized : null;
}

function qaFreeAccessEndsAt(now: Date): Date {
  return new Date(now.getTime() + QA_FREE_ACCESS_DAYS * 24 * 60 * 60 * 1000);
}

function qaPremiumUntil(now: Date): Date {
  const premiumUntil = new Date(now);
  premiumUntil.setFullYear(premiumUntil.getFullYear() + QA_PERSONA_PREMIUM_YEARS);
  return premiumUntil;
}

export async function applyQaPersonaSubscriptionForUser(input: {
  userId: string;
  email: string | null | undefined;
  now?: Date;
}): Promise<QaPersonaGrantResult> {
  const persona = getQaPersonaAccountForEmail(input.email);
  if (!persona) {
    return {
      applied: false,
      reason: getQaPersonaAccounts().length > 0 ? "not_qa_persona" : "config_disabled",
    };
  }

  const now = input.now ?? new Date();
  const premiumNote = `Auto-granted for ${persona.email} QA persona. No billing provider.`;
  if (persona.plan === DEFAULT_BILLING_PLAN) {
    const freeAccessEndsAt = qaFreeAccessEndsAt(now);
    await rawPrisma.subscription.upsert({
      where: { userId: input.userId },
      update: {
        plan: DEFAULT_BILLING_PLAN,
        status: "FREE_ACCESS",
        provider: "TRIAL",
        platform: "web",
        accessType: "FREE_ACCESS",
        freeAccessEndsAt,
        trialEndsAt: null,
        premiumUntil: null,
        premiumGrantedBy: null,
        premiumGrantedAt: null,
        premiumNote: null,
        cancelAtPeriodEnd: false,
        autoRenew: false,
      },
      create: {
        userId: input.userId,
        plan: DEFAULT_BILLING_PLAN,
        status: "FREE_ACCESS",
        provider: "TRIAL",
        platform: "web",
        accessType: "FREE_ACCESS",
        freeAccessEndsAt,
      },
    });
    return { applied: true, email: persona.email, plan: persona.plan };
  }

  const premiumUntil = qaPremiumUntil(now);
  await rawPrisma.subscription.upsert({
    where: { userId: input.userId },
    update: {
      plan: persona.plan,
      status: "ACTIVE",
      provider: "ADMIN",
      platform: null,
      accessType: "PAID",
      currentPeriodEndsAt: null,
      freeAccessEndsAt: null,
      trialEndsAt: null,
      premiumUntil,
      premiumGrantedBy: QA_PERSONA_GRANT_SOURCE,
      premiumGrantedAt: now,
      premiumNote,
      cancelAtPeriodEnd: false,
      autoRenew: false,
      canceledAt: null,
    },
    create: {
      userId: input.userId,
      plan: persona.plan,
      status: "ACTIVE",
      provider: "ADMIN",
      platform: null,
      accessType: "PAID",
      premiumUntil,
      premiumGrantedBy: QA_PERSONA_GRANT_SOURCE,
      premiumGrantedAt: now,
      premiumNote,
      cancelAtPeriodEnd: false,
      autoRenew: false,
    },
  });

  return { applied: true, email: persona.email, plan: persona.plan };
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
      getQaPersonaAccounts().length > 0 ||
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
  const persona = getQaPersonaAccountForEmail(input.sessionEmail);
  if (!persona) {
    return {
      reset: false,
      reason: getQaPersonaAccounts().length > 0 ? "session_not_allowlisted" : "config_disabled",
    };
  }

  if (!input.userId || normalizeEmail(input.sessionEmail) !== persona.email) {
    return { reset: false, reason: "session_not_allowlisted" };
  }

  const user = await rawPrisma.user.findUnique({
    where: { id: input.userId },
    select: { id: true, email: true },
  });
  if (!user || normalizeEmail(user.email) !== persona.email) {
    return { reset: false, reason: "user_not_allowlisted" };
  }

  return resetExactAllowlistedQaUser({ user, allowlistedEmail: persona.email });
}
