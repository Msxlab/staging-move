import { describe, expect, it } from "vitest";
import type { AddressConnector } from "./connector";
import type {
  CanonicalAddressChange,
  ConnectorCapabilities,
  ConnectorContext,
  ConnectorManifest,
  ConnectorResult,
} from "./types";
import { missingRequiredFields, runConnectorAttempt } from "./executor";
import { ConnectorHttpError } from "./http-client";

const ctx: ConnectorContext = {
  accessToken: "token",
  idempotencyKey: "idem-1",
  http: { request: async () => ({ status: 200, ok: true, body: null, headers: {} }) },
  logger: { info: () => {}, warn: () => {}, error: () => {} },
};

const input: CanonicalAddressChange = {
  eventId: "evt-1",
  from: null,
  to: { street1: "1 New St", city: "Boston", state: "MA", zip: "02101", country: "US" },
  fullName: "Jane Doe",
  fields: { accountNumber: "A1" },
};

function makeConnector(opts: {
  required?: string[];
  caps?: Partial<ConnectorCapabilities>;
  push?: AddressConnector["push"];
  verify?: AddressConnector["verify"];
}): AddressConnector {
  const manifest: ConnectorManifest = {
    key: "test",
    version: "1.0.0",
    displayName: "Test",
    auth: { type: "API_KEY" },
    allowedHosts: ["api.test.com"],
    requiredFields: opts.required ?? [],
    capabilities: {
      addressValidate: true,
      addressUpdatePush: true,
      readBackVerify: false,
      asyncConfirm: false,
      household: false,
      business: false,
      ...(opts.caps ?? {}),
    },
    fallbackActionKey: "test:fallback",
  };
  return {
    manifest,
    buildRequest: () => ({ method: "POST", url: "https://api.test.com/x", body: {} }),
    push: opts.push ?? (async (): Promise<ConnectorResult> => ({ outcome: "CONFIRMED" })),
    verify: opts.verify,
  };
}

describe("missingRequiredFields", () => {
  it("reports fields absent from the input", () => {
    const connector = makeConnector({ required: ["accountNumber", "taxId"] });
    expect(missingRequiredFields(connector, input)).toEqual(["taxId"]);
  });
});

describe("runConnectorAttempt", () => {
  it("fails with VALIDATION_REJECTED when a required field is missing", async () => {
    const connector = makeConnector({ required: ["taxId"] });
    const result = await runConnectorAttempt(connector, input, ctx);
    expect(result.outcome).toBe("FAILED");
    expect(result.errorCode).toBe("VALIDATION_REJECTED");
    expect(result.retryable).toBe(false);
    expect((result.metadata as { missingFields: string[] }).missingFields).toEqual(["taxId"]);
  });

  it("degrades to NEEDS_USER when the connector cannot push", async () => {
    const connector = makeConnector({ caps: { addressUpdatePush: false } });
    const result = await runConnectorAttempt(connector, input, ctx);
    expect(result.outcome).toBe("NEEDS_USER");
  });

  it("returns the push result when confirmed directly", async () => {
    const connector = makeConnector({ push: async () => ({ outcome: "CONFIRMED", confirmationNumber: "C1" }) });
    const result = await runConnectorAttempt(connector, input, ctx);
    expect(result.outcome).toBe("CONFIRMED");
    expect(result.confirmationNumber).toBe("C1");
  });

  it("chains push→verify when the push is only submitted", async () => {
    const connector = makeConnector({
      caps: { readBackVerify: true },
      push: async () => ({ outcome: "SUBMITTED" }),
      verify: async () => ({ outcome: "CONFIRMED", confirmationNumber: "V9" }),
    });
    const result = await runConnectorAttempt(connector, input, ctx);
    expect(result.outcome).toBe("CONFIRMED");
    expect(result.confirmationNumber).toBe("V9");
  });

  it("maps a thrown transport error onto the taxonomy", async () => {
    const connector = makeConnector({
      push: async () => {
        throw new ConnectorHttpError("PARTNER_DOWN", "boom");
      },
    });
    const result = await runConnectorAttempt(connector, input, ctx);
    expect(result.outcome).toBe("FAILED");
    expect(result.errorCode).toBe("PARTNER_DOWN");
    expect(result.retryable).toBe(true);
  });

  it("treats an unexpected throw as terminal", async () => {
    const connector = makeConnector({
      push: async () => {
        throw new Error("unexpected");
      },
    });
    const result = await runConnectorAttempt(connector, input, ctx);
    expect(result.outcome).toBe("FAILED");
    expect(result.errorCode).toBe("UNKNOWN");
    expect(result.retryable).toBe(false);
  });
});
