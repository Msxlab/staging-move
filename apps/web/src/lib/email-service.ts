import { prisma } from "@/lib/db";
import { billReminderHtml, contractReminderHtml, sendEmailWithResult, weeklyDigestHtml } from "@/lib/email";

function buildEmailMetadata(metadata?: Record<string, unknown>) {
  if (!metadata) return null;
  return JSON.stringify(metadata);
}

function isUniqueConstraintError(error: any) {
  return error?.code === "P2002";
}

export async function sendLoggedEmail(opts: {
  to: string;
  subject: string;
  html: string;
  templateId?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ success: boolean; skipped: boolean }> {
  const metadata = buildEmailMetadata(opts.metadata);
  let logId: string;

  try {
    const log = await prisma.emailLog.create({
      data: {
        templateId: opts.templateId ?? null,
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
      const existing = await prisma.emailLog.findFirst({ where: { dedupeKey: opts.dedupeKey } });
      if (!existing) {
        return { success: false, skipped: true };
      }

      if (existing.status === "FAILED") {
        const claimed = await prisma.emailLog.updateMany({
          where: { id: existing.id, status: "FAILED" },
          data: { status: "PENDING", error: null, sentAt: null },
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
 * Falls back to raw body if template not found.
 */
export async function renderTemplate(
  slug: string,
  variables: Record<string, string>
): Promise<{ subject: string; html: string } | null> {
  const template = await prisma.emailTemplate.findUnique({
    where: { slug },
  });

  if (!template || !template.isActive) return null;

  let subject = template.subject;
  let html = template.body;

  for (const [key, value] of Object.entries(variables)) {
    const escaped = escapeHtml(value);
    const pattern = new RegExp(`\\{\\{${key}\\}\\}`, "g");
    subject = subject.replace(pattern, value); // Subject: plain text
    html = html.replace(pattern, escaped); // Body: escaped for XSS
  }

  return { subject, html };
}

/**
 * Send a templated email and log it.
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

  const template = await prisma.emailTemplate.findUnique({ where: { slug: opts.slug } });
  const result = await sendLoggedEmail({
    to: opts.to,
    subject: rendered.subject,
    html: rendered.html,
    templateId: template?.id,
    dedupeKey: opts.dedupeKey,
    metadata: {
      slug: opts.slug,
      userId: opts.userId || null,
      ...(opts.metadata || {}),
    },
  });

  return result.success;
}

// ── Specific email triggers ──────────────────────────────────

/**
 * Welcome email — sent when a new user signs up
 */
export async function sendWelcomeEmail(user: {
  email: string;
  firstName?: string | null;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
 * Email verification — sent after registration.
 */
export async function sendEmailVerificationEmail(opts: {
  userEmail: string;
  userName: string;
  verifyToken: string;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const verifyLink = `${appUrl}/verify-email/${encodeURIComponent(opts.verifyToken)}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#f97316,#06b6d4);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Verify your email</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#334155;font-size:15px;">Hi <strong>${escapeHtml(opts.userName)}</strong>,</p>
      <p style="color:#334155;font-size:15px;line-height:1.5;">
        Thanks for creating a LocateFlow account. Confirm your email to finish setup:
      </p>
      <a href="${verifyLink}" style="display:block;text-align:center;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin:20px 0;">
        Verify Email
      </a>
      <p style="color:#64748b;font-size:12px;">This link expires in 24 hours. If you didn't sign up, you can ignore this email.</p>
    </div>
  </div>
</body></html>`;

  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: "Verify your LocateFlow email",
    html,
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "email-verification" },
  });
  return result.success;
}

/**
 * Password reset — sent when user requests reset.
 */
export async function sendPasswordResetEmail(opts: {
  userEmail: string;
  userName: string;
  resetToken: string;
  dedupeKey?: string;
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const resetLink = `${appUrl}/reset-password/${encodeURIComponent(opts.resetToken)}`;
  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#f97316,#06b6d4);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:22px;">Reset your password</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#334155;font-size:15px;">Hi <strong>${escapeHtml(opts.userName)}</strong>,</p>
      <p style="color:#334155;font-size:15px;line-height:1.5;">
        We received a request to reset your LocateFlow password.
        This link is valid for 1 hour.
      </p>
      <a href="${resetLink}" style="display:block;text-align:center;background:#f97316;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin:20px 0;">
        Reset Password
      </a>
      <p style="color:#64748b;font-size:12px;">If you didn't request a reset, you can safely ignore this email — your password won't change.</p>
    </div>
  </div>
</body></html>`;

  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: "Reset your LocateFlow password",
    html,
    dedupeKey: opts.dedupeKey,
    metadata: { kind: "password-reset" },
  });
  return result.success;
}

function escapeHtml(str: string): string {
  const map: Record<string, string> = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
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
  const subject = `Bill Reminder: ${opts.serviceName} — $${opts.amount.toFixed(2)} due in ${opts.daysUntilDue} day${opts.daysUntilDue !== 1 ? "s" : ""}`;
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject,
    html: billReminderHtml({
      userName: opts.userName,
      serviceName: opts.serviceName,
      category: opts.category,
      amount: opts.amount,
      dueDate: opts.dueDate,
      daysUntilDue: opts.daysUntilDue,
    }),
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
  pendingTasks: number;
  completedTasks: number;
  totalExpenses: number;
  newServices: number;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject: `Your Weekly Digest — ${opts.weekStart} to ${opts.weekEnd}`,
    html: weeklyDigestHtml({
      userName: opts.userName,
      weekStart: opts.weekStart,
      weekEnd: opts.weekEnd,
      upcomingBills: opts.upcomingBills,
      pendingTasks: opts.pendingTasks,
      completedTasks: opts.completedTasks,
      totalExpenses: opts.totalExpenses,
      newServices: opts.newServices,
    }),
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
  const result = await sendLoggedEmail({
    to: opts.userEmail,
    subject,
    html: contractReminderHtml({
      userName: opts.userName || "there",
      serviceName: opts.serviceName,
      contractEndDate: opts.contractEndDate,
      daysRemaining: opts.daysRemaining,
      serviceLink: opts.serviceLink,
    }),
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
 * Trial expiring email — sent 7, 3, 1 days before trial ends
 */
export async function sendTrialExpiringEmail(opts: {
  userEmail: string;
  userName: string;
  daysRemaining: number;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
    },
  });
}

/**
 * Move reminder email — sent 7, 3, 1 days before move date
 */
export async function sendMoveReminderEmail(opts: {
  userEmail: string;
  userName: string;
  fromCity: string;
  toCity: string;
  moveDate: string;
  daysRemaining: number;
  completedTasks: number;
  totalTasks: number;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}): Promise<boolean> {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
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
      pendingTasks: String(opts.totalTasks - opts.completedTasks),
      appUrl,
    },
  });
}

function escapeHtml(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (c) => map[c] || c);
}
