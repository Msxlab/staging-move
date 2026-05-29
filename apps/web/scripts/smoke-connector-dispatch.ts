/**
 * Live end-to-end smoke for the connector dispatch engine.
 *
 * Seeds a throwaway user + two QUEUED ConnectorDispatch rows, runs the real
 * engine (runConnectorAttempt → planNextDispatch) against the live DB, prints
 * the outcomes, then cleans up. Demonstrates BOTH paths through one run:
 *   - demo connector → CONFIRMED (happy path)
 *   - usps connector with no token → AUTH_EXPIRED → NEEDS_USER (graceful fallback)
 *
 * Run: set DATABASE_URL, then
 *   pnpm --filter @locateflow/web exec tsx scripts/smoke-connector-dispatch.ts
 */

import { dbUnsafe as db } from "@locateflow/db";
import {
  CircuitBreaker,
  createConnectorHttpClient,
  createConnectorRegistry,
  createRedactingLogger,
  planNextDispatch,
  runConnectorAttempt,
  uspsConnector,
  type AddressConnector,
  type CanonicalAddressChange,
  type ConnectorContext,
} from "@locateflow/connectors";

const demoConnector: AddressConnector = {
  manifest: {
    key: "demo",
    version: "1.0.0",
    displayName: "Demo Connector",
    auth: { type: "API_KEY" },
    allowedHosts: ["api.demo.test"],
    requiredFields: [],
    capabilities: {
      addressValidate: true,
      addressUpdatePush: true,
      readBackVerify: false,
      asyncConfirm: false,
      household: false,
      business: false,
    },
    fallbackActionKey: "demo:fallback",
  },
  buildRequest: () => ({ method: "POST", url: "https://api.demo.test/coa" }),
  push: async () => ({ outcome: "CONFIRMED", confirmationNumber: "DEMO-CONF-1" }),
};

const registry = createConnectorRegistry([uspsConnector, demoConnector]);
const EVENT_REF = "smoke-connector-dispatch";
const PAYLOAD: CanonicalAddressChange = {
  eventId: EVENT_REF,
  from: null,
  to: { street1: "1 New St", street2: null, city: "Boston", state: "MA", zip: "02101", country: "US" },
  fullName: "Smoke Tester",
  fields: {},
};

async function runRow(rowId: string): Promise<void> {
  const row = await db.connectorDispatch.findUnique({ where: { id: rowId } });
  if (!row || !row.payloadEncrypted) return;
  const connector = registry.get(row.connectorKey);
  if (!connector) return;
  const payload = JSON.parse(row.payloadEncrypted) as CanonicalAddressChange;
  const ctx: ConnectorContext = {
    accessToken: null, // no token seeded — usps will degrade to fallback
    idempotencyKey: row.idempotencyKey,
    http: createConnectorHttpClient({
      allowedHosts: connector.manifest.allowedHosts,
      breaker: new CircuitBreaker(),
    }),
    logger: createRedactingLogger(() => {}),
  };
  const result = await runConnectorAttempt(connector, payload, ctx);
  const plan = planNextDispatch({ attemptCount: row.attemptCount, result });
  await db.connectorDispatch.update({
    where: { id: row.id },
    data: { status: plan.status, attemptCount: plan.attemptCount, lastErrorCode: result.errorCode ?? null },
  });
  console.log(
    `  ${row.connectorKey.padEnd(5)} → attempt ${result.outcome}${result.errorCode ? ` (${result.errorCode})` : ""}  ⇒  dispatch status ${plan.status}`,
  );
}

async function main(): Promise<void> {
  const email = `smoke-connector-${Date.now()}@example.test`;
  const user = await db.user.create({ data: { email, firstName: "Smoke", lastName: "Tester" } });
  console.log(`Seeded throwaway user ${user.id}`);

  await db.connectorDispatch.deleteMany({ where: { eventId: EVENT_REF } });
  const mk = (key: string) =>
    db.connectorDispatch.create({
      data: {
        connectorKey: key,
        userId: user.id,
        eventId: EVENT_REF,
        idempotencyKey: `${EVENT_REF}:${key}:${user.id}`,
        status: "QUEUED",
        payloadEncrypted: JSON.stringify(PAYLOAD),
      },
    });
  const usps = await mk("usps");
  const demo = await mk("demo");
  console.log("Enqueued 2 QUEUED dispatches. Running the real engine:");
  await runRow(demo.id);
  await runRow(usps.id);

  await db.connectorDispatch.deleteMany({ where: { eventId: EVENT_REF } });
  await db.user.delete({ where: { id: user.id } });
  console.log("Cleaned up smoke data. Done.");
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
