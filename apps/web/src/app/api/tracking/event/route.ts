import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/auth";
import { COOKIE_CONSENT_COOKIE_NAME, parseCookieConsentStatus } from "@/lib/consent";

function hasRequestAnalyticsConsent(request: NextRequest) {
  return parseCookieConsentStatus(request.cookies.get(COOKIE_CONSENT_COOKIE_NAME)?.value) === "accepted";
}

// POST /api/tracking/event — track a single user event
export async function POST(request: NextRequest) {
  try {
    if (!hasRequestAnalyticsConsent(request)) {
      return NextResponse.json({ success: true, disabled: true });
    }

    const authSession = await getUserSession();
    if (!authSession) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const { event, page, sessionId, metadata } = body;

    if (!event || typeof event !== "string") {
      return NextResponse.json({ error: "event is required" }, { status: 400 });
    }

    await prisma.userEvent.create({
      data: {
        userId: authSession.userId,
        sessionId: sessionId || null,
        event: event.slice(0, 50),
        page: page ? page.slice(0, 200) : null,
        metadata: metadata ? JSON.stringify(metadata).slice(0, 2000) : null,
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
    if (!hasRequestAnalyticsConsent(request)) {
      return NextResponse.json({ success: true, count: 0, disabled: true });
    }

    const authSession = await getUserSession();
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
      data: batch.map((e) => ({
        userId: authSession.userId,
        sessionId: e.sessionId || null,
        event: (e.event || "UNKNOWN").slice(0, 50),
        page: e.page ? e.page.slice(0, 200) : null,
        metadata: e.metadata ? JSON.stringify(e.metadata).slice(0, 2000) : null,
      })),
    });

    return NextResponse.json({ success: true, count: batch.length });
  } catch (error) {
    console.error("Batch event tracking error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
