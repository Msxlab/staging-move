#!/usr/bin/env node
/**
 * Connector scaffolding generator.
 *
 * Creates a contract-VALID connector skeleton (manifest + pure request mapping +
 * push stub + a passing contract test) from the USPS reference pattern, so
 * adding a partner starts as a 1-command, already-green job — then you fill in
 * the partner specifics.
 *
 *   node scripts/new-connector.mjs <key>        e.g.  node scripts/new-connector.mjs acme-bank
 *
 * After generating: 1) edit the manifest (allowedHosts, auth, requiredFields),
 * 2) implement buildRequest/push against the partner spec, 3) run the contract
 * test, 4) register it + add a ConnectorConfig row (stage SHADOW) in admin.
 */
import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const argv = process.argv.slice(2);
const dryRun = argv.includes("--dry-run");
const key = (argv.find((a) => !a.startsWith("-")) || "").trim();
if (!/^[a-z][a-z0-9-]*$/.test(key)) {
  console.error('Usage: node scripts/new-connector.mjs <key> [--dry-run]   (lowercase kebab-case, e.g. "acme-bank")');
  process.exit(1);
}
// Guard against the wrong CWD — this writes into packages/connectors.
if (!existsSync("package.json") || !existsSync(join("packages", "connectors"))) {
  console.error("Run from the repository root (package.json + packages/connectors must exist in the current directory).");
  process.exit(1);
}
const camel = key.replace(/-([a-z0-9])/g, (_, c) => c.toUpperCase());
const dir = join("packages", "connectors", "src", key);
if (existsSync(dir)) {
  console.error(`Connector folder already exists: ${dir}`);
  process.exit(1);
}

const INDEX = `import type { AddressConnector, ConnectorManifest, ConnectorResult } from "../core";
import { build__CAMEL__Request } from "./request";

export const __CAMEL__Manifest: ConnectorManifest = {
  key: "__KEY__",
  version: "1.0.0",
  displayName: "__KEY__",
  auth: { type: "API_KEY" }, // TODO: "OAUTH" with least-privilege scopes for a user-delegated partner
  allowedHosts: ["api.example.com"], // TODO: the partner's real API host(s)
  requiredFields: [], // TODO: e.g. ["accountNumber"]
  capabilities: {
    addressValidate: false,
    addressUpdatePush: true, // TODO: false => guided-only (deep-link), no server push
    readBackVerify: false,
    asyncConfirm: false,
    household: false,
    business: false,
  },
  fallbackActionKey: "__KEY__:FALLBACK", // TODO: register a guided fallback action (admin /connector-fallbacks)
};

export const __CAMEL__Connector: AddressConnector = {
  manifest: __CAMEL__Manifest,
  buildRequest: build__CAMEL__Request,
  async push(request, ctx): Promise<ConnectorResult> {
    // Send via the allowlisted ctx.http and map the partner response onto a
    // ConnectorResult. Never throw for an expected failure — map it to
    // { outcome: "FAILED", errorCode } from the shared taxonomy.
    const res = await ctx.http.request(request);
    return res.ok
      ? { outcome: "SUBMITTED", metadata: { status: res.status } }
      : { outcome: "FAILED", errorCode: "PARTNER_DOWN", retryable: true };
  },
};
`;

const REQUEST = `import type { CanonicalAddressChange, ConnectorRequest } from "../core";

/**
 * Pure, deterministic mapping from the canonical change to the partner request.
 * Building a request never sends it — keep this side-effect free so the contract
 * test can lock it down with recorded fixtures.
 */
export function build__CAMEL__Request(input: CanonicalAddressChange): ConnectorRequest {
  return {
    method: "POST",
    url: "https://api.example.com/address-change", // TODO: partner endpoint (host must be in manifest.allowedHosts)
    headers: { "Content-Type": "application/json" },
    body: {
      fullName: input.fullName,
      to: input.to,
      from: input.from,
      effectiveDate: input.effectiveDate ?? undefined,
      // TODO: shape to the partner spec; pull per-service ids from input.fields
    },
  };
}
`;

const TEST = `import { describe, it } from "vitest";
import { assertConnectorContract } from "../core";
import { __CAMEL__Connector } from "./index";

describe("__KEY__ connector", () => {
  it("honors the framework contract", () => {
    assertConnectorContract(__CAMEL__Connector, {
      sampleInput: {
        eventId: "test",
        from: { street1: "1 Old St", city: "Austin", state: "TX", zip: "78701", country: "US" },
        to: { street1: "2 New St", city: "Boston", state: "MA", zip: "02101", country: "US" },
        fullName: "Jane Doe",
        fields: {},
      },
    });
  });
});
`;

const fill = (s) => s.replaceAll("__CAMEL__", camel).replaceAll("__KEY__", key);

if (dryRun) {
  console.log(`[dry-run] Would create ${dir}/ with: index.ts, request.ts, ${key}.test.ts`);
  process.exit(0);
}

mkdirSync(dir, { recursive: true });
writeFileSync(join(dir, "index.ts"), fill(INDEX));
writeFileSync(join(dir, "request.ts"), fill(REQUEST));
writeFileSync(join(dir, `${key}.test.ts`), fill(TEST));

console.log(`Created connector skeleton: ${dir}`);
console.log("Next:");
console.log("  1) Edit the manifest (allowedHosts, auth/scopes, requiredFields, capabilities).");
console.log("  2) Implement buildRequest + push against the partner's API spec.");
console.log(`  3) Run the contract test: pnpm --filter @locateflow/connectors exec vitest run src/${key}`);
console.log("  4) Register it in connector-registry, add a ConnectorConfig row (stage=SHADOW) + runtime-config secrets in admin.");
