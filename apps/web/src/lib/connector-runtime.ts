/**
 * Connector runtime — the durable dispatch worker (I/O shell).
 *
 * Ties the pure @locateflow/connectors framework to this app's DB + token
 * vault. Enqueue creates one AddressChangeEvent and self-contained
 * ConnectorDispatch rows (the encrypted CanonicalAddressChange travels on each
 * row). The worker claims due rows, runs one attempt through the
 * connector with an allowlisted/breaker-wrapped client, then applies the
 * planner's decision (confirm / await / re-queue with backoff / fall back).
 *
 * All call sites are gated by FEATURE_API_CONNECTORS upstream; with no enabled
 * ConnectorConfig and no partner credentials this never does anything.
 */

import { createHash, randomUUID } from "crypto";
import {
  CircuitBreaker,
  createConnectorHttpClient,
  createRedactingLogger,
  planNextDispatch,
  resolveConnectorMode,
  runConnectorAttempt,
  type AddressConnector,
  type CanonicalAddress,
  type CanonicalAddressChange,
  type ConnectorContext,
} from "@locateflow/connectors";
import { connectorRegistry } from "@/lib/connector-registry";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/shared-encryption";
import { refreshConsentAccessToken } from "@/lib/connector-oauth";
import { createInAppNotification } from "@/lib/in-app-notifications";
import { sendConnectorActionNeededEmail } from "@/lib/email-service";
import { isWebNotificationEnabled } from "@/lib/notification-preferences";

// Per-connector breakers live for the process lifetime so a failing partner
// trips its bulkhead across dispatches, not just within one.
const breakers = new Map<string, CircuitBreaker>();
function breakerFor(key: string): CircuitBreaker {
  const found = breakers.get(key);
  if (found) return found;
  const created = new CircuitBreaker();
  breakers.set(key, created);
  return created;
}

interface AddressRow {
  street: string;
  street2: string | null;
  city: string;
  state: string;
  zip: string;
  country: string;
}

/** Map a DB Address row to the connector-agnostic canonical shape. */
export function toCanonicalAddress(a: AddressRow): CanonicalAddress {
  return {
    street1: a.street,
    street2: a.street2,
    city: a.city,
    state: a.state,
    zip: a.zip,
    country: a.country === "USA" ? "US" : a.country,
  };
}

function buildContext(
  connector: AddressConnector,
  accessToken: string | null,
  idempotencyKey: string,
  dryRun = false,
): ConnectorContext {
  return {
    accessToken,
    idempotencyKey,
    dryRun,
    http: createConnectorHttpClient({
      allowedHosts: connector.manifest.allowedHosts,
      breaker: breakerFor(connector.manifest.key),
    }),
    logger: createRedactingLogger(),
  };
}

interface ConnectorControl {
  connectorKey: string;
  enabled: boolean;
  rolloutPercent: number;
  circuitState: string;
  stage: string;
}

const LIVE_DISPATCH_STATUSES = ["QUEUED", "DISPATCHING", "SUBMITTED", "CONFIRMED"] as const;

/** Deterministic 0..99 bucket for gradual rollout (stable per user+connector). */
function rolloutBucket(userId: string, connectorKey: string): number {
  return createHash("sha256").update(`${userId}:${connectorKey}`).digest().readUInt16BE(0) % 100;
}

type DispatchPlan = "LIVE" | "SHADOW" | "SKIP";

/**
 * What the admin control plane currently lets this connector do for this user:
 *  - LIVE   : real server-side push (GA, or ROLLOUT within the rollout %).
 *  - SHADOW : dry-run only (stage SHADOW) — runs the full pipeline, never pushes.
 *  - SKIP   : circuit open/disabled, retired, or outside the rollout bucket.
 * The `enabled` kill switch is already applied by the query filter upstream.
 */
function resolveDispatchPlan(config: ConnectorControl, userId: string): DispatchPlan {
  if (config.circuitState === "OPEN" || config.circuitState === "DISABLED") return "SKIP";
  if (config.stage === "RETIRED") return "SKIP";
  if (config.stage === "SHADOW") return "SHADOW";
  if (config.stage === "ROLLOUT" && rolloutBucket(userId, config.connectorKey) >= config.rolloutPercent) return "SKIP";
  return "LIVE"; // GA, or ROLLOUT within %, with a CLOSED/HALF_OPEN circuit
}

/**
 * Defense-in-depth mode gate: only an API_SYNC connector — one with a signed
 * PRODUCTION agreement AND configured credentials (resolveConnectorMode, the
 * single source of truth) — ever gets a server-side dispatch. GUIDED_UPDATE /
 * COMING_SOON connectors are never auto-pushed; the user handles those through
 * the guided flow. The UI already only offers Connect for API_SYNC, so this
 * guards against a stale/orphaned consent slipping a doomed push through.
 * Exported for unit testing.
 */
export async function isApiSyncConnector(
  connectorKey: string,
  config: { enabled: boolean; stage: string },
): Promise<boolean> {
  const adapter = connectorRegistry.get(connectorKey);
  if (!adapter) return false;
  const k = connectorKey.toUpperCase().replace(/-/g, "_");
  const rc = async (name: string) => (await getRuntimeConfigValue(name)) ?? process.env[name] ?? "";
  const [agreementRaw, clientId, clientSecret, authorizeUrl, tokenUrl] = await Promise.all([
    rc(`CONNECTOR_${k}_AGREEMENT_STATUS`),
    rc(`CONNECTOR_${k}_OAUTH_CLIENT_ID`),
    rc(`CONNECTOR_${k}_OAUTH_CLIENT_SECRET`),
    rc(`CONNECTOR_${k}_OAUTH_AUTHORIZE_URL`),
    rc(`CONNECTOR_${k}_OAUTH_TOKEN_URL`),
  ]);
  const agreementStatus = agreementRaw === "PRODUCTION" || agreementRaw === "SANDBOX" ? agreementRaw : "NONE";
  const credentialsPresent = Boolean(
    clientId &&
      clientSecret &&
      isAllowedConnectorUrl(authorizeUrl, adapter.manifest.allowedHosts) &&
      isAllowedConnectorUrl(tokenUrl, adapter.manifest.allowedHosts),
  );
  return (
    resolveConnectorMode({
      addressUpdatePush: adapter.manifest.capabilities.addressUpdatePush,
      agreementStatus,
      credentialsPresent,
      enabled: config.enabled,
      stage: config.stage,
    }).mode === "API_SYNC"
  );
}

function isAllowedConnectorUrl(rawUrl: string, allowedHosts: readonly string[]): boolean {
  try {
    const url = new URL(rawUrl);
    return url.protocol === "https:" && allowedHosts.includes(url.host.toLowerCase());
  } catch {
    return false;
  }
}

/**
 * Fan one address change out to the user's connected + enabled connectors by
 * writing QUEUED outbox rows. Returns how many were enqueued.
 */
export async function enqueueAddressChange(input: {
  userId: string;
  toAddressId: string;
  fromAddressId?: string | null;
  workspaceId?: string | null;
}): Promise<{ changeRef: string; created: number }> {
  const addressScope = input.workspaceId ? { workspaceId: input.workspaceId } : {};
  const [toAddress, fromAddress, user, consents, configs] = await Promise.all([
    prisma.address.findFirst({ where: { id: input.toAddressId, userId: input.userId, deletedAt: null, ...addressScope } }),
    input.fromAddressId
      ? prisma.address.findFirst({ where: { id: input.fromAddressId, userId: input.userId, deletedAt: null, ...addressScope } })
      : Promise.resolve(null),
    prisma.user.findUnique({ where: { id: input.userId }, select: { firstName: true, lastName: true } }),
    prisma.partnerConsent.findMany({ where: { userId: input.userId, status: "GRANTED" }, select: { id: true, connectorKey: true } }),
    prisma.connectorConfig.findMany({
      where: { enabled: true },
      select: { connectorKey: true, enabled: true, rolloutPercent: true, circuitState: true, stage: true },
    }),
  ]);
  if (!toAddress) throw new Error("ADDRESS_NOT_FOUND");

  const configByKey = new Map<string, ConnectorControl>(configs.map((c) => [c.connectorKey, c]));
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "LocateFlow User";
  const changeRef = randomUUID();

  const base: Omit<CanonicalAddressChange, "fields"> = {
    eventId: changeRef,
    from: fromAddress ? toCanonicalAddress(fromAddress) : null,
    to: toCanonicalAddress(toAddress),
    fullName,
  };

  const dispatchesToCreate: Array<{
    connectorKey: string;
    consentId: string;
    isShadow: boolean;
    payload: CanonicalAddressChange;
  }> = [];
  let liveCreated = 0;
  for (const consent of consents) {
    const config = configByKey.get(consent.connectorKey);
    if (!config || !connectorRegistry.has(consent.connectorKey)) continue;
    const plan = resolveDispatchPlan(config, input.userId);
    if (plan === "SKIP") continue;
    const adapter = connectorRegistry.get(consent.connectorKey);
    // LIVE = real push: defense-in-depth — only when truly API_SYNC (signed
    // agreement + credentials). SHADOW = dry-run: only push-capable connectors
    // are worth shadowing, and since we never actually push, no agreement or
    // credentials are required.
    if (plan === "LIVE") {
      if (!(await isApiSyncConnector(consent.connectorKey, { enabled: config.enabled, stage: config.stage }))) continue;
    } else if (!adapter?.manifest.capabilities.addressUpdatePush) {
      continue; // shadowing a non-push connector is meaningless
    }
    // Skip a connector that needs an origin when we have none (e.g. a primary-
    // address EDIT auto-sync with no `from`) — don't file a doomed null-origin
    // COA the partner would reject. A real move (from+to) still dispatches.
    if (base.from === null && adapter?.manifest.requiresOrigin) continue;
    // Enforce the manifest's per-user-per-day cap (fraud control for COA-style
    // filings, e.g. USPS perUserPerDay:2) — declared but previously unenforced.
    // Count live/successful filings in the last 24h; skip a connector at its cap.
    if (plan === "LIVE") {
      const rateLimit = connectorRegistry.get(consent.connectorKey)?.manifest.rateLimit;
      const perConnectorPerMinute = rateLimit?.perConnectorPerMinute;
      if (perConnectorPerMinute && perConnectorPerMinute > 0) {
        const since = new Date(Date.now() - 60 * 1000);
        const recent = await prisma.connectorDispatch.count({
          where: {
            connectorKey: consent.connectorKey,
            createdAt: { gte: since },
            status: { in: [...LIVE_DISPATCH_STATUSES] },
            isShadow: false,
          },
        });
        if (recent >= perConnectorPerMinute) continue;
      }
      const perUserPerDay = rateLimit?.perUserPerDay;
      if (perUserPerDay && perUserPerDay > 0) {
        const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const recent = await prisma.connectorDispatch.count({
          where: {
            userId: input.userId,
            connectorKey: consent.connectorKey,
            createdAt: { gte: since },
            status: { in: [...LIVE_DISPATCH_STATUSES] },
            isShadow: false,
          },
        });
        if (recent >= perUserPerDay) continue;
      }
    }
    const payload: CanonicalAddressChange = { ...base, fields: {} };
    const isShadow = plan === "SHADOW";
    dispatchesToCreate.push({ connectorKey: consent.connectorKey, consentId: consent.id, isShadow, payload });
    if (!isShadow) liveCreated += 1;
  }

  await prisma.$transaction(async (tx) => {
    // The canonical "user moved" event. Created once; each dispatch below links
    // back to it via addressChangeEventId. Loose refs keep it decoupled from
    // Address; the canonical values still travel encrypted on every dispatch row.
    const event = await tx.addressChangeEvent.create({
      data: {
        userId: input.userId,
        changeRef,
        fromAddressId: fromAddress?.id ?? null,
        toAddressId: toAddress.id,
        workspaceId: input.workspaceId ?? null,
        fullName,
        status: "PENDING",
      },
    });

    for (const dispatch of dispatchesToCreate) {
      await tx.connectorDispatch.create({
        data: {
          connectorKey: dispatch.connectorKey,
          userId: input.userId,
          consentId: dispatch.consentId,
          eventId: changeRef,
          addressChangeEventId: event.id,
          idempotencyKey: `${changeRef}:${dispatch.connectorKey}`,
          status: "QUEUED",
          isShadow: dispatch.isShadow,
          payloadEncrypted: encrypt(JSON.stringify(dispatch.payload)),
        },
      });
    }

    // User-facing dispatchCount counts real pushes only. Shadow rows are kept
    // for internal validation but do not imply that a partner received a sync.
    await tx.addressChangeEvent.update({
      where: { id: event.id },
      data: { status: liveCreated > 0 ? "DISPATCHED" : "NO_TARGETS", dispatchCount: liveCreated },
    });
  });

  return { changeRef, created: liveCreated };
}

interface DispatchRow {
  id: string;
  connectorKey: string;
  userId: string;
  consentId: string | null;
  idempotencyKey: string;
  attemptCount: number;
  payloadEncrypted: string | null;
  isShadow?: boolean;
}

/** Tell the user (in-app + email) that a sync needs their attention. Best-effort. */
async function notifyNeedsUser(userId: string, connectorKey: string, dispatchId: string): Promise<void> {
  const dedupeKey = `connector-needs-user:${dispatchId}`;
  try {
    await createInAppNotification({
      userId,
      type: "CONNECTOR_ACTION_NEEDED",
      title: "Action needed to sync your address",
      body: `We couldn't finish updating your address with ${connectorKey.toUpperCase()}. Open Connections to reconnect or complete it.`,
      href: "/settings/connections",
      dedupeKey,
    });
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { email: true, firstName: true } });
    if (user?.email) {
      // The in-app notification above is always written (it's the feed record);
      // the email respects the user's "Connection action needed" preference.
      const prefs = await prisma.notificationPreference.findMany({
        where: { userId },
        select: { channel: true, type: true, enabled: true, frequency: true },
      });
      if (isWebNotificationEnabled(prefs, "connectorActionNeeded")) {
        await sendConnectorActionNeededEmail({ userEmail: user.email, userName: user.firstName, connectorKey, dedupeKey });
      }
    }
  } catch {
    // Best-effort: a notification failure must never fail the dispatch.
  }
}

/** Run one dispatch row through its connector and persist the planned status. */
export async function runDispatchRow(row: DispatchRow): Promise<string> {
  const connector = connectorRegistry.get(row.connectorKey);

  let payload: CanonicalAddressChange | null = null;
  if (row.payloadEncrypted) {
    try {
      payload = JSON.parse(decrypt(row.payloadEncrypted)) as CanonicalAddressChange;
    } catch {
      payload = null;
    }
  }

  // Missing connector or unreadable payload → hand to the manual fallback.
  if (!connector || !payload) {
    await prisma.connectorDispatch.update({
      where: { id: row.id },
      data: { status: "NEEDS_USER", lastErrorCode: "NOT_SUPPORTED" },
    });
    await notifyNeedsUser(row.userId, row.connectorKey, row.id);
    return "NEEDS_USER";
  }

  // Honor the admin kill switch / circuit even for already-claimed rows: if the
  // connector was disabled or its circuit opened after enqueue, defer (back to
  // QUEUED) rather than pushing.
  const control = await prisma.connectorConfig.findUnique({
    where: { connectorKey: row.connectorKey },
    select: { enabled: true, circuitState: true, stage: true },
  });
  if (!control?.enabled || control.circuitState === "OPEN" || control.circuitState === "DISABLED") {
    await prisma.connectorDispatch.update({
      where: { id: row.id },
      data: { status: "QUEUED", nextRetryAt: new Date(Date.now() + 5 * 60_000) },
    });
    return "QUEUED";
  }
  // SHADOW dry-run: a row created as shadow stays dry-run even if the connector
  // is promoted later, and a live queued row is demoted if the operator rolls
  // the connector back to SHADOW before processing. No partner push happens.
  if (row.isShadow || control.stage === "SHADOW") {
    const ctx = buildContext(connector, null, row.idempotencyKey, true);
    const result = await runConnectorAttempt(connector, payload, ctx);
    const status = result.outcome === "FAILED" ? "FAILED" : "CONFIRMED";
    await prisma.connectorDispatch.update({
      where: { id: row.id },
      data: {
        status,
        isShadow: true,
        attemptCount: row.attemptCount + 1,
        dispatchedAt: new Date(),
        confirmedAt: status === "CONFIRMED" ? new Date() : undefined,
        lastErrorCode: result.errorCode ?? null,
        resultMetadataJson: JSON.stringify({ ...(result.metadata ?? {}), shadow: true }),
      },
    });
    return status;
  }
  if (!(await isApiSyncConnector(row.connectorKey, { enabled: control.enabled, stage: control.stage }))) {
    await prisma.connectorDispatch.update({
      where: { id: row.id },
      data: {
        status: "NEEDS_USER",
        lastErrorCode: "NOT_SUPPORTED",
        resultMetadataJson: JSON.stringify({ reason: "MODE_NOT_API_SYNC" }),
      },
    });
    await notifyNeedsUser(row.userId, row.connectorKey, row.id);
    return "NEEDS_USER";
  }

  let accessToken: string | null = null;
  if (!row.consentId && connector.manifest.auth.type !== "NONE") {
    await prisma.connectorDispatch.update({
      where: { id: row.id },
      data: { status: "NEEDS_USER", lastErrorCode: "CONSENT_REQUIRED" },
    });
    await notifyNeedsUser(row.userId, row.connectorKey, row.id);
    return "NEEDS_USER";
  }
  if (row.consentId) {
    const consent = await prisma.partnerConsent.findUnique({
      where: { id: row.consentId },
      select: { status: true, tokenEncrypted: true, refreshTokenEncrypted: true, tokenExpiresAt: true },
    });
    if (!consent || consent.status !== "GRANTED") {
      await prisma.connectorDispatch.update({
        where: { id: row.id },
        data: { status: "NEEDS_USER", lastErrorCode: "REVOKED" },
      });
      await notifyNeedsUser(row.userId, row.connectorKey, row.id);
      return "NEEDS_USER";
    }
    if (consent?.status === "GRANTED") {
      const expired = consent.tokenExpiresAt ? consent.tokenExpiresAt.getTime() <= Date.now() : false;
      if (expired && consent.refreshTokenEncrypted) {
        // Access token expired → mint a fresh one in-band. On failure the attempt
        // proceeds with a null token → AUTH_EXPIRED → NEEDS_USER (not a silent skip).
        accessToken = await refreshConsentAccessToken(row.consentId, row.connectorKey, consent.refreshTokenEncrypted);
      } else if (consent.tokenEncrypted) {
        try {
          accessToken = decrypt(consent.tokenEncrypted);
        } catch {
          accessToken = null; // corrupt/rotated-key ciphertext → fall back, don't crash the worker
        }
      }
    }
  }
  if (row.consentId) {
    const stillGranted = await prisma.partnerConsent.findUnique({
      where: { id: row.consentId },
      select: { status: true },
    });
    if (!stillGranted || stillGranted.status !== "GRANTED") {
      await prisma.connectorDispatch.update({
        where: { id: row.id },
        data: { status: "NEEDS_USER", lastErrorCode: "REVOKED" },
      });
      await notifyNeedsUser(row.userId, row.connectorKey, row.id);
      return "NEEDS_USER";
    }
  }

  await prisma.connectorDispatch.update({
    where: { id: row.id },
    data: { status: "DISPATCHING", dispatchedAt: new Date() },
  });

  const ctx = buildContext(connector, accessToken, row.idempotencyKey);
  const result = await runConnectorAttempt(connector, payload, ctx);
  const plan = planNextDispatch({ attemptCount: row.attemptCount, result });

  await prisma.connectorDispatch.update({
    where: { id: row.id },
    data: {
      status: plan.status,
      attemptCount: plan.attemptCount,
      lastErrorCode: result.errorCode ?? null,
      nextRetryAt: plan.retryInMs !== null ? new Date(Date.now() + plan.retryInMs) : null,
      confirmedAt: plan.status === "CONFIRMED" ? new Date() : undefined,
      confirmationEncrypted: result.confirmationNumber ? encrypt(result.confirmationNumber) : undefined,
      resultMetadataJson: result.metadata ? JSON.stringify(result.metadata) : undefined,
    },
  });
  if (plan.status === "NEEDS_USER") {
    await notifyNeedsUser(row.userId, row.connectorKey, row.id);
  }
  return plan.status;
}

/** Claim and process due dispatches. One bad row never stops the batch. */
export async function runDueDispatches(limit = 25): Promise<{ processed: number; failed: number }> {
  const now = new Date();

  // Recovery sweep for rows stranded in DISPATCHING (worker crashed / transient
  // DB error after the atomic claim but before a terminal write). We do NOT
  // blindly re-queue → re-send: a fraud-controlled COA filing may already have
  // reached the partner, so re-sending could double-file. Instead flip a stale
  // row to NEEDS_USER and notify the owner, so they retry deliberately. (A
  // per-connector verify-then-resume sweep is the fuller solution.)
  const STALE_DISPATCHING_MS = 15 * 60 * 1000;
  const stale = await prisma.connectorDispatch.findMany({
    where: { status: "DISPATCHING", isShadow: false, dispatchedAt: { lt: new Date(now.getTime() - STALE_DISPATCHING_MS) } },
    select: { id: true, userId: true, connectorKey: true },
    take: 100,
  });
  for (const s of stale) {
    const flipped = await prisma.connectorDispatch.updateMany({
      where: { id: s.id, status: "DISPATCHING" },
      data: { status: "NEEDS_USER" },
    });
    if (flipped.count > 0) await notifyNeedsUser(s.userId, s.connectorKey, s.id).catch(() => {});
  }

  // Recovery sweep for rows stuck in SUBMITTED past a generous window — a sync
  // read-back stayed pending (e.g. a USPS mailed-letter validation never flipped
  // to ACTIVE) or an async confirmation webhook never arrived. We never re-send
  // (the filing already reached the partner); we surface it so the user verifies
  // it deliberately. The window is long so a normally-pending validation is not
  // flagged early.
  const STALE_SUBMITTED_MS = 7 * 24 * 60 * 60 * 1000;
  const stuck = await prisma.connectorDispatch.findMany({
    where: { status: "SUBMITTED", isShadow: false, dispatchedAt: { lt: new Date(now.getTime() - STALE_SUBMITTED_MS) } },
    select: { id: true, userId: true, connectorKey: true },
    take: 100,
  });
  for (const s of stuck) {
    const flipped = await prisma.connectorDispatch.updateMany({
      where: { id: s.id, status: "SUBMITTED" },
      data: { status: "NEEDS_USER", resultMetadataJson: JSON.stringify({ reason: "CONFIRMATION_TIMEOUT" }) },
    });
    if (flipped.count > 0) await notifyNeedsUser(s.userId, s.connectorKey, s.id).catch(() => {});
  }

  const due = await prisma.connectorDispatch.findMany({
    where: { status: "QUEUED", OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      connectorKey: true,
      userId: true,
      consentId: true,
      idempotencyKey: true,
      attemptCount: true,
      payloadEncrypted: true,
      isShadow: true,
    },
  });

  let processed = 0;
  let failed = 0;
  for (const row of due) {
    try {
      // Atomic claim: only the worker that flips QUEUED→DISPATCHING owns this
      // row. A concurrent worker (cron + manual trigger) gets count 0 and skips
      // it, so a partner is never sent the same change twice.
      const claim = await prisma.connectorDispatch.updateMany({
        where: { id: row.id, status: "QUEUED" },
        data: { status: "DISPATCHING", dispatchedAt: new Date() },
      });
      if (claim.count === 0) continue;
      await runDispatchRow(row);
      processed += 1;
    } catch (err) {
      // Don't let one row poison the batch — it's left mid-flight (DISPATCHING)
      // and the recovery sweep above reclaims it on a later run. Count + log so
      // an operator can tell a healthy run from one where every row threw.
      failed += 1;
      console.error(`[connector-dispatch] row ${row.id} failed:`, (err as Error)?.message ?? err);
    }
  }
  return { processed, failed };
}
