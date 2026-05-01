import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConsentedTrackingSession } from "@/lib/tracking-consent";

const PII_KEY_PATTERN =
  /(email|e-mail|phone|address|street|zip|postal|name|user.?id|customer.?id|provider.?account|stripe|oauth|token|secret|password|query|search.?term|message|content|budget|lat|lng|latitude|longitude)/i;
const SAFE_AGGREGATE_KEYS = new Set(["query_length"]);
const EMAIL_VALUE_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const LONG_DIGIT_PATTERN = /\d{7,}/;

function sanitizeMetadata(metadata: unknown) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const safe: Record<string, string | number | boolean | Array<string | number | boolean>> = {};
  for (const [key, value] of Object.entries(metadata as Record<string, unknown>)) {
    if (!SAFE_AGGREGATE_KEYS.has(key) && PII_KEY_PATTERN.test(key)) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || EMAIL_VALUE_PATTERN.test(trimmed) || LONG_DIGIT_PATTERN.test(trimmed)) continue;
      safe[key] = trimmed.slice(0, 120);
      continue;
    }
    if (typeof value === "number" || typeof value === "boolean") {
      safe[key] = value;
      continue;
    }
    if (Array.isArray(value)) {
      safe[key] = value
        .filter((item): item is string | number | boolean => ["string", "number", "boolean"].includes(typeof item))
        .slice(0, 10);
    }
  }
  return Object.keys(safe).length ? safe : null;
}

// POST /api/tracking/event — track a single user event
export async function POST(request: NextRequest) {
  try {
    const tracking = await getConsentedTrackingSession(request);
    if (tracking.disabled) {
      return NextResponse.json({ success: true, disabled: true });
    }

    const authSession = tracking.authSession;
    if (!authSession) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { event, page, sessionId, metadata } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }

    const safeMetadata = sanitizeMetadata(metadata);

    await prisma.userEvent.create({
      data: {
        userId: authSession.userId,
        sessionId: sessionId || null,
        event: event.slice(0, 50),
        page: page ? page.slice(0, 200) : null,
        metadata: safeMetadata ? JSON.stringify(safeMetadata).slice(0, 2000) : null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Event tracking error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

// POST /api/tracking/event/batch — track multiple events at once
export async function PUT(request: NextRequest) {
  try {
    const tracking = await getConsentedTrackingSession(request);
    if (tracking.disabled) {
      return NextResponse.json({ success: true, count: 0, disabled: true });
    }

    const authSession = tracking.authSession;
    if (!authSession) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const events: Array<{ event: string; page?: string; sessionId?: string; metadata?: any }> = body.events;

    if (!Array.isArray(events) || events.length === 0) {
      return NextResponse.json({ error: "events array is required" }, { status: 400 });
    }

    const batch = events.slice(0, 50);

    await prisma.userEvent.createMany({
      data: batch.map((e) => {
        const safeMetadata = sanitizeMetadata(e.metadata);
        return {
          userId: authSession.userId,
          sessionId: e.sessionId || null,
          event: (e.event || "UNKNOWN").slice(0, 50),
          page: e.page ? e.page.slice(0, 200) : null,
          metadata: safeMetadata ? JSON.stringify(safeMetadata).slice(0, 2000) : null,
        };
      }),
    });

    return NextResponse.json({ success: true, count: batch.length });
  } catch (error) {
    console.error("Batch event tracking error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
