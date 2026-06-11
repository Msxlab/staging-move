import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

export type AdminChangeSet = Record<
  string,
  { from: unknown; to: unknown }
>;

const NOTIFICATION_TYPE = "ACCOUNT_UPDATED_BY_ADMIN";
const EMAIL_DEBOUNCE_MS = 5 * 60 * 1000;

function esc(str: string): string {
  return String(str).replace(/[&<>"']/g, (c) => {
    const map: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return map[c] || c;
  });
}

function humanizeField(key: string): string {
  return key
    .replace(/([A-Z])/g, " $1")
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function renderChangesHtml(changes: AdminChangeSet): string {
  const rows = Object.entries(changes).map(
    ([k, v]) =>
      `<li style="margin:4px 0;color:#334155;font-size:14px;"><strong>${esc(humanizeField(k))}</strong>: ${esc(
        String(v.from ?? "—"),
      )} → ${esc(String(v.to ?? "—"))}</li>`,
  );
  return `<ul style="padding-left:18px;margin:12px 0;">${rows.join("")}</ul>`;
}

function renderEmailHtml(opts: {
  userName: string;
  changes: AdminChangeSet;
  appUrl: string;
}): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#0E1420,#357A6C);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">Account Updated by Support</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#334155;font-size:15px;">Hi <strong>${esc(opts.userName)}</strong>,</p>
      <p style="color:#334155;font-size:15px;">A LocateFlow administrator updated the following on your account:</p>
      ${renderChangesHtml(opts.changes)}
      <p style="color:#334155;font-size:14px;margin-top:16px;">
        If you did not request this, please reply to this email or contact support immediately.
      </p>
      <a href="${opts.appUrl}/settings" style="display:block;text-align:center;background:#357A6C;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-top:20px;">
        Review Account Settings
      </a>
    </div>
    <div style="padding:16px 24px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">LocateFlow</p>
    </div>
  </div>
</body></html>`;
}

/**
 * Record an in-app Notification AND (de-duplicated) email when an admin
 * mutates a user's data. If the same user was notified in the last
 * EMAIL_DEBOUNCE_MS window, skip the email but still record the Notification.
 * Fire-and-forget: never throws — callers don't need to wait or handle errors.
 */
export async function notifyUserOfAdminChange(input: {
  userId: string;
  changes: AdminChangeSet;
  actorAdminId: string;
}): Promise<void> {
  if (!Object.keys(input.changes).length) return;

  try {
    const user = await prisma.user.findUnique({
      where: { id: input.userId },
      select: { email: true, firstName: true },
    });
    if (!user?.email) return;

    const now = new Date();
    const debounceCutoff = new Date(now.getTime() - EMAIL_DEBOUNCE_MS);

    const recent = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        type: NOTIFICATION_TYPE,
        createdAt: { gte: debounceCutoff },
      },
      select: { id: true },
    });

    const body = Object.entries(input.changes)
      .map(
        ([k, v]) =>
          `${humanizeField(k)}: ${String(v.from ?? "—")} → ${String(v.to ?? "—")}`,
      )
      .join("; ");

    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: NOTIFICATION_TYPE,
        title: "Your account was updated by support",
        body,
        channel: recent ? "IN_APP" : "EMAIL",
        sent: false,
        metadata: JSON.stringify({
          changes: input.changes,
          actorAdminId: input.actorAdminId,
        }),
      },
    });

    if (recent) return;

    const appUrl =
      (await getAdminRuntimeConfigValue("NEXT_PUBLIC_APP_URL")) ||
      "http://localhost:3000";
    void sendEmail({
      to: user.email,
      subject: "Your LocateFlow account was updated",
      html: renderEmailHtml({
        userName: user.firstName || "there",
        changes: input.changes,
        appUrl,
      }),
    });
  } catch (error) {
    console.error("[user-notify] failed:", error);
  }
}
