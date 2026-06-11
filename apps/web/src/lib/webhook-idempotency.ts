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

/**
 * Atomically RESERVE a webhook event id BEFORE running any side-effects.
 *
 * This is the race-free entry point for reserve-before-act idempotency (the
 * pattern the Stripe webhook uses): it creates the unique ProcessedWebhookEvent
 * marker up front, so a concurrent duplicate delivery loses the create race and
 * gets `"duplicate"` here — before either delivery can double-run a side-effect.
 * Prefer this over the read-only `hasProcessedWebhookEvent` check, which leaves
 * a check-then-act window where two deliveries both pass the read and both run.
 *
 * Returns `"reserved"` to the single winner, `"duplicate"` to everyone else.
 * On a `"reserved"` result the caller owns the marker and MUST either leave it
 * in place on success or call `releaseWebhookEvent` on failure so a legitimate
 * provider retry can reprocess.
 *
 * Thin alias over `markWebhookEventProcessed` (the underlying create-or-conflict
 * primitive) with intention-revealing naming; the Stripe caller continues to use
 * `markWebhookEventProcessed` directly.
 */
export async function reserveWebhookEvent(id: string, source: string) {
  const result = await markWebhookEventProcessed(id, source);
  return result === "created" ? ("reserved" as const) : ("duplicate" as const);
}

/**
 * Release a marker reserved with `reserveWebhookEvent` after processing failed.
 * Alias of `releaseProcessedWebhookEvent` paired with `reserveWebhookEvent` so a
 * call site reads as a matched reserve/release pair.
 */
export async function releaseWebhookEvent(id: string, source: string) {
  await releaseProcessedWebhookEvent(id, source);
}
