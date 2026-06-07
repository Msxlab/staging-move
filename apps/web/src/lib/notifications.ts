import { prisma } from "@/lib/db";
import { sendLoggedEmail } from "@/lib/email-service";

export interface NotificationPayload {
  userId: string;
  type: "EMAIL" | "SMS" | "PUSH";
  subject: string;
  body: string;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

interface ExpoPushTicket {
  status?: "ok" | "error";
  id?: string;
  message?: string;
  details?: {
    error?: string;
  };
}

const EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send";
const EXPO_PUSH_BATCH_SIZE = 100;

/**
 * Send a notification via the configured channel.
 * Email uses Resend. SMS and push deliberately fail closed until provider
 * credentials/integrations are configured so callers never get a false
 * "sent" signal.
 */
export async function sendNotification(payload: NotificationPayload): Promise<boolean> {
  try {
    switch (payload.type) {
      case "EMAIL":
        return await sendEmailNotification(payload);
      case "SMS":
        return await sendSms(payload);
      case "PUSH":
        return await sendPush(payload);
      default:
        console.warn(`Unknown notification type: ${payload.type}`);
        return false;
    }
  } catch (error) {
    console.error("Notification send failed:", error);
    return false;
  }
}

async function sendEmailNotification(payload: NotificationPayload): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { id: payload.userId }, select: { email: true } });
  if (!user?.email) return false;

  const result = await sendLoggedEmail({
    to: user.email,
    subject: payload.subject,
    html: payload.body,
    dedupeKey: payload.dedupeKey,
    metadata: {
      kind: "notification-email",
      userId: payload.userId,
      type: payload.type,
      ...(payload.metadata || {}),
    },
  });

  return result.success;
}

async function sendSms(payload: NotificationPayload): Promise<boolean> {
  if (process.env.NOTIFICATION_SMS_ENABLED !== "true") {
    console.warn(`[SMS] skipped for userId=${payload.userId}; SMS notifications are not configured.`);
    return false;
  }

  console.error("[SMS] NOTIFICATION_SMS_ENABLED is true, but no SMS provider is implemented.");
  return false;
}

async function sendPush(payload: NotificationPayload): Promise<boolean> {
  if (process.env.NOTIFICATION_PUSH_ENABLED !== "true") {
    console.warn(`[PUSH] skipped for userId=${payload.userId}; push notifications are not configured.`);
    return false;
  }

  const devices = await prisma.pushDevice.findMany({
    where: { userId: payload.userId },
    select: { token: true },
  });
  if (devices.length === 0) return false;

  const channelId = pushChannelId(payload);
  const messages = devices.map((device) => ({
    to: device.token,
    title: payload.subject,
    body: toPushBody(payload.body),
    sound: "default",
    // priority:"high" + an Android channel are what make the OS wake the
    // screen / show a heads-up banner. Without these, Expo delivers at NORMAL
    // priority and Android may batch/silence the notification on a locked
    // screen. channelId routes to a channel registered in the mobile app
    // (apps/mobile/src/lib/push.ts) — "move-alerts" is HIGH importance.
    priority: "high" as const,
    channelId,
    data: {
      ...(payload.metadata || {}),
      dedupeKey: payload.dedupeKey || null,
    },
  }));

  let successCount = 0;
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
      console.error(`[PUSH] Expo send failed with status ${response.status}`);
      continue;
    }

    const result = await response.json().catch(() => null) as { data?: ExpoPushTicket[] | ExpoPushTicket } | null;
    const tickets = Array.isArray(result?.data)
      ? result.data
      : result?.data
        ? [result.data]
        : [];

    tickets.forEach((ticket, index) => {
      if (ticket.status === "ok") {
        successCount++;
        return;
      }

      const token = batchDevices[index]?.token;
      if (token && ticket.details?.error === "DeviceNotRegistered") {
        invalidTokens.add(token);
        return;
      }

      console.error("[PUSH] Expo ticket error:", ticket.message || ticket.details?.error || "unknown");
    });
  }

  if (invalidTokens.size > 0) {
    await prisma.pushDevice.deleteMany({
      where: { token: { in: [...invalidTokens] } },
    });
  }

  return successCount > 0;
}

/**
 * Map a notification to an Android push channel registered in the mobile app
 * (apps/mobile/src/lib/push.ts). The channel controls OS importance: the
 * "move-alerts" channel is HIGH importance, so move/task notifications wake the
 * screen and show a heads-up banner; "billing" is DEFAULT; "default" is the
 * fallback. iOS ignores channelId (it has no channels) but is unaffected by it.
 *
 * The "kind" is carried on `metadata` (callers set `metadata.kind`, e.g.
 * "task-reminder", "bill-reminder", "move-reminder"). We also tolerate
 * screaming-snake forms like "MOVE_ALERT" / "TASK_REMINDER" / "BILL_DUE" and a
 * `metadata.type` fallback, normalizing case before matching.
 */
function pushChannelId(payload: NotificationPayload): "move-alerts" | "billing" | "default" {
  const meta = payload.metadata || {};
  const raw =
    (typeof meta.kind === "string" && meta.kind) ||
    (typeof meta.type === "string" && meta.type) ||
    "";
  const k = raw.toLowerCase();

  if (k.includes("move") || k.includes("task")) return "move-alerts";
  if (k.includes("bill")) return "billing";
  return "default";
}

function toPushBody(body: string) {
  return body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

// NOTE: `processReminders()` was removed here — it was dead code (no caller
// anywhere) that emailed services' owners directly off the `Reminder` model
// with NO notification-preference check, NO emailEnabled gate, and NO
// soft-delete guard, so if it had ever been wired up it would have emailed
// opted-out and deleted users. The live reminder pipeline is the cron set under
// app/api/cron/* (bill/task/move/contract reminders), which all gate correctly.
