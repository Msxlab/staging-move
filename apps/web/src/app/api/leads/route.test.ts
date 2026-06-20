import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  isFeatureEnabled: vi.fn(),
  rateLimit: vi.fn(),
  getRateLimitKey: vi.fn(() => "leads-key"),
  createLead: vi.fn(),
  apiGateErrorResponse: vi.fn(() => null),
}));

vi.mock("@/lib/auth", () => ({ requireDbUserId: mocks.requireDbUserId }));
vi.mock("@/lib/api-gates", () => ({ apiGateErrorResponse: mocks.apiGateErrorResponse }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: mocks.isFeatureEnabled }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit, getRateLimitKey: mocks.getRateLimitKey }));
vi.mock("@/lib/client-ip", () => ({ resolveClientIpFromHeaders: () => "1.2.3.4" }));
vi.mock("@/lib/acquisition-campaigns", () => ({
  getRequestHashSnapshot: () => ({ consentIpHash: "iph", consentUserAgentHash: "uah" }),
  hashForSnapshot: (v: string | null | undefined) => (v ? `h(${v})` : null),
}));
vi.mock("@/lib/leads/create-lead", () => ({ createLead: mocks.createLead }));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://locateflow.com/api/leads", {
    method: "POST",
    headers: { "content-type": "application/json", "user-agent": "test-agent" },
    body: JSON.stringify(body),
  }) as any;
}

const validBody = {
  toState: "TX",
  fromState: "CA",
  toZip: "78701",
  moveDate: "2026-08-01",
  homeSize: "TWO_BR",
  contactName: "Pat Mover",
  contactEmail: "pat@example.com",
  consent: true,
};

describe("POST /api/leads", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user-1");
    mocks.isFeatureEnabled.mockResolvedValue(true);
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.createLead.mockResolvedValue({ leadId: "lead_1", matchedCount: 3, deduped: false });
  });

  it("404s when offers_moving_quotes_v1 is off (fail-closed)", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);
    const res = await POST(req(validBody));
    expect(res.status).toBe(404);
    expect(mocks.createLead).not.toHaveBeenCalled();
  });

  it("422s when consent is missing", async () => {
    const { consent, ...noConsent } = validBody;
    const res = await POST(req(noConsent));
    expect(res.status).toBe(422);
    expect(mocks.createLead).not.toHaveBeenCalled();
  });

  it("429s when rate-limited", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    const res = await POST(req(validBody));
    expect(res.status).toBe(429);
    expect(mocks.createLead).not.toHaveBeenCalled();
  });

  it("creates the lead with a consent snapshot + dedupe key and returns the match count", async () => {
    const res = await POST(req(validBody));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ ok: true, leadId: "lead_1", matchedCount: 3 });

    const arg = mocks.createLead.mock.calls[0][0];
    expect(arg.userId).toBe("user-1");
    expect(arg.category).toBe("moving");
    expect(arg.toState).toBe("TX");
    expect(arg.consentAcceptedAt).toBeInstanceOf(Date);
    expect(arg.consentIpHash).toBe("iph");
    expect(arg.termsVersion).toBeTruthy();
    expect(typeof arg.idempotencyKey).toBe("string");
    expect(arg.idempotencyKey.length).toBeGreaterThan(0);
    // PII contact fields are passed for encryption inside createLead.
    expect(arg.contactName).toBe("Pat Mover");
  });
});
