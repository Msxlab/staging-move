import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { resolveClientIpFromHeaders } from "@/lib/client-ip";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { getUserSession } from "@/lib/user-auth";

export const runtime = "nodejs";

// Keep in sync with the WaitlistSignup.target values in schema.prisma.
// Adding a new target requires:
//  1. Listing it here
//  2. Wiring the marketing surface that posts to this endpoint
//  3. Adding the admin filter in apps/admin waitlist view
const TARGETS = [
  "MOBILE_IOS",
  "MOBILE_ANDROID",
  "MOBILE_ANY",
  "PLAN_FAMILY",
  "PLAN_PRO",
  "API_ACCESS",
] as const;

const schema = z.object({
  email: z.string().email().max(255),
  target: z.enum(TARGETS),
  source: z.string().max(60).optional(),
  note: z.string().max(1000).optional(),
  locale: z.string().max(10).optional(),
});

export async function POST(request: NextRequest) {
  // IP-keyed limit — 10 signups per hour per IP is generous for honest traffic
  // and brutal for scraping / email-enumeration attempts.
  const rl = await rateLimit(getRateLimitKey(request, "waitlist"), {
    limit: 10,
    windowSeconds: 60 * 60,
  });
  if (!rl.success) {
    return NextResponse.json(
      { error: "Too many requests. Try again shortly." },
      { status: 429 },
    );
  }

  const body = await request.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid input", issues: parsed.error.flatten() },
      { status: 400 },
    );
  }
  const { email, target, source, note, locale } = parsed.data;

  const userAgent = request.headers.get("user-agent")?.slice(0, 500) || null;
  const resolvedIp = resolveClientIpFromHeaders(request.headers);
  const ip = resolvedIp === "anonymous" ? null : resolvedIp;
  const ipHash = ip ? createHash("sha256").update(ip).digest("hex") : null;

  // Tie to the logged-in user if we have a session — outreach is simpler.
  const session = await getUserSession().catch(() => null);
  const userId = session?.userId ?? null;

  // Idempotent — if the same email already signed up for the same target,
  // return success so the UI shows the same happy state without a duplicate
  // row or a discoverable "email already exists" enumeration signal.
  const existing = await prisma.waitlistSignup.findUnique({
    where: { email_target: { email: email.toLowerCase(), target } },
  });
  if (existing) {
    return NextResponse.json({ ok: true, alreadySignedUp: true });
  }

  await prisma.waitlistSignup.create({
    data: {
      email: email.toLowerCase(),
      target,
      source: source ?? null,
      note: note ?? null,
      ipHash,
      userAgent,
      locale: locale ?? null,
      userId,
    },
  });

  return NextResponse.json({ ok: true });
}
