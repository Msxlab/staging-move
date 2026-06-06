import { prisma } from "@/lib/db";

export function isUniqueConstraintError(error: unknown) {
  return Boolean(error && typeof error === "object" && (error as any).code === "P2002");
}

export async function hasProcessedWebhookEvent(id: string) {
  const existing = await prisma.processedWebhookEvent.findUnique({
    where: { id },
    select: { id: true },
  });
  return Boolean(existing);
}

export async function markWebhookEventProcessed(id: string, source: string) {
  try {
    await prisma.processedWebhookEvent.create({
      data: { id, source },
    });
    return "created" as const;
  } catch (error) {
    if (isUniqueConstraintError(error)) return "duplicate" as const;
    throw error;
  }
}

/**
 * Release a previously-reserved webhook event so a retry can re-process it.
 *
 * Used when an event is reserved up-front (atomic, race-free) but processing
 * then fails: deleting the marker lets the provider's retry re-run the handler
 * instead of seeing a duplicate and silently dropping the work. Scoped by
 * source so one provider can't release another's marker.
 */
export async function releaseProcessedWebhookEvent(id: string, source: string) {
  await prisma.processedWebhookEvent.deleteMany({ where: { id, source } });
}
