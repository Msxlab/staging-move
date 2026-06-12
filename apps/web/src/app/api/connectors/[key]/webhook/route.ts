/**
 * Inbound partner webhook receiver — the async-confirm half of the connector
 * pipeline.
 *
 * `runDispatchRow` pushes the address change and, for a partner that confirms
 * asynchronously (`manifest.capabilities.asyncConfirm`), leaves the dispatch in
 * SUBMITTED. The partner later calls THIS endpoint to report the final outcome,
 * which advances the dispatch to CONFIRMED — or degrades it to the guided-update
 * fallback (NEEDS_USER) on a terminal failure, so the user is never stranded.
 *
 * Security model (mirrors the existing Stripe/Resend webhook handlers):
 *  - Master FEATURE_API_CONNECTORS gate → 404 when off (the surface is inert).
 *  - Per-connector HMAC-SHA256 over the raw body with CONNECTOR_<KEY>_WEBHOOK_SECRET;
 *    timing-safe compare. No secret configured → 503 (fail closed).
 *  - Replay protection via the shared processed-webhook-event ledger.
 *  - The connector's own `parseWebhook` extracts the echoed reference (our
 *    dispatch idempotencyKey) — the framework never trusts a connector to reach
 *    anything but its own dispatch row.
 */

export const runtime = "nodejs";

import { NextRequest, NextResponse } from "next/server";
import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { encrypt } from "@/lib/shared-encryption";
import { reserveWebhookEvent, releaseWebhookEvent } from "@/lib/webhook-idempotency";
import { connectorRegistry } from "@/lib/connector-registry";

const KEY_RE = /^[a-z][a-z0-9-]*$/;
const SIGNATURE_HEADER = "x-connector-signature";
// A confirm/fail for an already-settled dispatch is a no-op — never reopen a
// terminal row from an inbound webhook (defends against replays + late dupes).
const TERMINAL_STATUSES = new Set(["CONFIRMED", "FAILED"]);
const WEBHOOK_DISABLED_STAGES = new Set(["SHADOW", "RETIRED"]);
const WEBHOOK_DISABLED_CIRCUITS = new Set(["OPEN", "DISABLED"]);

// Webhook addressability resolves from the SINGLE app connector registry (the
// same one outbound dispatch uses) — no second list to keep in sync. A connector
// without parseWebhook (e.g. USPS, which confirms synchronously via read-back) is
// simply not addressable here and returns 404.

async function isApiConnectorsEnabled(): Promise<boolean> {
  const value = (await getRuntimeConfigValue("FEATURE_API_CONNECTORS")) ?? process.env.FEATURE_API_CONNECTORS ?? "";
  return value === "true" || value === "1";
}

async function connectorWebhookSecret(key: string): Promise<string | null> {
  const name = `CONNECTOR_${key.toUpperCase().replace(/-/g, "_")}_WEBHOOK_SECRET`;
  const value = (await getRuntimeConfigValue(name)) ?? process.env[name] ?? "";
  return value.trim() ? value : null;
}

function signatureValid(rawBody: string, secret: string, provided: string | null): boolean {
  if (!provided) return false;
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  // timingSafeEqual throws on length mismatch — guard first so a wrong-length
  // forgery is rejected without leaking timing.
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  if (!KEY_RE.test(key)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Inert unless the master flag is on — same posture as the rest of the surface.
  if (!(await isApiConnectorsEnabled())) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Only a registered connector that actually does async confirmation has a
  // receiver; everything else looks like it doesn't exist.
  const connector = connectorRegistry.get(key);
  if (!connector?.parseWebhook) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  // Honor the same ops control plane as outbound dispatch. During an incident,
  // disabling a connector or opening its circuit must freeze inbound writes too;
  // otherwise a signed webhook could still mutate dispatch state after the kill
  // switch was pulled.
  const control = await prisma.connectorConfig.findUnique({
    where: { connectorKey: key },
    select: { enabled: true, stage: true, circuitState: true },
  });
  if (
    !control?.enabled ||
    WEBHOOK_DISABLED_STAGES.has(control.stage) ||
    WEBHOOK_DISABLED_CIRCUITS.has(control.circuitState)
  ) {
    return NextResponse.json({ error: "Connector disabled" }, { status: 503 });
  }

  // No secret => we cannot authenticate the caller => refuse (never trust an
  // unsigned inbound write that flips a dispatch to CONFIRMED).
  const secret = await connectorWebhookSecret(key);
  if (!secret) {
    return NextResponse.json({ error: "Webhook not configured" }, { status: 503 });
  }

  const rawBody = await req.text();
  if (!signatureValid(rawBody, secret, req.headers.get(SIGNATURE_HEADER))) {
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  // Validation that 400s with NO side-effect runs BEFORE we reserve the event,
  // so a malformed-but-signed body never consumes an idempotency marker.
  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const parsed = connector.parseWebhook(payload);
  if (!parsed?.ref) {
    return NextResponse.json({ error: "Unrecognized payload" }, { status: 400 });
  }

  // Atomically RESERVE on the verified body BEFORE any dispatch mutation (mirrors
  // the Stripe/App Store/Play Store webhooks). The previous hasProcessedWebhookEvent
  // check-then-act left a window where two concurrent deliveries both passed the
  // read and both advanced the dispatch; the unique-key reservation closes it — a
  // duplicate loses the create race and gets "duplicate" here. The winner owns the
  // marker and releases it only if processing throws, so a partner's legitimate
  // retry can still reprocess instead of seeing a duplicate no-op.
  const eventId = `connector:${key}:${createHash("sha256").update(rawBody).digest("hex")}`;
  const reservation = await reserveWebhookEvent(eventId, `connector:${key}`);
  if (reservation === "duplicate") {
    return NextResponse.json({ ok: true, duplicate: true });
  }

  try {
    const dispatch = await prisma.connectorDispatch.findUnique({ where: { idempotencyKey: parsed.ref } });
    // Unknown / wrong-connector ref: ack so the partner stops retrying, but touch
    // nothing. (A signed caller for this connector simply referenced a dispatch we
    // don't have — e.g. one already pruned.) The reservation stays: it's fully handled.
    if (!dispatch || dispatch.connectorKey !== key) {
      return NextResponse.json({ ok: true, matched: false });
    }

    if (!TERMINAL_STATUSES.has(dispatch.status)) {
      const { outcome, errorCode, confirmationNumber } = parsed.result;
      if (outcome === "CONFIRMED") {
        await prisma.connectorDispatch.update({
          where: { id: dispatch.id },
          data: {
            status: "CONFIRMED",
            confirmedAt: new Date(),
            lastErrorCode: null,
            ...(confirmationNumber ? { confirmationEncrypted: encrypt(confirmationNumber) } : {}),
          },
        });
      } else if (outcome === "FAILED" || outcome === "NEEDS_USER") {
        // Async failure → guided-update fallback. The golden rule holds: a connector
        // failure degrades to manual, it never blocks (or silently drops) the move.
        await prisma.connectorDispatch.update({
          where: { id: dispatch.id },
          data: { status: "NEEDS_USER", lastErrorCode: errorCode ?? "UNKNOWN" },
        });
      }
      // outcome === "SUBMITTED" → still pending; leave the row untouched.
    }

    return NextResponse.json({ ok: true });
  } catch {
    // Processing failed AFTER reserving — release the marker so the partner's
    // retry can reprocess instead of getting a "duplicate" no-op and silently
    // dropping the confirmation. Return 500 so the partner does retry.
    await releaseWebhookEvent(eventId, `connector:${key}`).catch(() => {});
    return NextResponse.json({ error: "Processing failed" }, { status: 500 });
  }
}
