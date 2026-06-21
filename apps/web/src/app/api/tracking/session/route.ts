import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveClientIpFromHeaders } from "@/lib/client-ip";
import { getConsentedTrackingSession } from "@/lib/tracking-consent";

function safeString(value: unknown, maxLength: number): string | null {
  if (typeof value !== "string") return null;
  const safe = value
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim()
    .slice(0, maxLength);
  return safe || null;
}

function safePageViews(value: unknown): number | undefined {
  const numeric = typeof value === "number" ? value : Number(value);
  if (!Number.isInteger(numeric) || numeric < 1) return undefined;
  return Math.min(numeric, 100_000);
}

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

    const body = await request.json().catch(() => ({}));
    const ua = request.headers.get("user-agent") || "unknown";
    const ip = resolveClientIpFromHeaders(request.headers);

    const session = await prisma.userSession.create({
      data: {
        userId: authSession.userId,
        ipAddress: ip,
        userAgent: safeString(ua, 500) || "unknown",
        browser: safeString(body.browser, 50),
        browserVersion: safeString(body.browserVersion, 20),
        os: safeString(body.os, 50),
        osVersion: safeString(body.osVersion, 20),
        device: safeString(body.device, 50),
        deviceType: safeString(body.deviceType, 20),
        platform: safeString(body.platform, 20) || "WEB",
        screenResolution: safeString(body.screenResolution, 20),
        language: safeString(body.language, 10),
        country: safeString(body.country, 50),
        city: safeString(body.city, 100),
        region: safeString(body.region, 100),
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

    const { sessionId: rawSessionId, pageViews } = await request.json().catch(() => ({}));
    const sessionId = safeString(rawSessionId, 30);
    if (!sessionId) return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });

    // SEC-011: Ownership check — only update own sessions
    const updated = await prisma.userSession.updateMany({
      where: { id: sessionId, userId: authSession.userId },
      data: {
        lastActivity: new Date(),
        pageViews: safePageViews(pageViews),
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
