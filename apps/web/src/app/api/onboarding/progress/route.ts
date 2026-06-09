import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { ONBOARDING_COMPLETED_EVENT } from "@/lib/legal";
import {
  ONBOARDING_FUNNEL_STEPS,
  ONBOARDING_MOVING_SKIPPED_EVENT,
  ONBOARDING_SERVICES_SKIPPED_EVENT,
  ONBOARDING_STARTED_EVENT,
  onboardingStepViewedEvent,
} from "@/lib/onboarding-progress";

const eventMap = {
  SERVICES_SKIPPED: ONBOARDING_SERVICES_SKIPPED_EVENT,
  MOVING_SKIPPED: ONBOARDING_MOVING_SKIPPED_EVENT,
  COMPLETED: ONBOARDING_COMPLETED_EVENT,
} as const;

const bodySchema = z.object({
  event: z.enum(["SERVICES_SKIPPED", "MOVING_SKIPPED", "COMPLETED", "STARTED", "STEP_VIEWED"]),
  step: z.enum(ONBOARDING_FUNNEL_STEPS).optional(),
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

  // Resolve the stored event name. Funnel events (STARTED / STEP_VIEWED) sit
  // alongside the original skip/complete events; STEP_VIEWED requires a step so
  // each step gets its own deduped row, exposing per-step drop-off.
  let event: string;
  if (parsed.data.event === "STARTED") {
    event = ONBOARDING_STARTED_EVENT;
  } else if (parsed.data.event === "STEP_VIEWED") {
    if (!parsed.data.step) {
      return NextResponse.json({ error: "step is required for STEP_VIEWED" }, { status: 400 });
    }
    event = onboardingStepViewedEvent(parsed.data.step);
  } else {
    event = eventMap[parsed.data.event];
  }

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
        metadata: JSON.stringify({ source: "onboarding", ...(parsed.data.step ? { step: parsed.data.step } : {}) }),
      },
    });
  }

  return NextResponse.json({ ok: true, event });
}
