import { prisma } from "@/lib/db";

function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as { code?: string }).code === "P2002");
}

export interface InAppNotificationInput {
  userId: string;
  type: string;
  title: string;
  body: string;
  href?: string | null;
  icon?: string | null;
  dedupeKey?: string;
  metadata?: Record<string, unknown>;
}

function buildMetadata(input: InAppNotificationInput) {
  const metadata = {
    ...(input.metadata || {}),
    ...(input.dedupeKey ? { dedupeKey: input.dedupeKey } : {}),
  };

  return Object.keys(metadata).length > 0 ? JSON.stringify(metadata) : null;
}

export async function createInAppNotification(input: InAppNotificationInput): Promise<boolean> {
  const deliveredAt = new Date();

  try {
    await prisma.notification.create({
      data: {
        userId: input.userId,
        type: input.type,
        title: input.title,
        body: input.body,
        href: input.href || null,
        icon: input.icon || null,
        channel: "IN_APP",
        sent: true,
        sentAt: deliveredAt,
        sendAt: deliveredAt,
        dedupeKey: input.dedupeKey || null,
        metadata: buildMetadata(input),
      },
    });
    return true;
  } catch (error) {
    // The @@unique([userId, channel, dedupeKey]) constraint makes dedupe atomic:
    // a concurrent create with the same key loses the race and is treated as
    // already-delivered (not an error). Without a dedupeKey, NULLs are distinct
    // so this never fires.
    if (input.dedupeKey && isUniqueConstraintError(error)) {
      return false;
    }
    throw error;
  }
}
