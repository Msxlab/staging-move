import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";

const widgetPrefsSchema = z
  .object({
    order: z.array(z.string().min(1).max(40)).max(40).optional(),
    visibility: z.record(z.string().min(1).max(40), z.boolean()).optional(),
  })
  .strict();

// Top-level UI preference toggles. Kept separate from the dashboard
// widget JSON because these affect global navigation and are partial-
// update friendly via PATCH.
const uiPrefsPatchSchema = z
  .object({
    showBudget: z.boolean().optional(),
  })
  .strict();

export async function GET() {
  try {
    const userId = await requireDbUserId();
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { dashboardWidgetPrefs: true, showBudget: true },
    });
    return NextResponse.json({
      dashboardWidgetPrefs: user?.dashboardWidgetPrefs ?? null,
      showBudget: user?.showBudget ?? true,
    });
  } catch (error: any) {
    if (error?.message?.toLowerCase().includes("unauthorized") || error?.status === 401) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    console.error("[USER_PREFERENCES GET] Failed:", error?.message);
    return NextResponse.json({ error: "Failed to load preferences" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getRateLimitKey(request, "user:prefs:patch"), {
    limit: 30,
    windowSeconds: 60,
  });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = uiPrefsPatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  // Empty body is valid Zod-wise but a no-op — short-circuit.
  if (Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ ok: true });
  }

  try {
    const updated = await prisma.user.update({
      where: { id: userId },
      data: parsed.data,
      select: { showBudget: true },
    });
    return NextResponse.json({ showBudget: updated.showBudget });
  } catch (error: any) {
    console.error("[USER_PREFERENCES PATCH] Failed:", error?.message);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  let userId: string;
  try {
    userId = await requireDbUserId();
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rl = await rateLimit(getRateLimitKey(request, "user:prefs"), { limit: 30, windowSeconds: 60 });
  if (!rl.success) {
    return NextResponse.json({ error: "Too many requests" }, { status: 429 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = widgetPrefsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: userId },
      data: { dashboardWidgetPrefs: parsed.data },
    });
    return NextResponse.json({ dashboardWidgetPrefs: parsed.data });
  } catch (error: any) {
    console.error("[USER_PREFERENCES PUT] Failed:", error?.message);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
