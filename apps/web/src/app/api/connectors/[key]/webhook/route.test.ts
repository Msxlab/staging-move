import { createHmac } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";

const SECRET = "whsec_test_connector";

const mocks = vi.hoisted(() => ({
  getRuntimeConfigValue: vi.fn(),
  prisma: {
    connectorConfig: { findUnique: vi.fn() },
    connectorDispatch: { findUnique: vi.fn(), update: vi.fn() },
  },
  encrypt: vi.fn((s: string) => `enc:${s}`),
  reserveWebhookEvent: vi.fn(),
  releaseWebhookEvent: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: mocks.prisma }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/shared-encryption", () => ({ encrypt: mocks.encrypt }));
vi.mock("@/lib/webhook-idempotency", () => ({
  reserveWebhookEvent: mocks.reserveWebhookEvent,
  releaseWebhookEvent: mocks.releaseWebhookEvent,
}));
// Mock the app connector registry so a stand-in async-confirm connector is
// addressable for "usps": its parseWebhook reads our echoed ref + outcome out of
// the (already signature-verified) payload — exactly what a real parseWebhook does.
vi.mock("@/lib/connector-registry", () => ({
  connectorRegistry: {
    get: (key: string) =>
      key === "usps"
        ? {
            manifest: { allowedHosts: ["apis.usps.com"] },
            parseWebhook: (payload: any) =>
              payload?.ref
                ? { ref: payload.ref, result: { outcome: payload.outcome, errorCode: payload.errorCode, confirmationNumber: payload.conf } }
                : null,
          }
        : undefined,
  },
}));

function signedRequest(key: string, bodyObj: unknown, opts: { secret?: string; sig?: string } = {}) {
  const body = JSON.stringify(bodyObj);
  const sig = opts.sig ?? createHmac("sha256", opts.secret ?? SECRET).update(body).digest("hex");
  return new Request(`http://localhost/api/connectors/${key}/webhook`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-connector-signature": sig },
    body,
  }) as any;
}

const params = (key: string) => ({ params: Promise.resolve({ key }) });

describe("inbound connector webhook receiver", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getRuntimeConfigValue.mockImplementation((k: string) => {
      if (k === "FEATURE_API_CONNECTORS") return Promise.resolve("true");
      if (k === "CONNECTOR_USPS_WEBHOOK_SECRET") return Promise.resolve(SECRET);
      return Promise.resolve(null);
    });
    mocks.reserveWebhookEvent.mockResolvedValue("reserved");
    mocks.releaseWebhookEvent.mockResolvedValue(undefined);
    mocks.prisma.connectorConfig.findUnique.mockResolvedValue({
      enabled: true,
      stage: "GA",
      circuitState: "CLOSED",
    });
    mocks.prisma.connectorDispatch.findUnique.mockResolvedValue({
      id: "disp_1",
      connectorKey: "usps",
      idempotencyKey: "idem-123",
      status: "SUBMITTED",
    });
    mocks.prisma.connectorDispatch.update.mockResolvedValue({});
  });

  it("confirms the matching dispatch on a CONFIRMED outcome", async () => {
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "CONFIRMED", conf: "USPS-COA-9988" }), params("usps"));

    expect(res.status).toBe(200);
    expect(mocks.prisma.connectorDispatch.update).toHaveBeenCalledWith({
      where: { id: "disp_1" },
      data: expect.objectContaining({
        status: "CONFIRMED",
        confirmedAt: expect.any(Date),
        lastErrorCode: null,
        confirmationEncrypted: "enc:USPS-COA-9988",
      }),
    });
    // Reserved up-front (race-free), and NOT released since processing succeeded.
    expect(mocks.reserveWebhookEvent).toHaveBeenCalled();
    expect(mocks.releaseWebhookEvent).not.toHaveBeenCalled();
  });

  it("degrades to the guided-update fallback (NEEDS_USER) on a FAILED outcome", async () => {
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "FAILED", errorCode: "PERMANENT_REJECT" }), params("usps"));

    expect(res.status).toBe(200);
    expect(mocks.prisma.connectorDispatch.update).toHaveBeenCalledWith({
      where: { id: "disp_1" },
      data: { status: "NEEDS_USER", lastErrorCode: "PERMANENT_REJECT" },
    });
  });

  it("rejects a bad signature without touching any dispatch", async () => {
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "CONFIRMED" }, { sig: "deadbeef" }), params("usps"));

    expect(res.status).toBe(401);
    expect(mocks.prisma.connectorDispatch.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.connectorDispatch.update).not.toHaveBeenCalled();
  });

  it("honors the admin kill switch before mutating a dispatch", async () => {
    mocks.prisma.connectorConfig.findUnique.mockResolvedValue({
      enabled: false,
      stage: "GA",
      circuitState: "CLOSED",
    });
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "CONFIRMED" }), params("usps"));

    expect(res.status).toBe(503);
    expect(mocks.prisma.connectorDispatch.findUnique).not.toHaveBeenCalled();
    expect(mocks.prisma.connectorDispatch.update).not.toHaveBeenCalled();
  });

  it("freezes inbound writes when the connector circuit is open", async () => {
    mocks.prisma.connectorConfig.findUnique.mockResolvedValue({
      enabled: true,
      stage: "ROLLOUT",
      circuitState: "OPEN",
    });
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "CONFIRMED" }), params("usps"));

    expect(res.status).toBe(503);
    expect(mocks.prisma.connectorDispatch.update).not.toHaveBeenCalled();
  });

  it("fails closed (503) when no per-connector secret is configured", async () => {
    mocks.getRuntimeConfigValue.mockImplementation((k: string) =>
      k === "FEATURE_API_CONNECTORS" ? Promise.resolve("true") : Promise.resolve(null),
    );
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "CONFIRMED" }), params("usps"));
    expect(res.status).toBe(503);
    expect(mocks.prisma.connectorDispatch.update).not.toHaveBeenCalled();
  });

  it("is inert (404) when the master flag is off", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "CONFIRMED" }), params("usps"));
    expect(res.status).toBe(404);
  });

  it("never reopens a terminal dispatch (replay/late-dupe safe)", async () => {
    mocks.prisma.connectorDispatch.findUnique.mockResolvedValue({
      id: "disp_1",
      connectorKey: "usps",
      idempotencyKey: "idem-123",
      status: "CONFIRMED",
    });
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "FAILED", errorCode: "PARTNER_DOWN" }), params("usps"));
    expect(res.status).toBe(200);
    expect(mocks.prisma.connectorDispatch.update).not.toHaveBeenCalled();
  });

  it("acks but records nothing for an unknown reference", async () => {
    mocks.prisma.connectorDispatch.findUnique.mockResolvedValue(null);
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-unknown", outcome: "CONFIRMED" }), params("usps"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.matched).toBe(false);
    expect(mocks.prisma.connectorDispatch.update).not.toHaveBeenCalled();
    // Reserved and kept (the unknown ref is fully handled — nothing to retry).
    expect(mocks.reserveWebhookEvent).toHaveBeenCalled();
    expect(mocks.releaseWebhookEvent).not.toHaveBeenCalled();
  });

  it("short-circuits a duplicate delivery before touching any dispatch", async () => {
    mocks.reserveWebhookEvent.mockResolvedValue("duplicate");
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "CONFIRMED" }), params("usps"));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.duplicate).toBe(true);
    expect(mocks.prisma.connectorDispatch.findUnique).not.toHaveBeenCalled();
  });

  it("releases the reservation and 500s when processing throws (retryable)", async () => {
    mocks.prisma.connectorDispatch.update.mockRejectedValue(new Error("db down"));
    const { POST } = await import("./route");
    const res = await POST(signedRequest("usps", { ref: "idem-123", outcome: "CONFIRMED", conf: "X" }), params("usps"));
    expect(res.status).toBe(500);
    // Released so the partner's retry can reprocess instead of seeing a duplicate.
    expect(mocks.releaseWebhookEvent).toHaveBeenCalledWith(expect.any(String), "connector:usps");
  });
});
