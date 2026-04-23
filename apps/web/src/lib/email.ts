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
const DEFAULT_APP_URL = "http://localhost:3000";

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
}

export interface SendEmailResult {
  success: boolean;
  providerMessageId: string | null;
  error: string | null;
}

async function resolveEmailConfig() {
  const values = await getRequiredRuntimeConfigValues([
    "RESEND_API_KEY",
    "EMAIL_FROM",
    "NEXT_PUBLIC_APP_URL",
  ]);

  return {
    resendApiKey: values.RESEND_API_KEY,
    fromEmail: values.EMAIL_FROM || DEFAULT_FROM_EMAIL,
    appUrl: values.NEXT_PUBLIC_APP_URL || DEFAULT_APP_URL,
  };
}

export async function sendEmailWithResult(
  options: EmailOptions,
): Promise<SendEmailResult> {
  const { resendApiKey, fromEmail } = await resolveEmailConfig();

  if (!resendApiKey) {
    console.log(`[EMAIL-DEV] To: ${options.to} | Subject: ${options.subject}`);
    return { success: true, providerMessageId: null, error: null };
  }

  try {
    const { data, error } = await getResend(resendApiKey).emails.send({
      from: fromEmail,
      to: options.to,
      subject: options.subject,
      html: options.html,
    });

    if (error) {
      console.error("[EMAIL] Send failed:", error);
      return {
        success: false,
        providerMessageId: null,
        error: error.message || "SEND_FAILED",
      };
    }
    return { success: true, providerMessageId: data?.id || null, error: null };
  } catch (err) {
    console.error("[EMAIL] Error:", err);
    return {
      success: false,
      providerMessageId: null,
      error: err instanceof Error ? err.message : "SEND_ERROR",
    };
  }
}

export async function sendEmail(options: EmailOptions): Promise<boolean> {
  const result = await sendEmailWithResult(options);
  return result.success;
}

// SEC-012: HTML escape helper to prevent injection in email templates
const htmlEscapeMap: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};
function esc(str: string): string {
  return str.replace(/[&<>"']/g, (c) => htmlEscapeMap[c] || c);
}

// ── Email Templates ──────────────────────────────────────────

export function billReminderHtml(data: {
  userName: string;
  serviceName: string;
  category: string;
  amount: number;
  dueDate: string;
  daysUntilDue: number;
  appUrl?: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Bill Reminder</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${esc(data.userName)}</strong>,
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your <strong>${esc(data.serviceName)}</strong> (${esc(data.category)}) bill of
        <strong style="color:#7c3aed;">$${data.amount.toFixed(2)}</strong>
        is due ${data.daysUntilDue === 0 ? "today" : `in <strong>${data.daysUntilDue} day${data.daysUntilDue > 1 ? "s" : ""}</strong>`}.
      </p>
      <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#475569;">
          <tr><td style="padding:6px 0;">Service</td><td style="text-align:right;font-weight:600;">${esc(data.serviceName)}</td></tr>
          <tr><td style="padding:6px 0;">Category</td><td style="text-align:right;">${esc(data.category)}</td></tr>
          <tr><td style="padding:6px 0;">Amount</td><td style="text-align:right;font-weight:600;color:#7c3aed;">$${data.amount.toFixed(2)}</td></tr>
          <tr><td style="padding:6px 0;">Due Date</td><td style="text-align:right;">${esc(data.dueDate)}</td></tr>
        </table>
      </div>
      <a href="${data.appUrl || DEFAULT_APP_URL}/services" style="display:block;text-align:center;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
        View Services
      </a>
    </div>
    <div style="padding:16px 24px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">LocateFlow · Manage your relocation with ease</p>
    </div>
  </div>
</body>
</html>`;
}

export function contractReminderHtml(data: {
  userName: string;
  serviceName: string;
  contractEndDate: string;
  daysRemaining: number;
  serviceLink: string;
}): string {
  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Contract Reminder</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 16px;">
        Hi <strong>${esc(data.userName)}</strong>,
      </p>
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Your <strong>${esc(data.serviceName)}</strong> contract ends in <strong>${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"}</strong> on <strong>${esc(data.contractEndDate)}</strong>.
      </p>
      <div style="background:#f1f5f9;border-radius:12px;padding:16px;margin-bottom:20px;">
        <table style="width:100%;border-collapse:collapse;font-size:14px;color:#475569;">
          <tr><td style="padding:6px 0;">Service</td><td style="text-align:right;font-weight:600;">${esc(data.serviceName)}</td></tr>
          <tr><td style="padding:6px 0;">Ends On</td><td style="text-align:right;">${esc(data.contractEndDate)}</td></tr>
          <tr><td style="padding:6px 0;">Time Remaining</td><td style="text-align:right;">${data.daysRemaining} day${data.daysRemaining === 1 ? "" : "s"}</td></tr>
        </table>
      </div>
      <a href="${data.serviceLink}" style="display:block;text-align:center;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
        Review Service
      </a>
    </div>
    <div style="padding:16px 24px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">LocateFlow · Manage your relocation with ease</p>
    </div>
  </div>
</body>
</html>`;
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
      (b) =>
        `<tr><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;">${esc(b.name)}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;">$${b.amount.toFixed(2)}</td><td style="padding:8px 0;border-bottom:1px solid #f1f5f9;text-align:right;color:#64748b;">${esc(b.dueDate)}</td></tr>`,
    )
    .join("");

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Weekly Digest</h1>
      <p style="color:rgba(255,255,255,0.8);margin:8px 0 0;font-size:13px;">${data.weekStart} – ${data.weekEnd}</p>
    </div>
    <div style="padding:24px;">
      <p style="color:#334155;font-size:15px;line-height:1.6;margin:0 0 20px;">
        Hi <strong>${esc(data.userName)}</strong>, here's your weekly summary:
      </p>

      <!-- Stats -->
      <div style="display:flex;gap:12px;margin-bottom:20px;">
        <div style="flex:1;background:#f1f5f9;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#7c3aed;">$${data.totalExpenses.toFixed(0)}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">Monthly Cost</p>
        </div>
        <div style="flex:1;background:#f1f5f9;border-radius:12px;padding:16px;text-align:center;">
          <p style="margin:0;font-size:24px;font-weight:700;color:#7c3aed;">${data.newServices}</p>
          <p style="margin:4px 0 0;font-size:11px;color:#64748b;">New Services</p>
        </div>
      </div>

      ${
        data.upcomingBills.length > 0
          ? `
      <h3 style="color:#334155;font-size:14px;margin:0 0 12px;">Upcoming Bills</h3>
      <table style="width:100%;border-collapse:collapse;font-size:13px;color:#334155;margin-bottom:20px;">
        <thead><tr><td style="padding:8px 0;border-bottom:2px solid #e2e8f0;font-weight:600;">Service</td><td style="padding:8px 0;border-bottom:2px solid #e2e8f0;text-align:right;font-weight:600;">Amount</td><td style="padding:8px 0;border-bottom:2px solid #e2e8f0;text-align:right;font-weight:600;">Due</td></tr></thead>
        <tbody>${billRows}</tbody>
      </table>`
          : ""
      }

      <a href="${data.appUrl || DEFAULT_APP_URL}/dashboard" style="display:block;text-align:center;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;">
        Open Dashboard
      </a>
    </div>
    <div style="padding:16px 24px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">LocateFlow · Manage your relocation with ease</p>
    </div>
  </div>
</body>
</html>`;
}
