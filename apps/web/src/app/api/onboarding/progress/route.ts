import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { apiGateErrorResponse } from "@/lib/api-gates";
import { auditImpersonatedMutation } from "@/lib/impersonation-audit";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import { ONBOARDING_COMPLETED_EVENT } from "@/lib/legal";
import {
  resolveWorkspaceDataScope,
  scopedRecordWhere,
} from "@/lib/workspace-data-scope";
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

  // Server-side prerequisite gate for COMPLETED: a client must not be able to
  // mark onboarding complete without satisfying the hard prerequisite (at least
  // one address). The progress derivation (getOnboardingProgress) now also
  // requires an address before honoring the COMPLETED event, but we reject the
  // write here too so a stray/forged COMPLETED row is never persisted in the
  // first place. Scoped via the same workspace-data-scope helper the rest of the
  // onboarding surface uses, so a workspace member's shared addresses count.
  if (parsed.data.event === "COMPLETED") {
    try {
      const scope = await resolveWorkspaceDataScope(request, userId);
      const addressCount = await prisma.address.count({
        where: scopedRecordWhere(scope, { deletedAt: null }, { childSelfOnly: true }),
      });
      if (addressCount <= 0) {
        return NextResponse.json(
          { error: "Add an address before completing onboarding." },
          { status: 400 },
        );
      }
    } catch (error) {
      const gateResponse = apiGateErrorResponse(error);
      if (gateResponse) return gateResponse;
      throw error;
    }
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

    // Forensic attribution if an admin is impersonating (no-op otherwise). (admin-impersonation-02)
    await auditImpersonatedMutation(request, {
      action: "CREATE",
      entityType: "UserEvent",
      entityId: userId,
      route: "/api/onboarding/progress",
      details: { event },
    });
  }

  return NextResponse.json({ ok: true, event });
}
