/**
 * Connector SDK — contract test kit.
 *
 * The single standardized way to prove a NEW connector (USPS, a bank, an
 * aggregator like Plaid) correctly implements the `AddressConnector` contract
 * BEFORE it ever touches a real partner. This is what turns "add a partner"
 * from a bespoke multi-day integration into a one-day, safe job: scaffold from
 * the USPS template, then drop `assertConnectorContract(myConnector, …)` into a
 * test and the framework's invariants are enforced for you.
 *
 * Pure + no I/O: it never calls the side-effecting `push`/`verify` (those reach
 * the partner). It checks the deterministic, structural contract — the manifest,
 * the request mapping (deterministic + on the egress allowlist), capability ↔
 * method coherence, and the webhook parser's null-safety.
 */

import type { AddressConnector } from "./connector";
import type { CanonicalAddressChange } from "./types";
import { validateManifest } from "./manifest";

export interface ContractCheckOptions {
  /**
   * A complete sample change whose `fields` satisfy the manifest's
   * `requiredFields`, so `buildRequest` can be exercised. A `requiresOrigin`
   * connector must pass a non-null `from`.
   */
  sampleInput: CanonicalAddressChange;
  /**
   * A payload `parseWebhook` should NOT recognize; the kit asserts it returns
   * `null`. Defaults to `{}`. Only used when the connector implements parseWebhook.
   */
  unrecognizedWebhookPayload?: unknown;
}

const ALLOWED_METHODS = new Set(["GET", "POST", "PUT", "PATCH", "DELETE"]);

/**
 * Check a connector against the framework contract. Returns human-readable
 * issues; an empty array means it passes. Never calls push/verify.
 */
export function checkConnectorContract(connector: AddressConnector, opts: ContractCheckOptions): string[] {
  const issues: string[] = [];
  const m = connector.manifest;

  // 1. Manifest must be well-formed (reuse the framework's own validator).
  for (const issue of validateManifest(m)) issues.push(`manifest: ${issue}`);

  // 2. Capability ↔ method coherence — a declared capability must be backed by
  //    the matching optional method, or the framework will silently no-op it.
  if (m.capabilities.readBackVerify && typeof connector.verify !== "function") {
    issues.push("capability readBackVerify is declared but verify() is not implemented");
  }
  if (m.capabilities.asyncConfirm && typeof connector.parseWebhook !== "function") {
    issues.push("capability asyncConfirm is declared but parseWebhook() is not implemented");
  }

  // 3. buildRequest: deterministic, valid method, and on the egress allowlist —
  //    only meaningful for push-capable connectors (guided-only ones never send).
  if (m.capabilities.addressUpdatePush) {
    if (m.requiresOrigin && opts.sampleInput.from === null) {
      issues.push("sampleInput.from is null but manifest.requiresOrigin is true — pass a real origin so buildRequest can be exercised");
    } else {
      try {
        const a = connector.buildRequest(opts.sampleInput);
        const b = connector.buildRequest(opts.sampleInput);
        if (JSON.stringify(a) !== JSON.stringify(b)) {
          issues.push("buildRequest is not deterministic (same input produced different requests) — it must be a pure mapping");
        }
        if (!ALLOWED_METHODS.has(a.method)) {
          issues.push(`buildRequest produced an unsupported HTTP method "${a.method}"`);
        }
        let host: string | null = null;
        try {
          host = new URL(a.url).host.toLowerCase();
        } catch {
          issues.push(`buildRequest produced a non-absolute url "${a.url}"`);
        }
        if (host && !m.allowedHosts.includes(host)) {
          issues.push(
            `buildRequest targets host "${host}" which is not in manifest.allowedHosts — the egress allowlist would block this request`,
          );
        }
      } catch (e) {
        issues.push(`buildRequest threw for a complete sample input: ${(e as Error).message}`);
      }
    }
  }

  // 4. parseWebhook must return null for an unrecognized payload (the framework
  //    relies on this to ignore noise instead of mis-confirming a dispatch).
  if (typeof connector.parseWebhook === "function") {
    const garbage = "unrecognizedWebhookPayload" in opts ? opts.unrecognizedWebhookPayload : {};
    if (connector.parseWebhook(garbage) !== null) {
      issues.push("parseWebhook must return null for an unrecognized/unparseable payload");
    }
  }

  return issues;
}

/**
 * Assert-style wrapper for a test. Throws with every issue if the connector
 * fails the contract, otherwise returns silently.
 *
 *   it("honors the connector contract", () =>
 *     assertConnectorContract(myConnector, { sampleInput }));
 */
export function assertConnectorContract(connector: AddressConnector, opts: ContractCheckOptions): void {
  const issues = checkConnectorContract(connector, opts);
  if (issues.length > 0) {
    throw new Error(`Connector "${connector.manifest.key}" fails the contract:\n - ${issues.join("\n - ")}`);
  }
}
