import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { getConsentedTrackingSession } from "@/lib/tracking-consent";
import {
  resolveUserEventSamplingConfig,
  shouldPersistUserEvent,
  USER_EVENT_SAMPLING_ENABLED_KEY,
  USER_EVENT_SAMPLING_RATE_KEY,
} from "@/lib/user-event-sampling";
import { isPhase1AnalyticsEvent, sanitizePhase1EventMetadata } from "@locateflow/shared";

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

function sanitizeEventMetadata(event: string, metadata: unknown) {
  if (isPhase1AnalyticsEvent(event)) {
    return sanitizeMetadata(sanitizePhase1EventMetadata(event, metadata));
  }
  return sanitizeMetadata(metadata);
}

async function getUserEventSamplingConfig() {
  const [enabled, rate] = await Promise.all([
    getRuntimeConfigValue(USER_EVENT_SAMPLING_ENABLED_KEY),
    getRuntimeConfigValue(USER_EVENT_SAMPLING_RATE_KEY),
  ]);
  return resolveUserEventSamplingConfig({ enabled, rate });
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

    const eventName = event.slice(0, 50);
    const samplingConfig = await getUserEventSamplingConfig();
    if (!shouldPersistUserEvent(eventName, samplingConfig)) {
      return NextResponse.json({ success: true, sampled: true });
    }

    const safeMetadata = sanitizeEventMetadata(eventName, metadata);

    await prisma.userEvent.create({
      data: {
        userId: authSession.userId,
        sessionId: sessionId || null,
        event: eventName,
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

    const samplingConfig = await getUserEventSamplingConfig();
    let sampled = 0;
    const data = batch.flatMap((e) => {
      const eventName = (e.event || "UNKNOWN").slice(0, 50);
      if (!shouldPersistUserEvent(eventName, samplingConfig)) {
        sampled += 1;
        return [];
      }
      const safeMetadata = sanitizeEventMetadata(eventName, e.metadata);
      return [{
        userId: authSession.userId,
        sessionId: e.sessionId || null,
        event: eventName,
        page: e.page ? e.page.slice(0, 200) : null,
        metadata: safeMetadata ? JSON.stringify(safeMetadata).slice(0, 2000) : null,
      }];
    });

    if (data.length > 0) {
      await prisma.userEvent.createMany({ data });
    }

    return NextResponse.json({ success: true, count: data.length, sampled });
  } catch (error) {
    console.error("Batch event tracking error:", error);
    return NextResponse.json({ error: "Failed" }, { status: 500 });
  }
}
