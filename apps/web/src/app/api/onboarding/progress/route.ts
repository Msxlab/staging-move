import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { ONBOARDING_COMPLETED_EVENT } from "@/lib/legal";
import {
  ONBOARDING_MOVING_SKIPPED_EVENT,
  ONBOARDING_SERVICES_SKIPPED_EVENT,
} from "@/lib/onboarding-progress";

const eventMap = {
  SERVICES_SKIPPED: ONBOARDING_SERVICES_SKIPPED_EVENT,
  MOVING_SKIPPED: ONBOARDING_MOVING_SKIPPED_EVENT,
  COMPLETED: ONBOARDING_COMPLETED_EVENT,
} as const;

const bodySchema = z.object({
  event: z.enum(["SERVICES_SKIPPED", "MOVING_SKIPPED", "COMPLETED"]),
});

export async function POST(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getRateLimitKey(request, "onboarding:progress", { userId }), {
    limit: 20,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests. Please wait." }, { status: 429 });
  }

  const parsed = bodySchema.safeParse(await request.json().catch(() => ({})));
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding progress event" }, { status: 400 });
  }

  const event = eventMap[parsed.data.event];
  const existing = await prisma.userEvent.findFirst({
    where: { userId, event },
    select: { id: true },
  });

  if (!existing) {
    await prisma.userEvent.create({
      data: {
        userId,
        event,
        page: request.nextUrl.pathname,
        metadata: JSON.stringify({ source: "onboarding" }),
      },
    });
  }

  return NextResponse.json({ ok: true, event });
}
