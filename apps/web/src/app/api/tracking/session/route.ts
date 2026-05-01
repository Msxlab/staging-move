import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getConsentedTrackingSession } from "@/lib/tracking-consent";

export async function POST(request: NextRequest) {
  try {
    const tracking = await getConsentedTrackingSession(request);
    if (tracking.disabled) {
      return NextResponse.json({ sessionId: null, disabled: true });
    }

    const authSession = tracking.authSession;
    if (!authSession) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await request.json();
    const ua = request.headers.get("user-agent") || "unknown";
    const ip = (request.headers.get("x-forwarded-for") || "unknown").split(",")[0].trim();

    const session = await prisma.userSession.create({
      data: {
        userId: authSession.userId,
        ipAddress: ip,
        userAgent: ua,
        browser: body.browser || null,
        browserVersion: body.browserVersion || null,
        os: body.os || null,
        osVersion: body.osVersion || null,
        device: body.device || null,
        deviceType: body.deviceType || null,
        platform: body.platform || "WEB",
        screenResolution: body.screenResolution || null,
        language: body.language || null,
        country: body.country || null,
        city: body.city || null,
        region: body.region || null,
      },
    });

    return NextResponse.json({ sessionId: session.id });
  } catch (error) {
    console.error("Tracking session error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const tracking = await getConsentedTrackingSession(request);
    if (tracking.disabled) {
      return NextResponse.json({ success: true, disabled: true });
    }

    const authSession = tracking.authSession;
    if (!authSession) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { sessionId, pageViews } = await request.json();
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    // SEC-011: Ownership check — only update own sessions
    const updated = await prisma.userSession.updateMany({
      where: { id: sessionId, userId: authSession.userId },
      data: {
        lastActivity: new Date(),
        pageViews: pageViews || undefined,
      },
    });

    if (updated.count === 0) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Tracking update error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
