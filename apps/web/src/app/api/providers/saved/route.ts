import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";

/**
 * Server-side provider shortlist (replaces the client-only localStorage list so
 * saves survive device switches).
 *   GET    → { providerIds: string[] }   the user's saved providers
 *   POST   { providerId }                save (idempotent upsert)
 *   DELETE { providerId }                un-save
 */
const bodySchema = z.object({ providerId: z.string().min(1).max(30) });

async function authed(): Promise<string | null> {
  try {
    return await requireDbUserId();
  } catch {
    return null;
  }
}

export async function GET() {
  const userId = await authed();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rows = await prisma.savedProvider.findMany({
    where: { userId },
    select: { providerId: true },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json({ providerIds: rows.map((r) => r.providerId) });
}

export async function POST(request: NextRequest) {
  const userId = await authed();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await rateLimit(getRateLimitKey(request, "providers:saved", { userId }), {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.success) return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  const provider = await prisma.serviceProvider.findUnique({
    where: { id: parsed.data.providerId },
    select: { id: true },
  });
  if (!provider) return NextResponse.json({ error: "Provider not found" }, { status: 404 });

  await prisma.savedProvider.upsert({
    where: { userId_providerId: { userId, providerId: parsed.data.providerId } },
    create: { userId, providerId: parsed.data.providerId },
    update: {},
  });
  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, { action: "SAVED_PROVIDER_ADD", entityType: "SavedProvider", entityId: parsed.data.providerId, route: "/api/providers/saved" });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: NextRequest) {
  const userId = await authed();
  if (!userId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const rl = await rateLimit(getRateLimitKey(request, "providers:saved", { userId }), {
    limit: 60,
    windowSeconds: 60,
  });
  if (!rl.success) return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request" }, { status: 400 });

  await prisma.savedProvider.deleteMany({ where: { userId, providerId: parsed.data.providerId } });
  // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
  await auditImpersonatedMutation(request, { action: "SAVED_PROVIDER_REMOVE", entityType: "SavedProvider", entityId: parsed.data.providerId, route: "/api/providers/saved" });
  return NextResponse.json({ ok: true });
}
