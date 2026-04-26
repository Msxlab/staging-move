import { prisma } from "@/lib/db";
import {
  billReminderHtml,
  billReminderText,
  contractReminderHtml,
  contractReminderText,
  DEFAULT_APP_URL,
  emailVerificationContent,
  type EmailContent,
  htmlToPlainText,
  normalizeBaseUrl,
  passwordResetContent,
  sendEmailWithResult,
  weeklyDigestHtml,
  weeklyDigestText,
} from "@/lib/email";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

const SAFE_METADATA_KEYS = new Set([
  "kind",
  "templateSlug",
  "slug",
  "userId",
  "serviceId",
  "subscriptionId",
  "movingPlanId",
  "daysUntilDue",
  "daysRemaining",
  "weekStart",
  "weekEnd",
]);
const SENSITIVE_METADATA_KEY = /password|token|otp|secret|jwt|cookie/i;

function buildEmailMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return null;
  const safe: Record<string, string | number | boolean | null> = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (!SAFE_METADATA_KEYS.has(key) || SENSITIVE_METADATA_KEY.test(key)) continue;
    if (value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      safe[key] = typeof value === "string" ? value.slice(0, 191) : value;
    }
  }
  return JSON.stringify(safe);
}

function isUniqueConstraintError(error: any) {
  return error?.code === "P2002";
}

async function resolveAppUrl() {
  return normalizeBaseUrl(
    (await getRuntimeConfigValue("NEXT_PUBLIC_APP_URL")) || DEFAULT_APP_URL,
  );
}

async function resolveTemplateId(
  templateId?: string | null,
  templateSlug?: string | null,
): Promise<string | null> {
  if (templateId) return templateId;
  if (!templateSlug) return null;

  const template = await prisma.emailTemplate.findUnique({
    where: { slug: templateSlug },
    select: { id: true },
  });
  return template?.id || null;
}

export async function sendLoggedEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  templateId?: string | null;
  templateSlug?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; skipped: boolean }> {
  const templateId = await resolveTemplateId(opts.templateId, opts.templateSlug);
  const metadata = buildEmailMetadata({
    ...(opts.metadata || {}),
    templateSlug: opts.templateSlug || null,
  });
  let logId: string;

  try {
    const log = await prisma.emailLog.create({
      data: {
        templateId,
        dedupeKey: opts.dedupeKey ?? null,
        to: opts.to,
        subject: opts.subject,
        status: "PENDING",
        metadata,
      },
    });
    logId = log.id;
  } catch (error) {
    if (opts.dedupeKey && isUniqueConstraintError(error)) {
      const existing = await prisma.emailLog.findFirst({
        where: { dedupeKey: opts.dedupeKey },
      });
      if (!existing) {
        return { success: false, skipped: true };
      }

      if (existing.status === "FAILED") {
        const claimed = await prisma.emailLog.updateMany({
          where: { id: existing.id, status: "FAILED" },
          data: {
            status: "PENDING",
            error: null,
            sentAt: null,
            providerMessageId: null,
            templateId,
            to: opts.to,
            subject: opts.subject,
            metadata,
          },
        });
        if (claimed.count === 0) {
          return { success: false, skipped: true };
        }
        logId = existing.id;
      } else {
        return { success: existing.status === "SENT", skipped: true };
      }
    } else {
      console.error("[EMAIL] Failed to create email log:", error);
      throw error;
    }
  }

  const result = await sendEmailWithResult({
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
  });

  try {
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: result.success ? "SENT" : "FAILED",
        error: result.error,
        providerMessageId: result.providerMessageId,
        sentAt: result.success ? new Date() : null,
        metadata,
      },
    });
  } catch (error) {
    console.error("[EMAIL] Failed to update email log:", error);
  }

  return { success: result.success, skipped: false };
}

/**
 * Renders an email template from the DB by replacing {{variable}} placeholders.
 */
export async function renderTemplate(
  slug: string,
  variables: Record<string, string>,
): Promise<(EmailContent & { templateId: string; slug: string }) | null> {
  const template = await prisma.emailTemplate.findUnique({
    where: { slug },
  });

  if (!template || !template.isActive) return null;

  let subject = template.subject;
  let html = template.body;

  for (const [key, value] of Object.entries(variables)) {
    const escaped = escapeTemplateHtml(value);
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(pattern, value);
    html = html.replace(pattern, escaped);
  }

  return {
    subject,
    html,
    text: htmlToPlainText(html),
    templateId: template.id,
    slug: template.slug,
  };
}

/**
 * Send a DB-templated email and log it against the template row.
 */
export async function sendTemplatedEmail(opts: {
  to: string;
  slug: string;
  variables: Record<string, string>;
  userId?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const rendered = await renderTemplate(opts.slug, opts.variables);
  if (!rendered) {
    console.warn(`[EMAIL] Template '${opts.slug}' not found or inactive`);
    return false;
  }

  const result = await sendLoggedEmail({
    to: opts.to,
    subject: rendered.subject,
    html: rendered.html,
    text: rendered.text,
    templateId: rendered.templateId,
    templateSlug: opts.slug,
    dedupeKey: opts.dedupeKey,
    metadata: {
      slug: opts.slug,
      userId: opts.userId || null,
      ...(opts.metadata || {}),
    },
  });

  return result.success;
}

/**
 * Welcome email, sent when a new user signs up.
 */
export async function sendWelcomeEmail(user: {
  email: string;
  firstName?: string | null;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  return sendTemplatedEmail({
    to: user.email,
    slug: "welcome",
    dedupeKey: user.dedupeKey,
    variables: {
      firstName: user.firstName || "there",
      dashboardLink: `${appUrl}/dashboard`,
      appUrl,
    },
  });
}

/**
 * Email verification, sent after registration.
 */
export async function sendEmailVerificationEmail(opts: {
  userEmail: string;
  userName: string;
  verifyToken: string;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const verifyLink = `${appUrl}/verify-email/${encodeURIComponent(opts.verifyToken)}`;
  const content = emailVerificationContent({
    userName: opts.userName,
    verifyLink,
  });

  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "email-verify",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "email-verification" },
  });
  return result.success;
}

/**
 * Password reset or set-password link.
 */
export async function sendPasswordResetEmail(opts: {
  userEmail: string;
  userName: string;
  resetToken: string;
  mode?: "reset" | "set-password";
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const resetLink = `${appUrl}/reset-password/${encodeURIComponent(opts.resetToken)}`;
  const content = passwordResetContent({
    userName: opts.userName,
    resetLink,
    mode: opts.mode || "reset",
  });

  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "password-reset",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: opts.mode === "set-password" ? "set-password" : "password-reset",
    },
  });
  return result.success;
}

function escapeTemplateHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return (str || "").replace(/[&<>"']/g, (c) => map[c] || c);
}

export async function sendBillReminderEmail(opts: {
  userEmail: string;
  userName: string;
  serviceName: string;
  category: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const subject = `Bill reminder: ${opts.serviceName} - $${opts.amount.toFixed(2)} due in ${opts.daysUntilDue} day${opts.daysUntilDue !== 1 ? "s" : ""}`;
  const emailData = {
    userName: opts.userName,
    serviceName: opts.serviceName,
    category: opts.category,
    amount: opts.amount,
    dueDate: opts.dueDate,
    daysUntilDue: opts.daysUntilDue,
    appUrl,
  };
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject,
    html: billReminderHtml(emailData),
    text: billReminderText(emailData),
    templateSlug: "bill-reminder",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "bill-reminder",
      daysUntilDue: opts.daysUntilDue,
      ...(opts.metadata || {}),
    },
  });

  return result.success;
}

export async function sendWeeklyDigestEmail(opts: {
  userEmail: string;
  userName: string;
  weekStart: string;
  weekEnd: string;
  upcomingBills: { name: string; amount: number; dueDate: string }[];
  totalExpenses: number;
  newServices: number;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const emailData = {
    userName: opts.userName,
    weekStart: opts.weekStart,
    weekEnd: opts.weekEnd,
    upcomingBills: opts.upcomingBills,
    totalExpenses: opts.totalExpenses,
    newServices: opts.newServices,
    appUrl,
  };
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: `Your weekly digest - ${opts.weekStart} to ${opts.weekEnd}`,
    html: weeklyDigestHtml(emailData),
    text: weeklyDigestText(emailData),
    templateSlug: "weekly-digest",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "weekly-digest",
      weekStart: opts.weekStart,
      weekEnd: opts.weekEnd,
      ...(opts.metadata || {}),
    },
  });

  return result.success;
}

export async function sendContractReminderEmail(opts: {
  userEmail: string;
  userName: string;
  serviceName: string;
  contractEndDate: string;
  daysRemaining: number;
  serviceLink: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const subject = `${opts.serviceName} contract ends in ${opts.daysRemaining} day${opts.daysRemaining === 1 ? "" : "s"}`;
  const emailData = {
    userName: opts.userName || "there",
    serviceName: opts.serviceName,
    contractEndDate: opts.contractEndDate,
    daysRemaining: opts.daysRemaining,
    serviceLink: opts.serviceLink,
  };
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject,
    html: contractReminderHtml(emailData),
    text: contractReminderText(emailData),
    templateSlug: "contract-reminder",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "contract-reminder",
      daysRemaining: opts.daysRemaining,
      ...(opts.metadata || {}),
    },
  });

  return result.success;
}

/**
 * Trial expiring email, sent before a free trial ends.
 */
export async function sendTrialExpiringEmail(opts: {
  userEmail: string;
  userName: string;
  daysRemaining: number;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  return sendTemplatedEmail({
    to: opts.userEmail,
    slug: "trial-expiring",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "trial-expiring",
      daysRemaining: opts.daysRemaining,
      ...(opts.metadata || {}),
    },
    variables: {
      firstName: opts.userName || "there",
      daysLeft: String(opts.daysRemaining),
      upgradeLink: `${appUrl}/settings/subscription`,
      appUrl,
    },
  });
}

/**
 * Move reminder email, sent before moving day.
 */
export async function sendMoveReminderEmail(opts: {
  userEmail: string;
  userName: string;
  fromCity: string;
  toCity: string;
  moveDate: string;
  daysRemaining: number;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  return sendTemplatedEmail({
    to: opts.userEmail,
    slug: "move-reminder",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: "move-reminder",
      daysRemaining: opts.daysRemaining,
      ...(opts.metadata || {}),
    },
    variables: {
      firstName: opts.userName || "there",
      fromCity: opts.fromCity,
      toCity: opts.toCity,
      moveDate: opts.moveDate,
      appUrl,
    },
  });
}
