import { prisma } from "@/lib/db";
import {
  appendUnsubscribeFooter,
  billReminderHtml,
  billReminderText,
  buildUnsubscribeHeaders,
  contractReminderHtml,
  contractReminderText,
  DEFAULT_APP_URL,
  emailVerificationContent,
  type EmailContent,
  htmlToPlainText,
  normalizeBaseUrl,
  passwordResetContent,
  paymentFailedContent,
  resolveEmailLocale,
  securityNoticeContent,
  type SecurityNoticeKind,
  sendEmailWithResult,
  subscriptionActivatedContent,
  subscriptionCanceledContent,
  weeklyDigestHtml,
  weeklyDigestText,
} from "@/lib/email";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import {
  buildUnsubscribeUrl,
  signUnsubscribeToken,
  type UnsubscribeKind,
} from "@/lib/unsubscribe";
import { isEmailTypeOptedOut } from "@/lib/unsubscribe-actions";

const SAFE_METADATA_KEYS = new Set([
  "kind",
  "templateSlug",
  "slug",
  "fromAddress",
  "configError",
  "resendApiError",
  "retryAvailable",
  "templateUnavailable",
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

/**
 * Builds the per-recipient unsubscribe URL + List-Unsubscribe headers for
 * a marketing-class email. Returns null if no userId is provided (e.g.
 * tests or one-off ops sends) so the sender keeps working without
 * compliance plumbing.
 *
 * The "kind" maps to the type the email belongs to so the user lands on
 * an unsub page that pre-targets that category. The token itself is the
 * same per-user signature regardless of kind, so future emails can reuse
 * one-click links without DB lookups on click.
 */
function buildMarketingUnsubscribe(
  userId: string | null | undefined,
  appUrl: string,
  kind: UnsubscribeKind,
): { url: string; headers: Record<string, string> } | null {
  if (!userId) return null;
  try {
    const token = signUnsubscribeToken(userId);
    const url = buildUnsubscribeUrl(appUrl, token, kind);
    const headers = buildUnsubscribeHeaders(url);
    return { url, headers };
  } catch (err) {
    // Missing secret in dev — not worth blocking the email; log once.
    console.warn("[EMAIL] unsubscribe token unavailable:", err instanceof Error ? err.message : err);
    return null;
  }
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
  headers?: Record<string, string>;
}): Promise<{ success: boolean; skipped: boolean }> {
  const templateId = await resolveTemplateId(opts.templateId, opts.templateSlug);
  const metadataInput = {
    ...(opts.metadata || {}),
    templateSlug: opts.templateSlug || null,
  };
  const metadata = buildEmailMetadata(metadataInput);
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
    ...(opts.headers ? { headers: opts.headers } : {}),
  });
  const resultMetadata = buildEmailMetadata({
    ...metadataInput,
    fromAddress: result.fromEmail,
    configError: Boolean(result.configError),
    resendApiError: Boolean(result.error && !result.configError),
    retryAvailable: !result.success,
  });

  try {
    await prisma.emailLog.update({
      where: { id: logId },
      data: {
        status: result.success ? "SENT" : "FAILED",
        error: result.error,
        providerMessageId: result.providerMessageId,
        sentAt: result.success ? new Date() : null,
        metadata: resultMetadata,
      },
    });
  } catch (error) {
    console.error("[EMAIL] Failed to update email log:", error);
  }

  return { success: result.success, skipped: false };
}

async function logUnavailableTemplateEmail(opts: {
  to: string;
  slug: string;
  userId?: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}) {
  const error = `Email template '${opts.slug}' is missing or inactive.`;
  const metadata = buildEmailMetadata({
    ...(opts.metadata || {}),
    kind: "template-unavailable",
    slug: opts.slug,
    templateSlug: opts.slug,
    userId: opts.userId || null,
    templateUnavailable: true,
    retryAvailable: true,
  });

  try {
    await prisma.emailLog.create({
      data: {
        templateId: null,
        dedupeKey: opts.dedupeKey ?? null,
        to: opts.to,
        subject: `Email template unavailable: ${opts.slug}`.slice(0, 200),
        status: "FAILED",
        error,
        metadata,
      },
    });
  } catch (error) {
    if (opts.dedupeKey && isUniqueConstraintError(error)) return;
    console.error("[EMAIL] Failed to log unavailable email template:", error);
  }
}

/**
 * Renders an email template from the DB by replacing {{variable}} placeholders.
 */
/**
 * Resolve the actual template slug for a given locale. If `${baseSlug}-${locale}`
 * exists and is active, that is used; otherwise we fall back to the base slug.
 * "en" always returns the base slug (English is the canonical content).
 */
async function resolveLocalizedSlug(
  baseSlug: string,
  locale?: string | null,
): Promise<string> {
  const normalized = (locale || "").toLowerCase();
  if (!normalized || normalized === "en" || normalized.startsWith("en-")) {
    return baseSlug;
  }
  const lang = normalized.split("-")[0];
  const candidate = `${baseSlug}-${lang}`;
  const localized = await prisma.emailTemplate.findUnique({
    where: { slug: candidate },
    select: { isActive: true },
  });
  return localized?.isActive ? candidate : baseSlug;
}

export async function renderTemplate(
  slug: string,
  variables: Record<string, string>,
  locale?: string | null,
): Promise<(EmailContent & { templateId: string; slug: string }) | null> {
  const effectiveSlug = await resolveLocalizedSlug(slug, locale);
  const template = await prisma.emailTemplate.findUnique({
    where: { slug: effectiveSlug },
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
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
  headers?: Record<string, string>;
  /**
   * When set, appends a per-recipient unsubscribe footer after the
   * template renders. Saves us from threading a {{unsubscribeLink}}
   * variable through every marketing template seed.
   */
  unsubscribeUrl?: string | null;
}): Promise<boolean> {
  const rendered = await renderTemplate(opts.slug, opts.variables, opts.locale);
  if (!rendered) {
    console.warn(`[EMAIL] Template '${opts.slug}' not found or inactive`);
    await logUnavailableTemplateEmail({
      to: opts.to,
      slug: opts.slug,
      userId: opts.userId,
      dedupeKey: opts.dedupeKey,
      metadata: opts.metadata,
    });
    return false;
  }

  const finalContent = opts.unsubscribeUrl
    ? appendUnsubscribeFooter(
        { subject: rendered.subject, html: rendered.html, text: rendered.text },
        opts.unsubscribeUrl,
        resolveEmailLocale(opts.locale),
      )
    : { subject: rendered.subject, html: rendered.html, text: rendered.text };

  const result = await sendLoggedEmail({
    to: opts.to,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateId: rendered.templateId,
    templateSlug: rendered.slug,
    dedupeKey: opts.dedupeKey,
    headers: opts.headers,
    metadata: {
      slug: opts.slug,
      renderedSlug: rendered.slug,
      locale: opts.locale || null,
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
  locale?: string | null;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  return sendTemplatedEmail({
    to: user.email,
    slug: "welcome",
    locale: user.locale,
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
function isNonEnglishLocale(locale?: string | null): boolean {
  if (!locale) return false;
  const normalized = locale.toLowerCase();
  return normalized !== "en" && !normalized.startsWith("en-");
}

export async function sendEmailVerificationEmail(opts: {
  userEmail: string;
  userName: string;
  verifyToken: string;
  locale?: string | null;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const verifyLink = `${appUrl}/verify-email/${encodeURIComponent(opts.verifyToken)}`;

  // For non-English locales, prefer the DB-templated translation when available.
  // English keeps the inline content path so behavior is unchanged for the
  // dominant traffic.
  if (isNonEnglishLocale(opts.locale)) {
    const rendered = await renderTemplate(
      "email-verify",
      { firstName: opts.userName, verifyLink },
      opts.locale,
    );
    if (rendered && rendered.slug !== "email-verify") {
      const result = await sendLoggedEmail({
        to: opts.userEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        templateId: rendered.templateId,
        templateSlug: rendered.slug,
        dedupeKey: opts.dedupeKey,
        metadata: { kind: "email-verification", locale: opts.locale ?? null },
      });
      return result.success;
    }
  }

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
    metadata: { kind: "email-verification", locale: opts.locale ?? null },
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
  locale?: string | null;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const resetLink = `${appUrl}/reset-password/${encodeURIComponent(opts.resetToken)}`;
  const mode = opts.mode || "reset";

  // Reset (not set-password) has a Spanish DB template. Set-password is a
  // different flow with inline-only content.
  if (mode === "reset" && isNonEnglishLocale(opts.locale)) {
    const rendered = await renderTemplate(
      "password-reset",
      { firstName: opts.userName, resetLink },
      opts.locale,
    );
    if (rendered && rendered.slug !== "password-reset") {
      const result = await sendLoggedEmail({
        to: opts.userEmail,
        subject: rendered.subject,
        html: rendered.html,
        text: rendered.text,
        templateId: rendered.templateId,
        templateSlug: rendered.slug,
        dedupeKey: opts.dedupeKey,
        metadata: { kind: "password-reset", locale: opts.locale ?? null },
      });
      return result.success;
    }
  }

  const content = passwordResetContent({
    userName: opts.userName,
    resetLink,
    mode,
  });

  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "password-reset",
    dedupeKey: opts.dedupeKey,
    metadata: {
      kind: mode === "set-password" ? "set-password" : "password-reset",
      locale: opts.locale ?? null,
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
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "REMINDER"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
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
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "reminder");
  const baseContent: EmailContent = {
    subject,
    html: billReminderHtml(emailData),
    text: billReminderText(emailData),
  };
  const finalContent = unsubscribe ? appendUnsubscribeFooter(baseContent, unsubscribe.url, locale) : baseContent;
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateSlug: "bill-reminder",
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
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
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "MARKETING"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const emailData = {
    userName: opts.userName,
    weekStart: opts.weekStart,
    weekEnd: opts.weekEnd,
    upcomingBills: opts.upcomingBills,
    totalExpenses: opts.totalExpenses,
    newServices: opts.newServices,
    appUrl,
  };
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "marketing");
  const baseContent: EmailContent = {
    subject: `Your weekly digest - ${opts.weekStart} to ${opts.weekEnd}`,
    html: weeklyDigestHtml(emailData),
    text: weeklyDigestText(emailData),
  };
  const finalContent = unsubscribe ? appendUnsubscribeFooter(baseContent, unsubscribe.url, locale) : baseContent;
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateSlug: "weekly-digest",
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
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
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "REMINDER"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const subject = `${opts.serviceName} contract ends in ${opts.daysRemaining} day${opts.daysRemaining === 1 ? "" : "s"}`;
  const emailData = {
    userName: opts.userName || "there",
    serviceName: opts.serviceName,
    contractEndDate: opts.contractEndDate,
    daysRemaining: opts.daysRemaining,
    serviceLink: opts.serviceLink,
  };
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "reminder");
  const baseContent: EmailContent = {
    subject,
    html: contractReminderHtml(emailData),
    text: contractReminderText(emailData),
  };
  const finalContent = unsubscribe ? appendUnsubscribeFooter(baseContent, unsubscribe.url, locale) : baseContent;
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: finalContent.subject,
    html: finalContent.html,
    text: finalContent.text,
    templateSlug: "contract-reminder",
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
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
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "MARKETING"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "marketing");
  return sendTemplatedEmail({
    to: opts.userEmail,
    slug: "trial-expiring",
    locale: opts.locale,
    userId: opts.userId ?? undefined,
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    unsubscribeUrl: unsubscribe?.url,
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
  userId?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  if (opts.userId && (await isEmailTypeOptedOut(opts.userId, "REMINDER"))) {
    return false;
  }
  const appUrl = await resolveAppUrl();
  const unsubscribe = buildMarketingUnsubscribe(opts.userId, appUrl, "reminder");
  return sendTemplatedEmail({
    to: opts.userEmail,
    slug: "move-reminder",
    locale: opts.locale,
    userId: opts.userId ?? undefined,
    dedupeKey: opts.dedupeKey,
    headers: unsubscribe?.headers,
    unsubscribeUrl: unsubscribe?.url,
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

/**
 * Subscription activated, sent after Stripe checkout completes.
 */
export async function sendSubscriptionActivatedEmail(opts: {
  userEmail: string;
  userName: string;
  planLabel: string;
  amountFormatted?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const content = subscriptionActivatedContent({
    userName: opts.userName,
    planLabel: opts.planLabel,
    amountFormatted: opts.amountFormatted,
    manageLink: `${appUrl}/settings/subscription`,
    locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "subscription-activated",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "subscription-activated", ...(opts.metadata || {}) },
  });
  return result.success;
}

/**
 * Subscription canceled, sent on customer.subscription.deleted.
 */
export async function sendSubscriptionCanceledEmail(opts: {
  userEmail: string;
  userName: string;
  planLabel: string;
  accessEndsOn?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const content = subscriptionCanceledContent({
    userName: opts.userName,
    planLabel: opts.planLabel,
    accessEndsOn: opts.accessEndsOn,
    reactivateLink: `${appUrl}/settings/subscription`,
    locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "subscription-canceled",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "subscription-canceled", ...(opts.metadata || {}) },
  });
  return result.success;
}

/**
 * Payment failed, sent on invoice.payment_failed.
 */
export async function sendPaymentFailedEmail(opts: {
  userEmail: string;
  userName: string;
  amountFormatted?: string | null;
  nextAttemptOn?: string | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const content = paymentFailedContent({
    userName: opts.userName,
    amountFormatted: opts.amountFormatted,
    nextAttemptOn: opts.nextAttemptOn,
    retryLink: `${appUrl}/settings/subscription`,
    locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: "payment-failed",
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "payment-failed", ...(opts.metadata || {}) },
  });
  return result.success;
}

/**
 * Account-security notice (password changed, MFA toggled, OAuth linked, deletion requested).
 *
 * Single sender that branches on `kind` so all security-event copy lives
 * alongside each other in `securityNoticeContent` and we don't sprawl
 * one wrapper per event into this module.
 */
export async function sendSecurityNoticeEmail(opts: {
  userEmail: string;
  userName: string;
  kind: SecurityNoticeKind;
  detail?: string | null;
  occurredAt?: Date | null;
  locale?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = await resolveAppUrl();
  const locale = resolveEmailLocale(opts.locale);
  const occurredAt = opts.occurredAt ? opts.occurredAt.toISOString() : null;
  const content = securityNoticeContent({
    userName: opts.userName,
    kind: opts.kind,
    detail: opts.detail,
    occurredAt,
    manageLink: `${appUrl}/settings/security`,
    locale,
  });
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: content.subject,
    html: content.html,
    text: content.text,
    templateSlug: `security-${opts.kind}`,
    dedupeKey: opts.dedupeKey,
    metadata: { kind: `security-${opts.kind}`, ...(opts.metadata || {}) },
  });
  return result.success;
}
