import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";

/**
 * POST /api/providers/recommendations/feedback
 *
 * Records a per-user dismiss / not-relevant / snooze on a recommended provider.
 * The recommendations route loads active feedback and excludes those providers
 * from the recommendation clusters, so the engine stops re-surfacing rejected
 * picks. Upserts one row per (user, provider).
 */
const bodySchema = z.object({
  providerId: z.string().min(1).max(30),
  action: z.enum(["DISMISS", "NOT_RELEVANT", "SNOOZE"]).default("NOT_RELEVANT"),
  snoozeDays: z.number().int().positive().max(365).optional(),
});

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getRateLimitKey(request, "recommendation:feedback", { userId }), {
    limit: 40,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid feedback" }, { status: 400 });
  }

  const { providerId, action, snoozeDays } = parsed.data;
  const until =
    action === "SNOOZE" && snoozeDays ? new Date(Date.now() + snoozeDays * 24 * 60 * 60 * 1000) : null;

  // Validate the provider exists so a bad id returns 404 instead of an FK 500.
  const provider = await prisma.serviceProvider.findUnique({ where: { id: providerId }, select: { id: true } });
  if (!provider) {
    return NextResponse.json({ error: "Provider not found" }, { status: 404 });
  }

  await prisma.recommendationFeedback.upsert({
    where: { userId_providerId: { userId, providerId } },
    create: { userId, providerId, action, until },
    update: { action, until },
  });

  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, {
    action: "UPSERT",
    entityType: "RecommendationFeedback",
    entityId: providerId,
    route: "/api/providers/recommendations/feedback",
    details: { action },
  });

  return NextResponse.json({ ok: true });
}
