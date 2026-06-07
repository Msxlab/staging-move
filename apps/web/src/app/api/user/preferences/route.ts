import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit, getRateLimitKey } from "@/lib/rate-limit";
import {
  loadUserPreferences,
  saveDashboardWidgetPrefs,
  saveShowBudgetPreference,
} from "@/lib/user-preferences";

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
    return NextResponse.json(await loadUserPreferences(userId));
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

  const rl = await rateLimit(getRateLimitKey(request, "user:prefs:patch", { userId }), {
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
    if (typeof parsed.data.showBudget === "boolean") {
      return NextResponse.json(await saveShowBudgetPreference(userId, parsed.data.showBudget));
    }
    return NextResponse.json({ ok: true });
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

  const rl = await rateLimit(getRateLimitKey(request, "user:prefs", { userId }), { limit: 30, windowSeconds: 60 });
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
    return NextResponse.json(await saveDashboardWidgetPrefs(userId, parsed.data));
  } catch (error: any) {
    console.error("[USER_PREFERENCES PUT] Failed:", error?.message);
    return NextResponse.json({ error: "Failed to save preferences" }, { status: 500 });
  }
}
