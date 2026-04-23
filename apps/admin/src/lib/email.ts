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

const DEFAULT_FROM_EMAIL = "LocateFlow <noreply@locateflow.com>";
const DEFAULT_APP_URL = "http://localhost:3000";

async function resolveEmailConfig() {
  const values = await getAdminRuntimeConfigValues([
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

export async function sendEmail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const { resendApiKey, fromEmail } = await resolveEmailConfig();

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
    });
    if (error) {
      console.error("[EMAIL] Send failed:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[EMAIL] Error:", err);
    return false;
  }
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
