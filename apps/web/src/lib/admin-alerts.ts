/**
 * Owner/admin alert emails — instant operator notifications for business
 * events (new user signup, new subscription purchase).
 *
 * Design constraints (owner decision, Jun 2026):
 * - NEVER throw. These helpers are called from registration, OAuth account
 *   creation, the Stripe webhook, and IAP verification — a broken alert must
 *   never break any of those flows. Every failure is caught and logged.
 * - QA exclusion is enforced HERE (single enforcement point): events for the
 *   allowlisted QA account (QA_RESETTABLE_ACCOUNT_EMAIL) are suppressed even
 *   when a caller forgets to gate.
 * - Recipients come from runtime config ADMIN_ALERT_EMAIL, falling back to
 *   ALERT_EMAIL_TO (same resolution as the admin-daily-digest cron). Both
 *   accept a comma-separated list.
 * - Dedupe: at most one email per event per recipient via emailLog.dedupeKey
 *   (`admin-alert:signup:<userId>:<to>` / `admin-alert:purchase:<key>:<to>`).
 *   The `:<to>` suffix is required because dedupeKey is globally unique —
 *   without it the second configured recipient would be skipped as a
 *   duplicate (same per-recipient pattern as the admin digest).
 * - Operator-facing, English-only by design (matches the admin daily digest);
 *   user-facing emails keep their own en/es handling elsewhere.
 */

import { escapeHtml, htmlToPlainText } from "@/lib/email";
import { sendLoggedEmail } from "@/lib/email-service";
import { isAllowlistedQaEmail } from "@/lib/qa-account";
import { getRuntimeConfigValue } from "@/lib/runtime-config";

const LOG_PREFIX = "[ADMIN-ALERT]";

export type AdminPurchaseAlertProvider = "stripe" | "apple" | "google";

/**
 * ADMIN_ALERT_EMAIL || ALERT_EMAIL_TO, comma-split, trimmed, lowercased,
 * deduped. Empty array when neither is configured (alerts silently skip).
 */
export async function resolveAdminAlertRecipients(): Promise<string[]> {
  const raw =
    (await getRuntimeConfigValue("ADMIN_ALERT_EMAIL")) ||
    (await getRuntimeConfigValue("ALERT_EMAIL_TO")) ||
    "";
  const recipients = new Set<string>();
  for (const part of raw.split(",")) {
    const email = part.trim().toLowerCase();
    if (email && email.includes("@")) recipients.add(email);
  }
  return [...recipients];
}

/** Deep link to the admin panel's user page; null when no admin URL is configured. */
async function resolveAdminUserUrl(userId: string): Promise<string | null> {
  const base = (
    (await getRuntimeConfigValue("NEXT_PUBLIC_ADMIN_URL")) ||
    process.env.NEXT_PUBLIC_ADMIN_URL ||
    ""
  ).replace(/\/+$/, "");
  return base ? `${base}/users/${encodeURIComponent(userId)}` : null;
}

/** "FAMILY" -> "Family", null -> "Subscription". Local copy to keep this module dependency-light. */
function planLabel(plan: string | null | undefined): string {
  return (plan || "subscription")
    .toLowerCase()
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function buildAlertHtml(opts: {
  heading: string;
  rows: Array<[string, string | null | undefined]>;
  adminUserUrl: string | null;
}): string {
  const rowsHtml = opts.rows
    .filter(([, value]) => value !== null && value !== undefined && value !== "")
    .map(
      ([label, value]) =>
        `<li style="margin:0 0 6px;color:#334155;"><strong>${escapeHtml(label)}:</strong> ${escapeHtml(String(value))}</li>`,
    )
    .join("");
  const linkHtml = opts.adminUserUrl
    ? `<p style="margin:12px 0 0;"><a href="${escapeHtml(opts.adminUserUrl)}" style="color:#2563eb;">Open user in admin</a></p>`
    : "";
  return (
    `<div style="font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;">` +
    `<h2 style="color:#0f172a;margin:0 0 10px;">${escapeHtml(opts.heading)}</h2>` +
    `<ul style="padding-left:18px;margin:0;">${rowsHtml}</ul>` +
    linkHtml +
    `</div>`
  );
}

/**
 * Shared fan-out: one logged email per configured recipient. Each send is
 * individually caught so one bad recipient never blocks the rest. Returns
 * true when at least one email was sent successfully.
 */
async function dispatchAdminAlert(opts: {
  kind: "admin-signup-alert" | "admin-purchase-alert";
  /** Event identity WITHOUT the `admin-alert:` prefix or recipient suffix. */
  eventKey: string;
  subject: string;
  heading: string;
  rows: Array<[string, string | null | undefined]>;
  userId: string;
  metadata: Record<string, unknown>;
}): Promise<boolean> {
  const recipients = await resolveAdminAlertRecipients();
  if (recipients.length === 0) return false;

  const adminUserUrl = await resolveAdminUserUrl(opts.userId);
  const html = buildAlertHtml({
    heading: opts.heading,
    rows: opts.rows,
    adminUserUrl,
  });
  const text = htmlToPlainText(html);

  let sent = false;
  for (const to of recipients) {
    const result = await sendLoggedEmail({
      to,
      subject: opts.subject,
      html,
      text,
      dedupeKey: `admin-alert:${opts.eventKey}:${to}`,
      metadata: { ...opts.metadata, kind: opts.kind },
    }).catch((err) => {
      console.warn(
        `${LOG_PREFIX} send failed (${opts.kind}):`,
        err instanceof Error ? err.message : err,
      );
      return null;
    });
    if (result?.success) sent = true;
  }
  return sent;
}

/**
 * Instant owner notification for a NEW user signup (password or OAuth).
 * Suppressed for the allowlisted QA account. Never throws.
 */
export async function sendAdminSignupAlert(opts: {
  userId: string;
  email: string;
  name?: string | null;
  /** 'password' | 'oauth:google' | 'oauth:apple' */
  source: string;
}): Promise<boolean> {
  try {
    if (isAllowlistedQaEmail(opts.email)) return false;
    return await dispatchAdminAlert({
      kind: "admin-signup-alert",
      eventKey: `signup:${opts.userId}`,
      subject: `[LocateFlow] New signup: ${opts.email}`,
      heading: "New user signup",
      rows: [
        ["Email", opts.email],
        ["Name", opts.name?.trim() || null],
        ["Sign-up method", opts.source],
        ["User ID", opts.userId],
        ["When", new Date().toUTCString()],
      ],
      userId: opts.userId,
      metadata: { userId: opts.userId },
    });
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} signup alert failed:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}

/**
 * Instant owner notification for a subscription purchase (first activation
 * only — callers fire this from paths that already exclude renewals).
 * Suppressed for the allowlisted QA account. Never throws.
 */
export async function sendAdminPurchaseAlert(opts: {
  userId: string;
  email: string;
  plan?: string | null;
  /** Billing cadence, e.g. 'MONTH' | 'YEAR'. */
  interval?: string | null;
  provider: AdminPurchaseAlertProvider;
  /** Event identity (e.g. `stripe:<event.id>` or the IAP dedupe base). */
  dedupeKey: string;
}): Promise<boolean> {
  try {
    if (isAllowlistedQaEmail(opts.email)) return false;
    const label = planLabel(opts.plan);
    return await dispatchAdminAlert({
      kind: "admin-purchase-alert",
      eventKey: `purchase:${opts.dedupeKey}`,
      subject: `[LocateFlow] New subscription: ${label} (${opts.provider}) - ${opts.email}`,
      heading: "New subscription purchase",
      rows: [
        ["Customer", opts.email],
        ["Plan", label],
        ["Billing interval", opts.interval || null],
        ["Provider", opts.provider],
        ["User ID", opts.userId],
        ["When", new Date().toUTCString()],
      ],
      userId: opts.userId,
      metadata: {
        userId: opts.userId,
        provider: opts.provider,
        planLabel: label,
        billingInterval: opts.interval || null,
      },
    });
  } catch (err) {
    console.warn(
      `${LOG_PREFIX} purchase alert failed:`,
      err instanceof Error ? err.message : err,
    );
    return false;
  }
}
