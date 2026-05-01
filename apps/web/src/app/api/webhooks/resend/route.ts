import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import {
  extractRecipientEmail,
  type ResendEvent,
  verifyResendSignature,
} from "@/lib/resend-webhook";
import { processUnsubscribe } from "@/lib/unsubscribe-actions";

export const runtime = "nodejs";

/**
 * Resend bounce/complaint webhook. Suppresses the recipient's marketing
 * + reminder emails when:
 *
 *   - email.bounced     — destination is dead or refusing mail
 *   - email.complained  — recipient marked us as spam
 *
 * Other event types (delivered, opened, clicked, etc.) are acknowledged
 * with 200 so Resend doesn't retry, but no DB write happens.
 *
 * Set RESEND_WEBHOOK_SECRET (whsec_…) in env. Resend will sign every
 * delivery with Svix-style headers; we reject anything we can't verify.
 */
// Resend bounce/complaint events carry a single message+recipient
// envelope; ~16KB is generous (the realistic ceiling is well under
// 4KB). Cap here so signature verification can't be made to hash a
// many-MB body.
const RESEND_WEBHOOK_MAX_BODY_BYTES = 16 * 1024;

export async function POST(request: NextRequest) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > RESEND_WEBHOOK_MAX_BODY_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }

  const secret = await getRuntimeConfigValue("RESEND_WEBHOOK_SECRET");
  if (!secret) {
    console.error("[RESEND] webhook called but RESEND_WEBHOOK_SECRET is not configured");
    return new NextResponse("Webhook not configured", { status: 503 });
  }

  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > RESEND_WEBHOOK_MAX_BODY_BYTES) {
    return new NextResponse("Payload too large", { status: 413 });
  }
  const verifyResult = verifyResendSignature(
    secret,
    {
      id: request.headers.get("svix-id"),
      timestamp: request.headers.get("svix-timestamp"),
      signature: request.headers.get("svix-signature"),
    },
    rawBody,
  );
  if (!verifyResult.valid) {
    return new NextResponse(`Invalid signature (${verifyResult.reason})`, { status: 401 });
  }

  let event: ResendEvent;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new NextResponse("Invalid JSON", { status: 400 });
  }

  const eventType = typeof event?.type === "string" ? event.type : "";
  if (eventType !== "email.bounced" && eventType !== "email.complained") {
    // Ack and ignore — Resend retries on non-2xx so we want a clean 200.
    return NextResponse.json({ ok: true, ignored: eventType || "unknown" });
  }

  const recipient = extractRecipientEmail(event);
  if (!recipient) {
    return NextResponse.json({ ok: true, ignored: "no recipient in payload" });
  }

  const user = await prisma.user.findUnique({
    where: { email: recipient },
    select: { id: true, deletedAt: true },
  });
  if (!user || user.deletedAt) {
    return NextResponse.json({ ok: true, ignored: "no active user" });
  }

  const source = eventType === "email.bounced" ? "bounce" : "complaint";
  await processUnsubscribe({ userId: user.id, kind: "all", source });

  console.info("[RESEND] suppressed marketing for user", {
    userIdHint: user.id.slice(0, 6),
    eventType,
  });

  return NextResponse.json({ ok: true, suppressed: true });
}
