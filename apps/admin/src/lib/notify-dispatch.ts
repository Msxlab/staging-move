import { prisma } from "@/lib/db";
import { sendEmail } from "@/lib/email";
import { getAdminRuntimeConfigValue } from "@/lib/runtime-config";

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100;

interface ExpoPushTicket {
  status?: "ok" | "error";
  message?: string;
  details?: { error?: string };
}

// Operational types (SYSTEM/ANNOUNCEMENT/MAINTENANCE/SUPPORT/BILLING) bypass
// per-user opt-out: a maintenance window ping must reach everyone. MARKETING /
// PROMO content respects an explicit `enabled: false` row so opted-out users
// stop receiving offers immediately.
const OPT_OUT_RESPECTING_TYPES = new Set(["MARKETING", "PROMO"]);

async function fetchOptOutSet(
  userIds: string[],
  channel: "EMAIL" | "PUSH",
  type: string,
): Promise<Set<string>> {
  if (!OPT_OUT_RESPECTING_TYPES.has(type) || userIds.length === 0) return new Set();
  const records = await prisma.notificationPreference.findMany({
    where: { userId: { in: userIds }, channel, type, enabled: false },
    select: { userId: true },
  });
  return new Set(records.map((r) => r.userId));
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (c) => {
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

function renderBroadcastEmailHtml(args: {
  title: string;
  body: string;
  href: string | null | undefined;
  appUrl: string;
}): string {
  const { title, body, href, appUrl } = args;
  const ctaUrl = href
    ? href.startsWith("http")
      ? href
      : `${appUrl.replace(/\/$/, "")}${href.startsWith("/") ? href : `/${href}`}`
    : `${appUrl.replace(/\/$/, "")}/dashboard`;
  const ctaLabel = href ? "Open in LocateFlow" : "Open LocateFlow";
  return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;">
  <div style="max-width:520px;margin:40px auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1);">
    <div style="background:linear-gradient(135deg,#7c3aed,#06b6d4);padding:32px 24px;text-align:center;">
      <h1 style="color:#fff;margin:0;font-size:20px;">${escapeHtml(title)}</h1>
    </div>
    <div style="padding:24px;">
      <p style="color:#334155;font-size:15px;line-height:1.5;white-space:pre-wrap;">${escapeHtml(body)}</p>
      <a href="${escapeHtml(ctaUrl)}" style="display:block;text-align:center;background:#7c3aed;color:#fff;text-decoration:none;padding:12px 24px;border-radius:10px;font-size:14px;font-weight:600;margin-top:20px;">${ctaLabel}</a>
    </div>
    <div style="padding:16px 24px;text-align:center;border-top:1px solid #f1f5f9;">
      <p style="color:#94a3b8;font-size:11px;margin:0;">LocateFlow · You can manage notifications in Settings.</p>
    </div>
  </div>
</body></html>`;
}

function toPushBody(body: string): string {
  return body.replace(/\s+/g, " ").trim().slice(0, 180);
}

export interface DispatchResult {
  delivered: number;
  skipped: number;
}

/**
 * Fan out a broadcast email to a batch of user IDs. Looks up emails, respects
 * MARKETING opt-out, and renders a branded template. Returns counts.
 */
export async function dispatchEmailBatch(args: {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  href?: string | null;
}): Promise<DispatchResult> {
  if (args.userIds.length === 0) return { delivered: 0, skipped: 0 };

  const optOut = await fetchOptOutSet(args.userIds, "EMAIL", args.type);
  const recipients = await prisma.user.findMany({
    where: { id: { in: args.userIds } },
    select: { id: true, email: true },
  });

  const appUrl =
    (await getAdminRuntimeConfigValue("NEXT_PUBLIC_APP_URL")) ||
    "https://locateflow.com";
  const html = renderBroadcastEmailHtml({
    title: args.title,
    body: args.body,
    href: args.href,
    appUrl,
  });

  let delivered = 0;
  let skipped = 0;
  for (const user of recipients) {
    if (!user.email) {
      skipped++;
      continue;
    }
    if (optOut.has(user.id)) {
      skipped++;
      continue;
    }
    const ok = await sendEmail({
      to: user.email,
      subject: args.title,
      html,
    });
    if (ok) delivered++;
    else skipped++;
  }
  return { delivered, skipped };
}

/**
 * Fan out push notifications via Expo to a batch of user IDs. Looks up
 * registered push tokens, respects MARKETING opt-out, prunes invalid tokens
 * (DeviceNotRegistered) so the next broadcast doesn't retry them. Returns
 * counts of successful tickets and skipped recipients.
 */
export async function dispatchPushBatch(args: {
  userIds: string[];
  type: string;
  title: string;
  body: string;
  href?: string | null;
}): Promise<DispatchResult> {
  if (args.userIds.length === 0) return { delivered: 0, skipped: 0 };

  const pushDisabled = process.env.NOTIFICATION_PUSH_ENABLED !== "true";
  if (pushDisabled) {
    return { delivered: 0, skipped: args.userIds.length };
  }

  const optOut = await fetchOptOutSet(args.userIds, "PUSH", args.type);
  const eligibleUserIds = args.userIds.filter((id) => !optOut.has(id));

  const devices = await prisma.pushDevice.findMany({
    where: { userId: { in: eligibleUserIds } },
    select: { token: true, userId: true },
  });

  if (devices.length === 0) {
    return { delivered: 0, skipped: args.userIds.length };
  }

  const messages = devices.map((device) => ({
    to: device.token,
    title: args.title,
    body: toPushBody(args.body),
    sound: "default",
    data: {
      type: args.type,
      href: args.href || null,
      kind: "admin-broadcast",
    },
  }));

  let delivered = 0;
  const invalidTokens = new Set<string>();

  for (let i = 0; i < messages.length; i += EXPO_PUSH_BATCH_SIZE) {
    const batch = messages.slice(i, i + EXPO_PUSH_BATCH_SIZE);
    const batchDevices = devices.slice(i, i + EXPO_PUSH_BATCH_SIZE);
    const response = await fetch(EXPO_PUSH_SEND_URL, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Accept-Encoding": "gzip, deflate",
        "Content-Type": "application/json",
      },
      body: JSON.stringify(batch),
    });

    if (!response.ok) {
      console.error(`[admin-push] Expo send failed: HTTP ${response.status}`);
      continue;
    }

    const json = (await response.json().catch(() => null)) as
      | { data?: ExpoPushTicket[] | ExpoPushTicket }
      | null;
    const tickets = Array.isArray(json?.data)
      ? json!.data
      : json?.data
        ? [json.data]
        : [];

    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        delivered++;
        return;
      }
      const token = batchDevices[index]?.token;
      if (token && ticket.details?.error === "DeviceNotRegistered") {
        invalidTokens.add(token);
        return;
      }
      console.error(
        "[admin-push] Expo ticket error:",
        ticket.message || ticket.details?.error || "unknown",
      );
    });
  }

  if (invalidTokens.size > 0) {
    await prisma.pushDevice.deleteMany({
      where: { token: { in: [...invalidTokens] } },
    });
  }

  const reachedUsers = new Set(devices.map((d) => d.userId));
  const skipped = args.userIds.filter((id) => !reachedUsers.has(id) || optOut.has(id)).length;
  return { delivered, skipped };
}
