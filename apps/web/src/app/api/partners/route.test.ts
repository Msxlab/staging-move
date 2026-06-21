import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  isFeatureEnabled: vi.fn(),
  rateLimit: vi.fn(),
  getRateLimitKey: vi.fn(() => "partner-key"),
  partnerCreate: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/db", () => ({ prisma: { partner: { create: mocks.partnerCreate } } }));
vi.mock("@/lib/feature-flags", () => ({ isFeatureEnabled: mocks.isFeatureEnabled }));
vi.mock("@/lib/rate-limit", () => ({ rateLimit: mocks.rateLimit, getRateLimitKey: mocks.getRateLimitKey }));
vi.mock("@/lib/runtime-config", () => ({ getRuntimeConfigValue: mocks.getRuntimeConfigValue }));
vi.mock("@/lib/email", () => ({ sendEmail: mocks.sendEmail, renderLocateFlowEmail: () => "<html></html>" }));

import { POST } from "./route";

function req(body: unknown) {
  return new Request("https://locateflow.com/api/partners", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as any;
}

const valid = {
  category: "cleaning",
  companyName: "Sparkle Clean",
  contactName: "Sam Clean",
  contactEmail: "sam@sparkle.example",
  serviceStates: "TX, ok",
  attestation: true,
  consent: true,
};

describe("POST /api/partners", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isFeatureEnabled.mockResolvedValue(true);
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.partnerCreate.mockResolvedValue({ id: "ptr_1" });
    mocks.getRuntimeConfigValue.mockResolvedValue(null); // no admin inbox → email skipped
  });

  it("404s when partner_registration_v1 is off (fail-closed)", async () => {
    mocks.isFeatureEnabled.mockResolvedValue(false);
    const res = await POST(req(valid));
    expect(res.status).toBe(404);
    expect(mocks.partnerCreate).not.toHaveBeenCalled();
  });

  it("422s without attestation + consent", async () => {
    const res = await POST(req({ ...valid, consent: false }));
    expect(res.status).toBe(422);
    expect(mocks.partnerCreate).not.toHaveBeenCalled();
  });

  it("422s an unsupported category (movers use their own portal)", async () => {
    const res = await POST(req({ ...valid, category: "moving" }));
    expect(res.status).toBe(422);
  });

  it("429s when rate-limited", async () => {
    mocks.rateLimit.mockResolvedValue({ success: false });
    expect((await POST(req(valid))).status).toBe(429);
  });

  it("creates a PENDING partner with normalized states", async () => {
    const res = await POST(req(valid));
    expect(res.status).toBe(201);
    const data = mocks.partnerCreate.mock.calls[0][0].data;
    expect(data).toMatchObject({
      category: "cleaning",
      status: "PENDING",
      attestation: true,
      // Lead-program consent is persisted so matching only routes PII to opted-in
      // partners (audit P2).
      leadsOptIn: true,
      serviceStates: "TX,OK",
    });
  });
});
