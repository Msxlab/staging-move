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

  const messages = devices.map((device) => ({
    to: device.token,
    title: payload.subject,
    body: toPushBody(payload.body),
    sound: "default",
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

function toPushBody(body: string) {
  return body
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

/**
 * Process due reminders and send notifications.
 * Call this from a cron job or scheduled function.
 */
export async function processReminders(): Promise<number> {
  const now = new Date();
  const dueReminders = await prisma.reminder.findMany({
    where: {
      remindAt: { lte: now },
      sent: false,
    },
    include: {
      service: { select: { providerName: true, category: true, userId: true } },
    },
    take: 100,
  });

  let sentCount = 0;

  for (const reminder of dueReminders) {
    if (!reminder.service) continue;

    const success = await sendNotification({
      userId: reminder.service.userId,
      type: "EMAIL",
      subject: `Reminder: ${reminder.service.providerName}`,
      body: reminder.message || `Your ${reminder.service.category} service with ${reminder.service.providerName} needs attention.`,
      dedupeKey: `reminder:${reminder.id}`,
      metadata: { reminderId: reminder.id, serviceId: reminder.serviceId },
    });

    if (success) {
      await prisma.reminder.update({
        where: { id: reminder.id },
        data: { sent: true, sentAt: new Date() },
      });
      sentCount++;
    }
  }

  return sentCount;
}
