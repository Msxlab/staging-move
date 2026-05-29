import { describe, expect, it } from "vitest";
import type {
  CanonicalAddressChange,
  ConnectorContext,
  ConnectorHttpResponse,
  ConnectorRequest,
} from "../core";
import { createConnectorRegistry, runConnectorAttempt, validateManifest } from "../core";
import { uspsConnector, uspsManifest } from "./index";
import { buildUspsCoaRequest } from "./request";

const input: CanonicalAddressChange = {
  eventId: "evt-1",
  from: { street1: "10 Old Rd", city: "Quincy", state: "MA", zip: "02169", country: "US" },
  to: { street1: "1 New St", street2: "Apt 4", city: "Boston", state: "MA", zip: "02101", country: "US" },
  effectiveDate: "2026-07-01",
  fullName: "Jane Q Doe",
  fields: { accountEmail: "jane@example.com" },
};

function resp(status: number, body: unknown = {}): ConnectorHttpResponse {
  return { status, ok: status < 400, body, headers: {} };
}

function fakeCtx(
  responder: (req: ConnectorRequest) => ConnectorHttpResponse,
  accessToken: string | null = "tok",
) {
  const calls: ConnectorRequest[] = [];
  const ctx: ConnectorContext = {
    accessToken,
    idempotencyKey: "idem-1",
    http: {
      request: async (req) => {
        calls.push(req);
        return responder(req);
      },
    },
    logger: { info: () => {}, warn: () => {}, error: () => {} },
  };
  return { ctx, calls };
}

describe("USPS manifest", () => {
  it("is a valid manifest and registers cleanly", () => {
    expect(validateManifest(uspsManifest)).toEqual([]);
    const registry = createConnectorRegistry([uspsConnector]);
    expect(registry.get("usps")?.manifest.displayName).toBe("USPS Change of Address");
  });

  it("declares a fallback (push-capable connectors must)", () => {
    expect(uspsManifest.capabilities.addressUpdatePush).toBe(true);
    expect(uspsManifest.fallbackActionKey).toBeTruthy();
  });
});

describe("buildUspsCoaRequest", () => {
  it("maps the canonical change onto the COA payload", () => {
    const req = buildUspsCoaRequest(input);
    expect(req.method).toBe("POST");
    expect(req.url).toContain("apis.usps.com");
    const body = req.body as Record<string, any>;
    expect(body.contact.firstName).toBe("Jane");
    expect(body.contact.lastName).toBe("Q Doe");
    expect(body.oldAddress.streetAddress).toBe("10 Old Rd");
    expect(body.newAddress.streetAddress).toBe("1 New St");
    expect(body.newAddress.ZIPCode).toBe("02101");
    expect(body.moveEffectiveDate).toBe("2026-07-01");
  });
});

describe("USPS push", () => {
  it("fails with AUTH_EXPIRED when there is no token", async () => {
    const { ctx } = fakeCtx(() => resp(200), null);
    const result = await uspsConnector.push(buildUspsCoaRequest(input), ctx);
    expect(result).toMatchObject({ outcome: "FAILED", errorCode: "AUTH_EXPIRED" });
  });

  it("sends bearer + idempotency headers and returns SUBMITTED on 2xx", async () => {
    const { ctx, calls } = fakeCtx(() => resp(200, { confirmationNumber: "COA-123" }));
    const result = await uspsConnector.push(buildUspsCoaRequest(input), ctx);
    expect(result).toMatchObject({ outcome: "SUBMITTED", confirmationNumber: "COA-123" });
    expect(calls[0]!.headers!.Authorization).toBe("Bearer tok");
    expect(calls[0]!.headers!["Idempotency-Key"]).toBe("idem-1");
  });

  it("maps partner statuses onto the taxonomy", async () => {
    const cases: Array<[number, Partial<{ outcome: string; errorCode: string; retryable: boolean }>]> = [
      [401, { outcome: "FAILED", errorCode: "AUTH_EXPIRED" }],
      [409, { outcome: "CONFIRMED" }],
      [429, { outcome: "FAILED", errorCode: "RATE_LIMITED", retryable: true }],
      [503, { outcome: "FAILED", errorCode: "PARTNER_DOWN", retryable: true }],
      [422, { outcome: "FAILED", errorCode: "VALIDATION_REJECTED" }],
    ];
    for (const [status, expected] of cases) {
      const { ctx } = fakeCtx(() => resp(status));
      const result = await uspsConnector.push(buildUspsCoaRequest(input), ctx);
      expect(result).toMatchObject(expected);
    }
  });
});

describe("USPS verify + read-back chaining", () => {
  it("confirms once USPS reports the COA active", async () => {
    const { ctx } = fakeCtx(() => resp(200, { status: "ACTIVE", confirmationNumber: "COA-9" }));
    const result = await uspsConnector.verify!(input, ctx);
    expect(result).toMatchObject({ outcome: "CONFIRMED", confirmationNumber: "COA-9" });
  });

  it("stays submitted until USPS activates it", async () => {
    const { ctx } = fakeCtx(() => resp(200, { status: "PENDING" }));
    const result = await uspsConnector.verify!(input, ctx);
    expect(result.outcome).toBe("SUBMITTED");
  });

  it("runConnectorAttempt chains push(SUBMITTED) → verify(CONFIRMED)", async () => {
    // First call = POST push (2xx → SUBMITTED); second = GET verify (ACTIVE).
    let n = 0;
    const { ctx } = fakeCtx(() => {
      n += 1;
      return n === 1
        ? resp(200, { confirmationNumber: "COA-1" })
        : resp(200, { status: "ACTIVE", confirmationNumber: "COA-1" });
    });
    const result = await runConnectorAttempt(uspsConnector, input, ctx);
    expect(result.outcome).toBe("CONFIRMED");
  });
});

describe("USPS healthCheck", () => {
  it("passes when the address API echoes the expected shape", async () => {
    const { ctx } = fakeCtx(() => resp(200, { address: { city: "Washington" } }));
    expect(await uspsConnector.healthCheck!(ctx)).toEqual({ ok: true });
  });

  it("reports SCHEMA_DRIFT when the shape is unexpected", async () => {
    const { ctx } = fakeCtx(() => resp(200, { unexpected: true }));
    const result = await uspsConnector.healthCheck!(ctx);
    expect(result.ok).toBe(false);
    expect(result.reason).toBe("SCHEMA_DRIFT");
  });
});
