/**
 * Connector runtime — the durable dispatch worker (I/O shell).
 *
 * Ties the pure @locateflow/connectors framework to this app's DB + token
 * vault. Enqueue writes self-contained ConnectorDispatch rows (the encrypted
 * CanonicalAddressChange travels on the row, so no AddressChangeEvent model is
 * required yet). The worker claims due rows, runs one attempt through the
 * connector with an allowlisted/breaker-wrapped client, then applies the
 * planner's decision (confirm / await / re-queue with backoff / fall back).
 *
 * All call sites are gated by FEATURE_API_CONNECTORS upstream; with no enabled
 * ConnectorConfig and no partner credentials this never does anything.
 */

import { randomUUID } from "crypto";
import {
  CircuitBreaker,
  createConnectorHttpClient,
  createConnectorRegistry,
  createRedactingLogger,
  planNextDispatch,
  runConnectorAttempt,
  uspsConnector,
  type AddressConnector,
  type CanonicalAddress,
  type CanonicalAddressChange,
  type ConnectorContext,
} from "@locateflow/connectors";
import { prisma } from "@/lib/db";
import { decrypt, encrypt } from "@/lib/shared-encryption";

/** The connectors LocateFlow ships. Adding one = add it here (+ its folder). */
export const connectorRegistry = createConnectorRegistry([uspsConnector]);

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
): ConnectorContext {
  return {
    accessToken,
    idempotencyKey,
    http: createConnectorHttpClient({
      allowedHosts: connector.manifest.allowedHosts,
      breaker: breakerFor(connector.manifest.key),
    }),
    logger: createRedactingLogger(),
  };
}

/**
 * Fan one address change out to the user's connected + enabled connectors by
 * writing QUEUED outbox rows. Returns how many were enqueued.
 */
export async function enqueueAddressChange(input: {
  userId: string;
  toAddressId: string;
  fromAddressId?: string | null;
}): Promise<{ changeRef: string; created: number }> {
  const [toAddress, fromAddress, user, consents, configs] = await Promise.all([
    prisma.address.findFirst({ where: { id: input.toAddressId, userId: input.userId, deletedAt: null } }),
    input.fromAddressId
      ? prisma.address.findFirst({ where: { id: input.fromAddressId, userId: input.userId } })
      : Promise.resolve(null),
    prisma.user.findUnique({ where: { id: input.userId }, select: { firstName: true, lastName: true } }),
    prisma.partnerConsent.findMany({ where: { userId: input.userId, status: "GRANTED" }, select: { id: true, connectorKey: true } }),
    prisma.connectorConfig.findMany({ where: { enabled: true }, select: { connectorKey: true } }),
  ]);
  if (!toAddress) throw new Error("ADDRESS_NOT_FOUND");

  const enabledKeys = new Set(configs.map((c) => c.connectorKey));
  const fullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "LocateFlow User";
  const changeRef = randomUUID();
  const base: Omit<CanonicalAddressChange, "fields"> = {
    eventId: changeRef,
    from: fromAddress ? toCanonicalAddress(fromAddress) : null,
    to: toCanonicalAddress(toAddress),
    fullName,
  };

  let created = 0;
  for (const consent of consents) {
    if (!enabledKeys.has(consent.connectorKey) || !connectorRegistry.has(consent.connectorKey)) continue;
    const payload: CanonicalAddressChange = { ...base, fields: {} };
    await prisma.connectorDispatch.create({
      data: {
        connectorKey: consent.connectorKey,
        userId: input.userId,
        consentId: consent.id,
        eventId: changeRef,
        idempotencyKey: `${changeRef}:${consent.connectorKey}`,
        status: "QUEUED",
        payloadEncrypted: encrypt(JSON.stringify(payload)),
      },
    });
    created += 1;
  }
  return { changeRef, created };
}

interface DispatchRow {
  id: string;
  connectorKey: string;
  consentId: string | null;
  idempotencyKey: string;
  attemptCount: number;
  payloadEncrypted: string | null;
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
    return "NEEDS_USER";
  }

  let accessToken: string | null = null;
  if (row.consentId) {
    const consent = await prisma.partnerConsent.findUnique({
      where: { id: row.consentId },
      select: { status: true, tokenEncrypted: true },
    });
    if (consent?.status === "GRANTED" && consent.tokenEncrypted) {
      accessToken = decrypt(consent.tokenEncrypted);
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
  return plan.status;
}

/** Claim and process due dispatches. One bad row never stops the batch. */
export async function runDueDispatches(limit = 25): Promise<{ processed: number }> {
  const now = new Date();
  const due = await prisma.connectorDispatch.findMany({
    where: { status: "QUEUED", OR: [{ nextRetryAt: null }, { nextRetryAt: { lte: now } }] },
    orderBy: { createdAt: "asc" },
    take: limit,
    select: {
      id: true,
      connectorKey: true,
      consentId: true,
      idempotencyKey: true,
      attemptCount: true,
      payloadEncrypted: true,
    },
  });

  let processed = 0;
  for (const row of due) {
    try {
      await runDispatchRow(row);
      processed += 1;
    } catch {
      // Leave the row QUEUED; the next run retries it. Never let one row
      // poison the whole batch.
    }
  }
  return { processed };
}
