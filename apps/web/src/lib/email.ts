import { Resend } from "resend";
import { getRequiredRuntimeConfigValues } from "@/lib/runtime-config";

let _resend: Resend | null = null;
let _resendApiKey: string | null = null;
function getResend(apiKey: string): Resend {
  if (!_resend || _resendApiKey !== apiKey) {
    _resend = new Resend(apiKey);
    _resendApiKey = apiKey;
  }
  return _resend;
}

const DEFAULT_FROM_EMAIL = "LocateFlow <noreply@locateflow.com>";
export const DEFAULT_APP_URL = "https://locateflow.com";
export const DEFAULT_SUPPORT_EMAIL = "support@locateflow.com";

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

const COLORS = {
  background: "#f5f7fb",
  card: "#ffffff",
  text: "#172033",
  muted: "#5f6b7a",
  border: "#d9e1ea",
  panel: "#eef3f8",
  primary: "#f97316",
  primaryDark: "#c2410c",
  accent: "#0f766e",
};

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  replyTo?: string | string[];
}

export interface SendEmailResult {
  success: boolean;
  providerMessageId: string | null;
  error: string | null;
  fromEmail: string | null;
  configError?: boolean;
}

export interface EmailContent {
  subject: string;
  html: string;
  text: string;
}

async function resolveEmailConfig() {
  const values = await getRequiredRuntimeConfigValues([
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "NEXT_PUBLIC_APP_URL",
    "SUPPORT_EMAIL",
    "EMAIL_REPLY_TO",
  ]);

  const supportEmail =
    values.SUPPORT_EMAIL || values.EMAIL_REPLY_TO || DEFAULT_SUPPORT_EMAIL;
  const appUrl = values.NEXT_PUBLIC_APP_URL
    ? normalizeBaseUrl(values.NEXT_PUBLIC_APP_URL)
    : DEFAULT_APP_URL;

  return {
    resendApiKey: values.RESEND_API_KEY,
    fromEmail: values.EMAIL_FROM || DEFAULT_FROM_EMAIL,
    appUrl,
    supportEmail,
    replyTo: values.EMAIL_REPLY_TO || supportEmail,
    configured: {
      resendApiKey: Boolean(values.RESEND_API_KEY),
      fromEmail: Boolean(values.EMAIL_FROM),
      appUrl: Boolean(values.NEXT_PUBLIC_APP_URL),
      supportEmail: Boolean(values.SUPPORT_EMAIL || values.EMAIL_REPLY_TO),
    },
  };
}

function validateEmailConfig(config: Awaited<ReturnType<typeof resolveEmailConfig>>): string | null {
  if (!isProductionLikeEmailRuntime()) return null;
  if (!config.configured.resendApiKey) return "RESEND_API_KEY missing";
  if (!/^re_[A-Za-z0-9_-]+$/.test(config.resendApiKey || "")) return "RESEND_API_KEY invalid";
  if (!config.configured.fromEmail) return "EMAIL_FROM missing";
  if (!config.configured.appUrl) return "NEXT_PUBLIC_APP_URL missing";
  if (!config.configured.supportEmail) return "SUPPORT_EMAIL or EMAIL_REPLY_TO missing";
  return null;
}

function redactKnownSecrets(value: string): string {
  let redacted = value;
  const knownSecrets = [process.env.RESEND_API_KEY].filter(Boolean) as string[];
  for (const secret of knownSecrets) {
    redacted = redacted.split(secret).join("[redacted]");
  }
  return redacted
    .replace(/\bre_[A-Za-z0-9_-]{8,}\b/g, "[redacted]")
    .replace(/\b[A-Za-z0-9_-]{32,}\b/g, "[redacted]");
}

function safeEmailError(error: unknown): string {
  const raw =
    error instanceof Error
      ? error.message
      : typeof error === "object" && error && "message" in error
        ? String((error as { message?: unknown }).message || "SEND_FAILED")
        : String(error || "SEND_FAILED");
  return redactKnownSecrets(raw).slice(0, 500);
}

export async function sendEmailWithResult(
  options: EmailOptions,
): Promise<SendEmailResult> {
  const config = await resolveEmailConfig();
  const configError = validateEmailConfig(config);
  if (configError) {
    console.error("[EMAIL] Configuration error:", { message: configError });
    return {
      success: false,
      providerMessageId: null,
      error: configError,
      fromEmail: config.fromEmail,
      configError: true,
    };
  }
  const { resendApiKey, fromEmail, replyTo } = config;
  const text = options.text || htmlToPlainText(options.html);

  if (!resendApiKey) {
    console.log(`[EMAIL-DEV] To: ${options.to} | Subject: ${options.subject}`);
    return {
      success: true,
      providerMessageId: null,
      error: null,
      fromEmail,
    };
  }

  try {
    const { data, error } = await getResend(resendApiKey).emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text,
      replyTo: options.replyTo || replyTo,
    });

    if (error) {
      const safeError = safeEmailError(error);
      console.error("[EMAIL] Send failed:", { message: safeError });
      return {
        success: false,
        providerMessageId: null,
        error: safeError,
        fromEmail,
      };
    }
    return { success: true, providerMessageId: data?.id || null, error: null, fromEmail };
  } catch (err) {
    const safeError = safeEmailError(err);
    console.error("[EMAIL] Error:", { message: safeError });
    return {
      success: false,
      providerMessageId: null,
      error: safeError,
      fromEmail,
    };
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const result = await sendEmailWithResult(options);
  return result.success;
}

const htmlEscapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(str: string): string {
  return String(str || "").replace(/[&<>"']/g, (c) => htmlEscapeMap[c] || c);
}

function decodeHtmlEntities(str: string): string {
  return str
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&middot;/g, "-");
}

export function htmlToPlainText(html: string): string {
  return decodeHtmlEntities(
    html
      .replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/<script[\s\S]*?<\/script>/gi, "")
      .replace(
        /<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi,
        (_match, href: string, label: string) =>
          `${label.replace(/<[^>]*>/g, "").trim()}: ${href}`,
      )
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|h1|h2|h3|tr|table|li)>/gi, "\n")
      .replace(/<li[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, "")
      .replace(/[ \t]+\n/g, "\n")
      .replace(/\n{3,}/g, "\n\n")
      .replace(/[ \t]{2,}/g, " ")
      .trim(),
  );
}

export function normalizeBaseUrl(value?: string | null): string {
  if (!value) return DEFAULT_APP_URL;
  try {
    const parsed = new URL(value);
    return parsed.origin;
  } catch {
    return DEFAULT_APP_URL;
  }
}

function absoluteUrl(pathOrUrl: string, baseUrl = DEFAULT_APP_URL): string {
  try {
    return new URL(pathOrUrl, normalizeBaseUrl(baseUrl)).toString();
  } catch {
    return DEFAULT_APP_URL;
  }
}

function detailRows(rows: Array<[string, string]>): string {
  return rows
    .map(
      ([label, value]) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;line-height:20px;color:${COLORS.muted};">${escapeHtml(label)}</td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;line-height:20px;color:${COLORS.text};font-weight:600;">${value}</td>
        </tr>`,
    )
    .join("");
}

function ctaButton(href: string, label: string): string {
  return `
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;margin:24px 0 8px;">
      <tr>
        <td bgcolor="${COLORS.primary}" style="border-radius:6px;">
          <a href="${escapeHtml(href)}" style="display:inline-block;padding:13px 20px;font-size:15px;line-height:18px;color:#ffffff;text-decoration:none;font-weight:700;border-radius:6px;">${escapeHtml(label)}</a>
        </td>
      </tr>
    </table>`;
}

export function renderLocateFlowEmail(opts: {
  preheader: string;
  title: string;
  bodyHtml: string;
  cta?: { href: string; label: string };
  supportEmail?: string;
  securityNote?: boolean;
}): string {
  const supportEmail = opts.supportEmail || DEFAULT_SUPPORT_EMAIL;
  const cta = opts.cta ? ctaButton(opts.cta.href, opts.cta.label) : "";
  const securityNote = opts.securityNote
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:${COLORS.muted};">If this wasn't you, ignore this email or contact support.</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light dark">
  <meta name="supported-color-schemes" content="light dark">
  <title>${escapeHtml(opts.title)}</title>
</head>
<body style="margin:0;padding:0;background:${COLORS.background};font-family:Arial,'Helvetica Neue',Helvetica,sans-serif;color:${COLORS.text};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(opts.preheader)}</div>
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.background}" style="border-collapse:collapse;background:${COLORS.background};">
    <tr>
      <td align="center" style="padding:24px 12px;">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px;border-collapse:collapse;">
          <tr>
            <td style="padding:0 0 12px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;">
                <tr>
                  <td bgcolor="${COLORS.primary}" style="width:34px;height:34px;border-radius:8px;text-align:center;color:#ffffff;font-weight:700;font-size:13px;line-height:34px;">LF</td>
                  <td style="padding-left:10px;font-size:20px;line-height:24px;font-weight:700;color:${COLORS.text};">LocateFlow</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td bgcolor="${COLORS.card}" style="background:${COLORS.card};border:1px solid ${COLORS.border};border-radius:8px;padding:32px 28px;">
              <h1 style="margin:0 0 16px;font-size:24px;line-height:31px;color:${COLORS.text};font-weight:700;">${escapeHtml(opts.title)}</h1>
              ${opts.bodyHtml}
              ${cta}
              ${securityNote}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 4px 0;text-align:left;">
              <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:${COLORS.muted};font-weight:700;">LocateFlow</p>
              <p style="margin:0 0 6px;font-size:12px;line-height:18px;color:${COLORS.muted};">
                <a href="${DEFAULT_APP_URL}" style="color:${COLORS.primaryDark};text-decoration:underline;">${DEFAULT_APP_URL}</a>
                &nbsp;|&nbsp;
                <a href="mailto:${escapeHtml(supportEmail)}" style="color:${COLORS.primaryDark};text-decoration:underline;">${escapeHtml(supportEmail)}</a>
              </p>
              <p style="margin:0;font-size:12px;line-height:18px;color:${COLORS.muted};">You're receiving this email because you used LocateFlow.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function textFooter(security = false, supportEmail = DEFAULT_SUPPORT_EMAIL): string {
  return [
    "",
    "LocateFlow",
    DEFAULT_APP_URL,
    supportEmail,
    "You're receiving this email because you used LocateFlow.",
    security ? "If this wasn't you, ignore this email or contact support." : "",
  ]
    .filter(Boolean)
    .join("\n");
}

export function emailVerificationContent(data: {
  userName: string;
  verifyLink: string;
  supportEmail?: string;
}): EmailContent {
  const subject = "Verify your LocateFlow email";
  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">Hi <strong>${escapeHtml(data.userName)}</strong>,</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">Thanks for creating a LocateFlow account. Confirm your email address to finish setting up your account.</p>
    <p style="margin:0;font-size:13px;line-height:20px;color:${COLORS.muted};">This link expires in 24 hours.</p>`;
  const html = renderLocateFlowEmail({
    preheader: "Confirm your email address to finish setting up LocateFlow.",
    title: "Verify your email",
    bodyHtml,
    cta: { href: data.verifyLink, label: "Verify Email" },
    supportEmail: data.supportEmail,
    securityNote: true,
  });
  const text = [
    `Hi ${data.userName},`,
    "",
    "Thanks for creating a LocateFlow account. Confirm your email address to finish setting up your account.",
    "",
    `Verify Email: ${data.verifyLink}`,
    "",
    "This link expires in 24 hours.",
    textFooter(true, data.supportEmail),
  ].join("\n");
  return { subject, html, text };
}

export function passwordResetContent(data: {
  userName: string;
  resetLink: string;
  mode?: "reset" | "set-password";
  supportEmail?: string;
}): EmailContent {
  const isSetPassword = data.mode === "set-password";
  const subject = isSetPassword
    ? "Set your LocateFlow password"
    : "Reset your LocateFlow password";
  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">Hi <strong>${escapeHtml(data.userName)}</strong>,</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${
      isSetPassword
        ? "Use this secure link to add password sign-in to your LocateFlow account."
        : "We received a request to reset your LocateFlow password."
    }</p>
    <p style="margin:0;font-size:13px;line-height:20px;color:${COLORS.muted};">This link expires in 1 hour and can only be used once.</p>`;
  const html = renderLocateFlowEmail({
    preheader: isSetPassword
      ? "Use this secure link to set a LocateFlow password."
      : "Use this secure link to reset your LocateFlow password.",
    title: isSetPassword ? "Set your password" : "Reset your password",
    bodyHtml,
    cta: { href: data.resetLink, label: isSetPassword ? "Set Password" : "Reset Password" },
    supportEmail: data.supportEmail,
    securityNote: true,
  });
  const text = [
    `Hi ${data.userName},`,
    "",
    isSetPassword
      ? "Use this secure link to add password sign-in to your LocateFlow account."
      : "We received a request to reset your LocateFlow password.",
    "",
    `${isSetPassword ? "Set Password" : "Reset Password"}: ${data.resetLink}`,
    "",
    "This link expires in 1 hour and can only be used once.",
    textFooter(true, data.supportEmail),
  ].join("\n");
  return { subject, html, text };
}

export function billReminderHtml(data: {
  userName: string;
  serviceName: string;
  category: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  appUrl?: string;
}): string {
  const dueText =
    data.daysUntilDue === 0
      ? "today"
      : `in ${data.daysUntilDue} day${data.daysUntilDue === 1 ? "" : "s"}`;
  const dashboardUrl = absoluteUrl("/services", data.appUrl);
  const amount = `$${data.amount.toFixed(2)}`;
  const html = `
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">Hi <strong>${escapeHtml(data.userName)}</strong>,</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:${COLORS.text};">Your <strong>${escapeHtml(data.serviceName)}</strong> bill is due ${dueText}.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.panel}" style="width:100%;border-collapse:collapse;background:${COLORS.panel};border-radius:8px;margin:0 0 4px;">
      <tr>
        <td style="padding:14px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
            ${detailRows([
              ["Service", escapeHtml(data.serviceName)],
              ["Category", escapeHtml(data.category)],
              ["Amount", `<span style="color:${COLORS.primaryDark};">${escapeHtml(amount)}</span>`],
              ["Due Date", escapeHtml(data.dueDate)],
            ])}
          </table>
        </td>
      </tr>
    </table>`;

  return renderLocateFlowEmail({
    preheader: `${data.serviceName} is due ${dueText}.`,
    title: "Bill reminder",
    bodyHtml: html,
    cta: { href: dashboardUrl, label: "View Services" },
  });
}

export function billReminderText(data: {
  userName: string;
  serviceName: string;
  category: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  appUrl?: string;
}): string {
  const dueText =
    data.daysUntilDue === 0
      ? "today"
      : `in ${data.daysUntilDue} day${data.daysUntilDue === 1 ? "" : "s"}`;
  return [
    `Hi ${data.userName},`,
    "",
    `Your ${data.serviceName} bill is due ${dueText}.`,
    `Service: ${data.serviceName}`,
    `Category: ${data.category}`,
    `Amount: $${data.amount.toFixed(2)}`,
    `Due Date: ${data.dueDate}`,
    "",
    `View Services: ${absoluteUrl("/services", data.appUrl)}`,
    textFooter(),
  ].join("\n");
}

export function contractReminderHtml(data: {
  userName: string;
  serviceName: string;
  contractEndDate: string;
  daysRemaining: number;
  serviceLink: string;
}): string {
  const dayText = `${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"}`;
  const html = `
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">Hi <strong>${escapeHtml(data.userName)}</strong>,</p>
    <p style="margin:0 0 18px;font-size:15px;line-height:24px;color:${COLORS.text};">Your <strong>${escapeHtml(data.serviceName)}</strong> contract ends in <strong>${escapeHtml(dayText)}</strong>.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" bgcolor="${COLORS.panel}" style="width:100%;border-collapse:collapse;background:${COLORS.panel};border-radius:8px;margin:0 0 4px;">
      <tr>
        <td style="padding:14px 16px;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
            ${detailRows([
              ["Service", escapeHtml(data.serviceName)],
              ["Ends On", escapeHtml(data.contractEndDate)],
              ["Time Remaining", escapeHtml(dayText)],
            ])}
          </table>
        </td>
      </tr>
    </table>`;

  return renderLocateFlowEmail({
    preheader: `${data.serviceName} contract ends in ${dayText}.`,
    title: "Contract reminder",
    bodyHtml: html,
    cta: { href: absoluteUrl(data.serviceLink), label: "Review Service" },
  });
}

export function contractReminderText(data: {
  userName: string;
  serviceName: string;
  contractEndDate: string;
  daysRemaining: number;
  serviceLink: string;
}): string {
  const dayText = `${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"}`;
  return [
    `Hi ${data.userName},`,
    "",
    `Your ${data.serviceName} contract ends in ${dayText}.`,
    `Ends On: ${data.contractEndDate}`,
    "",
    `Review Service: ${absoluteUrl(data.serviceLink)}`,
    textFooter(),
  ].join("\n");
}

export function weeklyDigestHtml(data: {
  userName: string;
  weekStart: string;
  weekEnd: string;
  upcomingBills: { name: string; amount: number; dueDate: string }[];
  totalExpenses: number;
  newServices: number;
  appUrl?: string;
}): string {
  const billRows = data.upcomingBills
    .map(
      (bill) => `
        <tr>
          <td style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;line-height:20px;color:${COLORS.text};">${escapeHtml(bill.name)}</td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:14px;line-height:20px;color:${COLORS.text};font-weight:600;">$${bill.amount.toFixed(2)}</td>
          <td align="right" style="padding:10px 0;border-bottom:1px solid ${COLORS.border};font-size:13px;line-height:20px;color:${COLORS.muted};">${escapeHtml(bill.dueDate)}</td>
        </tr>`,
    )
    .join("");

  const billsTable = data.upcomingBills.length
    ? `
      <h2 style="margin:22px 0 8px;font-size:16px;line-height:22px;color:${COLORS.text};">Upcoming bills</h2>
      <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;margin-bottom:4px;">
        <tr>
          <td style="padding:8px 0;border-bottom:2px solid ${COLORS.border};font-size:12px;line-height:16px;color:${COLORS.muted};font-weight:700;">Service</td>
          <td align="right" style="padding:8px 0;border-bottom:2px solid ${COLORS.border};font-size:12px;line-height:16px;color:${COLORS.muted};font-weight:700;">Amount</td>
          <td align="right" style="padding:8px 0;border-bottom:2px solid ${COLORS.border};font-size:12px;line-height:16px;color:${COLORS.muted};font-weight:700;">Due</td>
        </tr>
        ${billRows}
      </table>`
    : "";

  const html = `
    <p style="margin:0 0 16px;font-size:15px;line-height:24px;color:${COLORS.text};">Hi <strong>${escapeHtml(data.userName)}</strong>, here is your LocateFlow summary for ${escapeHtml(data.weekStart)} to ${escapeHtml(data.weekEnd)}.</p>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;border-collapse:collapse;">
      <tr>
        <td width="50%" bgcolor="${COLORS.panel}" style="padding:16px;border-radius:8px;background:${COLORS.panel};">
          <p style="margin:0;font-size:24px;line-height:30px;color:${COLORS.primaryDark};font-weight:700;">$${data.totalExpenses.toFixed(0)}</p>
          <p style="margin:4px 0 0;font-size:12px;line-height:16px;color:${COLORS.muted};">Monthly cost</p>
        </td>
        <td width="12" style="font-size:1px;line-height:1px;">&nbsp;</td>
        <td width="50%" bgcolor="${COLORS.panel}" style="padding:16px;border-radius:8px;background:${COLORS.panel};">
          <p style="margin:0;font-size:24px;line-height:30px;color:${COLORS.primaryDark};font-weight:700;">${data.newServices}</p>
          <p style="margin:4px 0 0;font-size:12px;line-height:16px;color:${COLORS.muted};">New services</p>
        </td>
      </tr>
    </table>
    ${billsTable}`;

  return renderLocateFlowEmail({
    preheader: `Your LocateFlow weekly summary for ${data.weekStart} to ${data.weekEnd}.`,
    title: "Weekly digest",
    bodyHtml: html,
    cta: { href: absoluteUrl("/dashboard", data.appUrl), label: "Open Dashboard" },
  });
}

export function weeklyDigestText(data: {
  userName: string;
  weekStart: string;
  weekEnd: string;
  upcomingBills: { name: string; amount: number; dueDate: string }[];
  totalExpenses: number;
  newServices: number;
  appUrl?: string;
}): string {
  const upcoming = data.upcomingBills.length
    ? [
        "",
        "Upcoming bills:",
        ...data.upcomingBills.map(
          (bill) => `- ${bill.name}: $${bill.amount.toFixed(2)} due ${bill.dueDate}`,
        ),
      ]
    : [];

  return [
    `Hi ${data.userName},`,
    "",
    `Here is your LocateFlow summary for ${data.weekStart} to ${data.weekEnd}.`,
    `Monthly cost: $${data.totalExpenses.toFixed(0)}`,
    `New services: ${data.newServices}`,
    ...upcoming,
    "",
    `Open Dashboard: ${absoluteUrl("/dashboard", data.appUrl)}`,
    textFooter(),
  ].join("\n");
}
