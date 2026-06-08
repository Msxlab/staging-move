import { prisma } from "@/lib/db";
import {
  type UnsubscribeKind,
  notificationTypesForKind,
} from "@/lib/unsubscribe";

const EMAIL_CHANNEL = "EMAIL";

/**
 * Marks the user as opted out for the requested kinds. Idempotent —
 * upserts one NotificationPreference per (channel, type) combination
 * for safe re-execution from one-click unsubscribe + the page form.
 *
 * Returns `false` only if the userId does not point to an active user.
 * Bounce/complaint webhooks set `source: "bounce"` so the audit log can
 * distinguish that path from a user-initiated unsubscribe.
 */
export async function processUnsubscribe(opts: {
  userId: string;
  kind: UnsubscribeKind;
  source?: "click" | "one_click" | "bounce" | "complaint";
}): Promise<boolean> {
  const user = await prisma.user.findFirst({
    where: { id: opts.userId, deletedAt: null },
    select: { id: true },
  });
  if (!user) return false;

  const types = notificationTypesForKind(opts.kind);
  for (const type of types) {
    await prisma.notificationPreference.upsert({
      where: {
        userId_channel_type: {
          userId: opts.userId,
          channel: EMAIL_CHANNEL,
          type,
        },
      },
      create: {
        userId: opts.userId,
        channel: EMAIL_CHANNEL,
        type,
        enabled: false,
      },
      update: {
        enabled: false,
      },
    });
  }

  await prisma.auditLog.create({
    data: {
      userId: opts.userId,
      action: "EMAIL_UNSUBSCRIBE",
      entityType: "NotificationPreference",
      entityId: opts.userId,
      changes: JSON.stringify({
        kind: opts.kind,
        source: opts.source || "click",
        types,
      }),
    },
  }).catch(() => {
    // Audit log failure must not block the unsubscribe — the preference
    // update above is the contract we owe the user.
  });

  return true;
}

/**
 * Reads current opt-out state for a user. Used by the unsubscribe page
 * to show the user which categories are currently off so they don't
 * accidentally re-subscribe themselves on submit.
 */
export async function loadEmailOptOutState(userId: string): Promise<{
  marketingOptedOut: boolean;
  reminderOptedOut: boolean;
}> {
  const prefs = await prisma.notificationPreference.findMany({
    where: { userId, channel: EMAIL_CHANNEL, type: { in: ["MARKETING", "REMINDER"] } },
    select: { type: true, enabled: true },
  });
  const marketing = prefs.find((p) => p.type === "MARKETING");
  const reminder = prefs.find((p) => p.type === "REMINDER");
  return {
    marketingOptedOut: marketing ? !marketing.enabled : false,
    reminderOptedOut: reminder ? !reminder.enabled : false,
  };
}

/**
 * Returns true if the user has opted out of `type` over EMAIL. Safe to
 * call from senders before each send — defaults to false (allow) if no
 * preference row exists, matching the existing cron behavior where the
 * absence of a row means the user has not changed defaults.
 */
export async function isEmailTypeOptedOut(userId: string, type: "MARKETING" | "REMINDER" | "LIFECYCLE"): Promise<boolean> {
  const pref = await prisma.notificationPreference.findUnique({
    where: { userId_channel_type: { userId, channel: EMAIL_CHANNEL, type } },
    select: { enabled: true },
  });
  if (!pref) return false;
  return !pref.enabled;
}
