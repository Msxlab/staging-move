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

// Inline-content emails are translated in-process. ES targets the US Hispanic
// audience; everything else falls back to EN. DB-templated emails use their
// own `${slug}-es` lookup in renderTemplate (see email-service.ts).
export type EmailLocale = "en" | "es";

export function resolveEmailLocale(input?: string | null): EmailLocale {
  const normalized = (input || "").toLowerCase();
  if (normalized.startsWith("es")) return "es";
  return "en";
}

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

const SHELL_STRINGS: Record<EmailLocale, { securityNote: string; footerNote: string }> = {
  en: {
    securityNote: "If this wasn't you, ignore this email or contact support.",
    footerNote: "You're receiving this email because you used LocateFlow.",
  },
  es: {
    securityNote: "Si no fuiste tú, ignora este correo o contacta con soporte.",
    footerNote: "Recibes este correo porque usaste LocateFlow.",
  },
};

export function renderLocateFlowEmail(opts: {
  preheader: string;
  title: string;
  bodyHtml: string;
  cta?: { href: string; label: string };
  supportEmail?: string;
  securityNote?: boolean;
  locale?: EmailLocale;
}): string {
  const locale: EmailLocale = opts.locale || "en";
  const strings = SHELL_STRINGS[locale];
  const supportEmail = opts.supportEmail || DEFAULT_SUPPORT_EMAIL;
  const cta = opts.cta ? ctaButton(opts.cta.href, opts.cta.label) : "";
  const securityNote = opts.securityNote
    ? `<p style="margin:16px 0 0;font-size:13px;line-height:20px;color:${COLORS.muted};">${strings.securityNote}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="${locale}">
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
              <p style="margin:0;font-size:12px;line-height:18px;color:${COLORS.muted};">${strings.footerNote}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function textFooter(
  security = false,
  supportEmail = DEFAULT_SUPPORT_EMAIL,
  locale: EmailLocale = "en",
): string {
  const strings = SHELL_STRINGS[locale];
  return [
    "",
    "LocateFlow",
    DEFAULT_APP_URL,
    supportEmail,
    strings.footerNote,
    security ? strings.securityNote : "",
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

const SUBSCRIPTION_ACTIVATED_STRINGS: Record<EmailLocale, {
  subject: (plan: string) => string;
  preheader: (plan: string) => string;
  title: string;
  greeting: (name: string) => string;
  intro: string;
  planLabel: string;
  amountLabel: string;
  cta: string;
  managePolicy: string;
  hi: (name: string) => string;
  active: string;
}> = {
  en: {
    subject: (plan) => `Welcome to LocateFlow ${plan}`,
    preheader: (plan) => `Your LocateFlow ${plan} subscription is active.`,
    title: "Subscription activated",
    greeting: (name) => `Hi <strong>${escapeHtml(name)}</strong>,`,
    intro: "Your subscription is active. Here are the details:",
    planLabel: "Plan",
    amountLabel: "Amount",
    cta: "Manage Subscription",
    managePolicy: "You can update or cancel your plan from billing settings at any time.",
    hi: (name) => `Hi ${name},`,
    active: "Your subscription is active.",
  },
  es: {
    subject: (plan) => `Bienvenido a LocateFlow ${plan}`,
    preheader: (plan) => `Tu suscripción de LocateFlow ${plan} está activa.`,
    title: "Suscripción activada",
    greeting: (name) => `Hola <strong>${escapeHtml(name)}</strong>,`,
    intro: "Tu suscripción está activa. Estos son los detalles:",
    planLabel: "Plan",
    amountLabel: "Monto",
    cta: "Administrar suscripción",
    managePolicy: "Puedes cambiar o cancelar tu plan desde la configuración de facturación cuando quieras.",
    hi: (name) => `Hola ${name},`,
    active: "Tu suscripción está activa.",
  },
};

export function subscriptionActivatedContent(data: {
  userName: string;
  planLabel: string;
  amountFormatted?: string | null;
  manageLink: string;
  supportEmail?: string;
  locale?: EmailLocale | null;
}): EmailContent {
  const locale: EmailLocale = resolveEmailLocale(data.locale);
  const s = SUBSCRIPTION_ACTIVATED_STRINGS[locale];
  const subject = s.subject(data.planLabel);
  const rows: Array<[string, string]> = [[s.planLabel, escapeHtml(data.planLabel)]];
  if (data.amountFormatted) rows.push([s.amountLabel, escapeHtml(data.amountFormatted)]);
  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${s.greeting(data.userName)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${s.intro}</p>
    <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="border-collapse:collapse;width:100%;margin:8px 0 4px;">${detailRows(rows)}</table>
    <p style="margin:16px 0 0;font-size:13px;line-height:20px;color:${COLORS.muted};">${s.managePolicy}</p>`;
  const html = renderLocateFlowEmail({
    preheader: s.preheader(data.planLabel),
    title: s.title,
    bodyHtml,
    cta: { href: data.manageLink, label: s.cta },
    supportEmail: data.supportEmail,
    locale,
  });
  const text = [
    s.hi(data.userName),
    "",
    s.active,
    `${s.planLabel}: ${data.planLabel}`,
    data.amountFormatted ? `${s.amountLabel}: ${data.amountFormatted}` : "",
    "",
    `${s.cta}: ${data.manageLink}`,
    "",
    s.managePolicy,
    textFooter(false, data.supportEmail, locale),
  ].filter(Boolean).join("\n");
  return { subject, html, text };
}

const SUBSCRIPTION_CANCELED_STRINGS: Record<EmailLocale, {
  subject: string;
  preheader: string;
  title: string;
  cta: string;
  reminder: string;
  greeting: (name: string) => string;
  bodyLine: (plan: string) => string;
  accessUntil: (date: string) => string;
  accessEnded: string;
  hi: (name: string) => string;
  bodyText: (plan: string) => string;
  accessUntilText: (date: string) => string;
  accessEndedText: string;
}> = {
  en: {
    subject: "Your LocateFlow subscription was canceled",
    preheader: "Your LocateFlow subscription was canceled.",
    title: "Subscription canceled",
    cta: "Reactivate",
    reminder: "Changed your mind? You can reactivate anytime.",
    greeting: (name) => `Hi <strong>${escapeHtml(name)}</strong>,`,
    bodyLine: (plan) => `We've canceled your <strong>${escapeHtml(plan)}</strong> subscription.`,
    accessUntil: (d) => `You'll still have access through <strong>${escapeHtml(d)}</strong>.`,
    accessEnded: "Your access has ended.",
    hi: (name) => `Hi ${name},`,
    bodyText: (plan) => `We've canceled your ${plan} subscription.`,
    accessUntilText: (d) => `You'll still have access through ${d}.`,
    accessEndedText: "Your access has ended.",
  },
  es: {
    subject: "Tu suscripción de LocateFlow fue cancelada",
    preheader: "Tu suscripción de LocateFlow fue cancelada.",
    title: "Suscripción cancelada",
    cta: "Reactivar",
    reminder: "¿Cambiaste de opinión? Puedes reactivar tu suscripción cuando quieras.",
    greeting: (name) => `Hola <strong>${escapeHtml(name)}</strong>,`,
    bodyLine: (plan) => `Cancelamos tu suscripción <strong>${escapeHtml(plan)}</strong>.`,
    accessUntil: (d) => `Mantendrás el acceso hasta <strong>${escapeHtml(d)}</strong>.`,
    accessEnded: "Tu acceso ha terminado.",
    hi: (name) => `Hola ${name},`,
    bodyText: (plan) => `Cancelamos tu suscripción ${plan}.`,
    accessUntilText: (d) => `Mantendrás el acceso hasta ${d}.`,
    accessEndedText: "Tu acceso ha terminado.",
  },
};

export function subscriptionCanceledContent(data: {
  userName: string;
  planLabel: string;
  accessEndsOn?: string | null;
  reactivateLink: string;
  supportEmail?: string;
  locale?: EmailLocale | null;
}): EmailContent {
  const locale: EmailLocale = resolveEmailLocale(data.locale);
  const s = SUBSCRIPTION_CANCELED_STRINGS[locale];
  const accessLine = data.accessEndsOn ? s.accessUntil(data.accessEndsOn) : s.accessEnded;
  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${s.greeting(data.userName)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${s.bodyLine(data.planLabel)} ${accessLine}</p>
    <p style="margin:0;font-size:13px;line-height:20px;color:${COLORS.muted};">${s.reminder}</p>`;
  const html = renderLocateFlowEmail({
    preheader: s.preheader,
    title: s.title,
    bodyHtml,
    cta: { href: data.reactivateLink, label: s.cta },
    supportEmail: data.supportEmail,
    securityNote: true,
    locale,
  });
  const text = [
    s.hi(data.userName),
    "",
    s.bodyText(data.planLabel),
    data.accessEndsOn ? s.accessUntilText(data.accessEndsOn) : s.accessEndedText,
    "",
    `${s.cta}: ${data.reactivateLink}`,
    textFooter(true, data.supportEmail, locale),
  ].join("\n");
  return { subject: s.subject, html, text };
}

const PAYMENT_FAILED_STRINGS: Record<EmailLocale, {
  subject: string;
  preheader: string;
  title: string;
  cta: string;
  greeting: (name: string) => string;
  amountWithValue: (amount: string) => string;
  amountWithoutValue: string;
  retryWithDate: (date: string) => string;
  retryWithoutDate: string;
  cardReplacedNote: string;
  hi: (name: string) => string;
  amountWithValueText: (amount: string) => string;
  amountWithoutValueText: string;
  retryWithDateText: (date: string) => string;
  retryWithoutDateText: string;
}> = {
  en: {
    subject: "Payment failed for your LocateFlow subscription",
    preheader: "Payment failed — please update your billing details.",
    title: "Payment failed",
    cta: "Update Payment Method",
    greeting: (name) => `Hi <strong>${escapeHtml(name)}</strong>,`,
    amountWithValue: (a) => `We couldn't charge <strong>${escapeHtml(a)}</strong> for your subscription.`,
    amountWithoutValue: "We couldn't charge your card for your subscription.",
    retryWithDate: (d) => `We'll try again on ${escapeHtml(d)}, or you can update your card now to retry immediately.`,
    retryWithoutDate: "Update your card to retry the payment and keep your account active.",
    cardReplacedNote: "If your card was lost or replaced, please update your billing information.",
    hi: (name) => `Hi ${name},`,
    amountWithValueText: (a) => `We couldn't charge ${a} for your subscription.`,
    amountWithoutValueText: "We couldn't charge your card for your subscription.",
    retryWithDateText: (d) => `We'll try again on ${d}, or you can update your card now to retry immediately.`,
    retryWithoutDateText: "Update your card to retry the payment and keep your account active.",
  },
  es: {
    subject: "Falló el pago de tu suscripción de LocateFlow",
    preheader: "Falló el pago — actualiza tus datos de facturación.",
    title: "Falló el pago",
    cta: "Actualizar método de pago",
    greeting: (name) => `Hola <strong>${escapeHtml(name)}</strong>,`,
    amountWithValue: (a) => `No pudimos cobrar <strong>${escapeHtml(a)}</strong> de tu suscripción.`,
    amountWithoutValue: "No pudimos cobrar tu tarjeta para tu suscripción.",
    retryWithDate: (d) => `Lo intentaremos de nuevo el ${escapeHtml(d)}, o puedes actualizar tu tarjeta ahora para reintentar de inmediato.`,
    retryWithoutDate: "Actualiza tu tarjeta para reintentar el cobro y mantener tu cuenta activa.",
    cardReplacedNote: "Si perdiste o reemplazaste tu tarjeta, por favor actualiza tu información de facturación.",
    hi: (name) => `Hola ${name},`,
    amountWithValueText: (a) => `No pudimos cobrar ${a} de tu suscripción.`,
    amountWithoutValueText: "No pudimos cobrar tu tarjeta para tu suscripción.",
    retryWithDateText: (d) => `Lo intentaremos de nuevo el ${d}, o puedes actualizar tu tarjeta ahora para reintentar de inmediato.`,
    retryWithoutDateText: "Actualiza tu tarjeta para reintentar el cobro y mantener tu cuenta activa.",
  },
};

export function paymentFailedContent(data: {
  userName: string;
  amountFormatted?: string | null;
  retryLink: string;
  nextAttemptOn?: string | null;
  supportEmail?: string;
  locale?: EmailLocale | null;
}): EmailContent {
  const locale: EmailLocale = resolveEmailLocale(data.locale);
  const s = PAYMENT_FAILED_STRINGS[locale];
  const amountLine = data.amountFormatted ? s.amountWithValue(data.amountFormatted) : s.amountWithoutValue;
  const retryNote = data.nextAttemptOn ? s.retryWithDate(data.nextAttemptOn) : s.retryWithoutDate;
  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${s.greeting(data.userName)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${amountLine}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${retryNote}</p>
    <p style="margin:0;font-size:13px;line-height:20px;color:${COLORS.muted};">${s.cardReplacedNote}</p>`;
  const html = renderLocateFlowEmail({
    preheader: s.preheader,
    title: s.title,
    bodyHtml,
    cta: { href: data.retryLink, label: s.cta },
    supportEmail: data.supportEmail,
    locale,
  });
  const text = [
    s.hi(data.userName),
    "",
    data.amountFormatted ? s.amountWithValueText(data.amountFormatted) : s.amountWithoutValueText,
    "",
    data.nextAttemptOn ? s.retryWithDateText(data.nextAttemptOn) : s.retryWithoutDateText,
    "",
    `${s.cta}: ${data.retryLink}`,
    textFooter(false, data.supportEmail, locale),
  ].join("\n");
  const subject = s.subject;
  return { subject, html, text };
}

export type SecurityNoticeKind =
  | "password-changed"
  | "mfa-enabled"
  | "mfa-disabled"
  | "oauth-linked"
  | "account-deletion-requested";

type SecurityNoticeCopy = {
  subject: string;
  title: string;
  body: (detail?: string | null) => string;
  cta: string;
};

const SECURITY_NOTICE_STRINGS: Record<EmailLocale, {
  hi: (name: string) => string;
  greeting: (name: string) => string;
  whenLabel: string;
  copy: Record<SecurityNoticeKind, SecurityNoticeCopy>;
}> = {
  en: {
    hi: (name) => `Hi ${name},`,
    greeting: (name) => `Hi <strong>${escapeHtml(name)}</strong>,`,
    whenLabel: "When",
    copy: {
      "password-changed": {
        subject: "Your LocateFlow password was changed",
        title: "Password changed",
        body: (detail) => detail
          ? `${detail} If this wasn't you, secure your account immediately.`
          : "Your account password was just changed. If this was you, no action is needed.",
        cta: "Review Account Security",
      },
      "mfa-enabled": {
        subject: "Two-factor authentication is now on",
        title: "Two-factor authentication enabled",
        body: () => "Two-factor authentication is now active on your account. You'll need your authenticator app the next time you sign in.",
        cta: "Review Account Security",
      },
      "mfa-disabled": {
        subject: "Two-factor authentication was turned off",
        title: "Two-factor authentication disabled",
        body: () => "Two-factor authentication has been turned off on your account. If this wasn't you, re-enable it immediately and change your password.",
        cta: "Review Account Security",
      },
      "oauth-linked": {
        subject: "A new sign-in method was linked to your account",
        title: "Sign-in method linked",
        body: (detail) => detail
          ? `${detail} can now sign in to your LocateFlow account. If this wasn't you, contact support immediately.`
          : "A new sign-in method was linked to your account. If this wasn't you, contact support immediately.",
        cta: "Review Account Security",
      },
      "account-deletion-requested": {
        subject: "Your LocateFlow account deletion is scheduled",
        title: "Account deletion requested",
        body: (detail) => detail
          ? `We received a request to delete your account. ${detail} If you didn't request this, contact support immediately to cancel.`
          : "We received a request to delete your account. If you didn't request this, contact support immediately to cancel.",
        cta: "Cancel Deletion",
      },
    },
  },
  es: {
    hi: (name) => `Hola ${name},`,
    greeting: (name) => `Hola <strong>${escapeHtml(name)}</strong>,`,
    whenLabel: "Cuándo",
    copy: {
      "password-changed": {
        subject: "Cambiaste la contraseña de tu cuenta de LocateFlow",
        title: "Contraseña cambiada",
        body: (detail) => detail
          ? `${detail} Si no fuiste tú, asegura tu cuenta de inmediato.`
          : "Acaban de cambiar la contraseña de tu cuenta. Si fuiste tú, no necesitas hacer nada.",
        cta: "Revisar la seguridad de la cuenta",
      },
      "mfa-enabled": {
        subject: "La verificación en dos pasos está activa",
        title: "Verificación en dos pasos activada",
        body: () => "La verificación en dos pasos ya está activa en tu cuenta. Necesitarás tu app de autenticación la próxima vez que inicies sesión.",
        cta: "Revisar la seguridad de la cuenta",
      },
      "mfa-disabled": {
        subject: "Se desactivó la verificación en dos pasos",
        title: "Verificación en dos pasos desactivada",
        body: () => "La verificación en dos pasos se ha desactivado en tu cuenta. Si no fuiste tú, vuelve a activarla de inmediato y cambia tu contraseña.",
        cta: "Revisar la seguridad de la cuenta",
      },
      "oauth-linked": {
        subject: "Se vinculó un nuevo método de inicio de sesión a tu cuenta",
        title: "Método de inicio de sesión vinculado",
        body: (detail) => detail
          ? `${detail} ahora puede iniciar sesión en tu cuenta de LocateFlow. Si no fuiste tú, contacta con soporte de inmediato.`
          : "Se vinculó un nuevo método de inicio de sesión a tu cuenta. Si no fuiste tú, contacta con soporte de inmediato.",
        cta: "Revisar la seguridad de la cuenta",
      },
      "account-deletion-requested": {
        subject: "Programamos la eliminación de tu cuenta de LocateFlow",
        title: "Eliminación de cuenta solicitada",
        body: (detail) => detail
          ? `Recibimos una solicitud para eliminar tu cuenta. ${detail} Si no la solicitaste tú, contacta con soporte de inmediato para cancelarla.`
          : "Recibimos una solicitud para eliminar tu cuenta. Si no la solicitaste tú, contacta con soporte de inmediato para cancelarla.",
        cta: "Cancelar la eliminación",
      },
    },
  },
};

export function securityNoticeContent(data: {
  userName: string;
  kind: SecurityNoticeKind;
  detail?: string | null;
  occurredAt?: string | null;
  manageLink: string;
  supportEmail?: string;
  locale?: EmailLocale | null;
}): EmailContent {
  const locale: EmailLocale = resolveEmailLocale(data.locale);
  const localeStrings = SECURITY_NOTICE_STRINGS[locale];
  const copy = localeStrings.copy[data.kind];
  const bodyText = copy.body(data.detail);
  const occurredLine = data.occurredAt
    ? `<p style="margin:0 0 14px;font-size:13px;line-height:20px;color:${COLORS.muted};">${localeStrings.whenLabel}: ${escapeHtml(data.occurredAt)}</p>`
    : "";
  const bodyHtml = `
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${localeStrings.greeting(data.userName)}</p>
    <p style="margin:0 0 14px;font-size:15px;line-height:24px;color:${COLORS.text};">${bodyText}</p>
    ${occurredLine}`;
  const html = renderLocateFlowEmail({
    preheader: copy.subject,
    title: copy.title,
    bodyHtml,
    cta: { href: data.manageLink, label: copy.cta },
    supportEmail: data.supportEmail,
    securityNote: true,
    locale,
  });
  const text = [
    localeStrings.hi(data.userName),
    "",
    bodyText,
    data.occurredAt ? `${localeStrings.whenLabel}: ${data.occurredAt}` : "",
    "",
    `${copy.cta}: ${data.manageLink}`,
    textFooter(true, data.supportEmail, locale),
  ].filter(Boolean).join("\n");
  return { subject: copy.subject, html, text };
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
