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

/**
 * Send a notification via the configured channel.
 * Email uses Resend; SMS and Push are placeholders.
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
  // TODO: Replace with Twilio integration
  // import twilio from "twilio";
  // const client = twilio(process.env.TWILIO_SID, process.env.TWILIO_AUTH_TOKEN);
  // await client.messages.create({ to: userPhone, from: process.env.TWILIO_PHONE, body });

  console.log(`[SMS] To userId: ${payload.userId} | Body: ${payload.body.slice(0, 160)}`);
  return true;
}

async function sendPush(payload: NotificationPayload): Promise<boolean> {
  // TODO: Replace with web push or Firebase Cloud Messaging
  console.log(`[PUSH] To userId: ${payload.userId} | Title: ${payload.subject}`);
  return true;
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
