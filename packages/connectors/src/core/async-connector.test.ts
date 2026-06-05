import { describe, expect, it, vi } from "vitest";
import type { AddressConnector } from "./connector";
import type {
  CanonicalAddressChange,
  ConnectorContext,
  ConnectorManifest,
  ConnectorResult,
} from "./types";
import { runConnectorAttempt } from "./executor";

/**
 * G5 — async-confirm connector coverage.
 *
 * An async connector pushes (→ SUBMITTED) and confirms LATER via an inbound
 * partner webhook (parseWebhook), not a synchronous read-back. This exercises
 * the two contract points the sync USPS connector can't: (1) the executor must
 * NOT call verify for an async connector, and (2) parseWebhook must map a
 * partner payload back to the dispatch ref + a normalized result.
 */

const ctx: ConnectorContext = {
  accessToken: "token",
  idempotencyKey: "idem-async-1",
  http: { request: async () => ({ status: 200, ok: true, body: null, headers: {} }) },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
};

const input: CanonicalAddressChange = {
  eventId: "evt-async-1",
  from: null,
  to: { street1: "9 Async Way", city: "Denver", state: "CO", zip: "80202", country: "US" },
  fullName: "Async Tester",
  fields: {},
};

function makeAsyncConnector(opts: {
  push: AddressConnector["push"];
  verify?: AddressConnector["verify"];
  parseWebhook?: AddressConnector["parseWebhook"];
}): AddressConnector {
  const manifest: ConnectorManifest = {
    key: "async-test",
    version: "1.0.0",
    displayName: "Async Test",
    auth: { type: "API_KEY" },
    allowedHosts: ["api.async.test"],
    requiredFields: [],
    capabilities: {
      addressValidate: false,
      addressUpdatePush: true,
      readBackVerify: false, // async: no synchronous read-back
      asyncConfirm: true, // confirmation arrives later via webhook
      household: false,
      business: false,
    },
    fallbackActionKey: "async-test:fallback",
  };
  return {
    manifest,
    buildRequest: () => ({ method: "POST", url: "https://api.async.test/coa", body: {} }),
    push: opts.push,
    verify: opts.verify,
    parseWebhook: opts.parseWebhook,
  };
}

describe("async connector — executor never calls verify (awaits webhook)", () => {
  it("leaves an async push at SUBMITTED without calling verify", async () => {
    const verify = vi.fn(async (): Promise<ConnectorResult> => ({ outcome: "CONFIRMED" }));
    const connector = makeAsyncConnector({
      push: async (): Promise<ConnectorResult> => ({ outcome: "SUBMITTED" }),
      verify,
    });
    const result = await runConnectorAttempt(connector, input, ctx);
    expect(result.outcome).toBe("SUBMITTED"); // awaits async confirmation
    expect(verify).not.toHaveBeenCalled(); // readBackVerify is false → no sync verify
  });
});

describe("async connector — parseWebhook maps a partner callback", () => {
  it("extracts the dispatch ref and a normalized CONFIRMED result", () => {
    const connector = makeAsyncConnector({
      push: async () => ({ outcome: "SUBMITTED" }),
      parseWebhook: (payload: unknown) => {
        const p = payload as { clientRef?: string; state?: string; confirmation?: string };
        if (!p?.clientRef) return null;
        return {
          ref: p.clientRef,
          result:
            p.state === "ACTIVE"
              ? { outcome: "CONFIRMED", confirmationNumber: p.confirmation ?? null }
              : { outcome: "SUBMITTED" },
        };
      },
    });

    const parsed = connector.parseWebhook?.({ clientRef: "idem-async-1", state: "ACTIVE", confirmation: "COA-777" });
    expect(parsed?.ref).toBe("idem-async-1");
    expect(parsed?.result.outcome).toBe("CONFIRMED");
    expect(parsed?.result.confirmationNumber).toBe("COA-777");
  });

  it("returns null for an unrecognized/unparseable payload", () => {
    const connector = makeAsyncConnector({
      push: async () => ({ outcome: "SUBMITTED" }),
      parseWebhook: (payload: unknown) => {
        const p = payload as { clientRef?: string };
        return p?.clientRef ? { ref: p.clientRef, result: { outcome: "CONFIRMED" } } : null;
      },
    });
    expect(connector.parseWebhook?.({ garbage: true })).toBeNull();
  });
});
