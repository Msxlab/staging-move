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
