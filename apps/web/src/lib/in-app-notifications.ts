import { prisma } from "@/lib/db";

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
  if (input.dedupeKey) {
    const existing = await prisma.notification.findFirst({
      where: {
        userId: input.userId,
        channel: "IN_APP",
        metadata: { contains: input.dedupeKey },
      },
      select: { id: true },
    });
    if (existing) return false;
  }

  const deliveredAt = new Date();

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
      metadata: buildMetadata(input),
    },
  });

  return true;
}
