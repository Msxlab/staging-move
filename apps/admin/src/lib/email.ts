import { Resend } from "resend";
import { getAdminRuntimeConfigValues } from "@/lib/runtime-config";

let _resend: Resend | null = null;
let _resendApiKey: string | null = null;
function getResend(apiKey: string): Resend {
  if (!_resend || _resendApiKey !== apiKey) {
    _resend = new Resend(apiKey);
    _resendApiKey = apiKey;
  }
  return _resend;
}

const DEFAULT_FROM_EMAIL = "LocateFlow <notifications@locateflow.com>";
const DEFAULT_APP_URL = "http://localhost:3000";
const DEFAULT_REPLY_TO = "support@locateflow.com";

function isProductionLikeEmailRuntime() {
  const appEnv = (process.env.APP_ENV || process.env.VERCEL_ENV || "").toLowerCase();
  return (
    process.env.NODE_ENV === "production" ||
    appEnv === "production" ||
    appEnv === "staging" ||
    appEnv === "preview" ||
    Boolean(process.env.DIGITALOCEAN_APP_ID)
  );
}

async function resolveEmailConfig() {
  const values = await getAdminRuntimeConfigValues([
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "NEXT_PUBLIC_APP_URL",
    "EMAIL_REPLY_TO",
    "SUPPORT_EMAIL",
  ]);
  const fromEmail =
    values.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    process.env.MAIL_FROM ||
    DEFAULT_FROM_EMAIL;
  const fromEmailConfigured = Boolean(
    values.EMAIL_FROM ||
    process.env.RESEND_FROM ||
    process.env.MAIL_FROM,
  );

  return {
    resendApiKey: values.RESEND_API_KEY,
    fromEmail,
    appUrl: values.NEXT_PUBLIC_APP_URL || (isProductionLikeEmailRuntime() ? "https://locateflow.com" : DEFAULT_APP_URL),
    replyTo: values.EMAIL_REPLY_TO || values.SUPPORT_EMAIL || DEFAULT_REPLY_TO,
    configured: {
      resendApiKey: Boolean(values.RESEND_API_KEY),
      fromEmail: fromEmailConfigured,
      appUrl: Boolean(values.NEXT_PUBLIC_APP_URL),
      replyTo: Boolean(values.EMAIL_REPLY_TO || values.SUPPORT_EMAIL),
    },
  };
}

function validateEmailConfig(config: Awaited<ReturnType<typeof resolveEmailConfig>>): string | null {
  if (!isProductionLikeEmailRuntime()) return null;
  if (!config.configured.resendApiKey) return "RESEND_API_KEY missing";
  if (!/^re_[A-Za-z0-9_-]+$/.test(config.resendApiKey || "")) return "RESEND_API_KEY invalid";
  if (!config.configured.fromEmail) return "EMAIL_FROM missing";
  if (!config.configured.appUrl) return "NEXT_PUBLIC_APP_URL missing";
  if (!config.configured.replyTo) return "SUPPORT_EMAIL or EMAIL_REPLY_TO missing";
  return null;
}

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<boolean> {
  const config = await resolveEmailConfig();
  const configError = validateEmailConfig(config);
  if (configError) {
    console.error("[EMAIL] Configuration error:", { message: configError });
    return false;
  }
  const { resendApiKey, fromEmail, replyTo } = config;

  if (!resendApiKey) {
    console.log(`[EMAIL-DEV] To: ${opts.to} | Subject: ${opts.subject}`);
    return true;
  }
  try {
    const { error } = await getResend(resendApiKey).emails.send({
      from: fromEmail,
      to: opts.to,
      subject: opts.subject,
      html: opts.html,
      text: opts.text || htmlToPlainText(opts.html),
      replyTo,
    });
    if (error) {
      console.error("[EMAIL] Send failed:", { message: safeEmailError(error) });
      return false;
    }
    return true;
  } catch (err) {
    console.error("[EMAIL] Error:", { message: safeEmailError(err) });
    return false;
  }
}

function safeEmailError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message || "SEND_FAILED")
        : String(error || "SEND_FAILED");
  return raw
    .replace(/\bre_[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]")
    .slice(0, 500);
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_m, href: string, label: string) => `${label.replace(/<[^>]*>/g, "").trim()}: ${href}`)
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|h1|h2|h3|tr|table|li)>/gi, "\n")
    .replace(/<li[^>]*>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function esc(str: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  };
  return str.replace(/[&<>"']/g, (c) => map[c] || c);
}

export async function sendReviewModerationEmail(opts: {
  userEmail: string;
  userName: string;
  providerName: string;
  action: "APPROVED" | "REJECTED";
  note?: string;
}): Promise<boolean> {
  const { appUrl } = await resolveEmailConfig();
  const isApproved = opts.action === "APPROVED";
  const subject = isApproved
    ? `Your review of ${opts.providerName} has been approved`
    : `Update on your review of ${opts.providerName}`;

  const html = `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Review ${isApproved ? "Approved ✓" : "Update"}</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#334155;font-size:15px;">Hi <strong>${esc(opts.userName)}</strong>,</p>
      <p style="color:#334155;font-size:15px;">
        Your review of <strong>${esc(opts.providerName)}</strong> has been
        <strong style="color:${isApproved ? "#16a34a" : "#dc2626"};">${opts.action.toLowerCase()}</strong>.
      </p>
      ${opts.note ? `<div style="background:#f1f5f9;border-radius:12px;padding:16px;margin:16px 0;"><p style="color:#475569;font-size:14px;margin:0;"><strong>Note:</strong> ${esc(opts.note)}</p></div>` : ""}
      <a href="${appUrl}/community" style="display:block;text-align:center;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-top:20px;">
        View Community Reviews
      </a>
    </div>
    <div style="padding:16px 24px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">LocateFlow</p>
    </div>
  </div>
</body></html>`;

  return sendEmail({ to: opts.userEmail, subject, html });
}

function renderSupportEmail(opts: {
  title: string;
  preheader: string;
  userName: string;
  bodyLines: string[];
  details: Array<[string, string]>;
  ctaHref: string;
  ctaLabel: string;
}) {
  const detailRows = opts.details
    .map(([label, value]) => `
      <tr>
        <td style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#64748b;font-size:13px;">${esc(label)}</td>
        <td align="right" style="padding:9px 0;border-bottom:1px solid #e2e8f0;color:#0f172a;font-size:13px;font-weight:600;">${esc(value)}</td>
      </tr>`)
    .join("");
  const body = opts.bodyLines
    .map((line) => `<p style="color:#334155;font-size:15px;line-height:24px;margin:0 0 14px;">${esc(line)}</p>`)
    .join("");

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${esc(opts.preheader)}</div>
  <div style="max-width:560px;margin:32px auto;padding:0 12px;">
    <div style="background:#fff;border:1px solid #e2e8f0;border-radius:10px;padding:28px;">
      <h1 style="margin:0 0 16px;color:#0f172a;font-size:22px;line-height:28px;">${esc(opts.title)}</h1>
      <p style="color:#334155;font-size:15px;line-height:24px;margin:0 0 14px;">Hi <strong>${esc(opts.userName || "there")}</strong>,</p>
      ${body}
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;background:#f1f5f9;border-radius:8px;margin:4px 0 20px;">
        <tr><td style="padding:12px 16px;"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;border-collapse:collapse;">${detailRows}</table></td></tr>
      </table>
      <a href="${esc(opts.ctaHref)}" style="display:inline-block;background:#f97316;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;font-size:14px;font-weight:700;">${esc(opts.ctaLabel)}</a>
    </div>
    <p style="margin:14px 4px 0;color:#94a3b8;font-size:12px;">LocateFlow Support</p>
  </div>
</body></html>`;
}

export async function sendSupportTicketReplyEmail(opts: {
  userEmail: string;
  userName: string;
  ticketId: string;
  ticketSubject: string;
  replyPreview?: string | null;
}): Promise<boolean> {
  const { appUrl } = await resolveEmailConfig();
  const subject = `New reply on: ${opts.ticketSubject}`.slice(0, 200);
  const html = renderSupportEmail({
    title: "New support reply",
    preheader: "Support replied to your ticket.",
    userName: opts.userName,
    bodyLines: [
      "Our support team replied to your ticket.",
      opts.replyPreview ? `Reply preview: ${opts.replyPreview.slice(0, 240)}` : "Open the ticket to read the latest reply.",
    ],
    details: [
      ["Ticket", `#${opts.ticketId.slice(-6)}`],
      ["Subject", opts.ticketSubject],
    ],
    ctaHref: `${appUrl}/support/${opts.ticketId}`,
    ctaLabel: "View Reply",
  });
  return sendEmail({ to: opts.userEmail, subject, html });
}

export async function sendSupportTicketStatusEmail(opts: {
  userEmail: string;
  userName: string;
  ticketId: string;
  ticketSubject: string;
  status: string;
}): Promise<boolean> {
  const { appUrl } = await resolveEmailConfig();
  const statusLabel = opts.status.replace(/_/g, " ");
  const html = renderSupportEmail({
    title: "Support ticket updated",
    preheader: "Your support ticket status changed.",
    userName: opts.userName,
    bodyLines: ["Your support ticket status has changed."],
    details: [
      ["Ticket", `#${opts.ticketId.slice(-6)}`],
      ["Subject", opts.ticketSubject],
      ["Status", statusLabel],
    ],
    ctaHref: `${appUrl}/support/${opts.ticketId}`,
    ctaLabel: "View Ticket",
  });
  return sendEmail({
    to: opts.userEmail,
    subject: `Support ticket ${statusLabel.toLowerCase()}`.slice(0, 200),
    html,
  });
}
