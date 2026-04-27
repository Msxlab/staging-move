import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user-1")),
  recordLegalAcceptance: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: () => mocks.requireDbUserId(),
}));

vi.mock("@/lib/legal-acceptance", () => ({
  normalizeAcceptedLegalConsents: vi.fn((consents) =>
    consents?.termsAccepted && consents?.disclaimerAccepted
      ? {
          termsAccepted: true,
          disclaimerAccepted: true,
          termsVersion: consents.termsVersion || "2026-03-13",
          disclaimerVersion: consents.disclaimerVersion || "2026-03-13",
          acceptedAt: consents.acceptedAt || "2026-04-26T12:00:00.000Z",
        }
      : null,
  ),
  recordLegalAcceptance: (input: unknown) => (mocks.recordLegalAcceptance as any)(input),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

import { POST } from "./route";

function makeRequest(body: unknown) {
  return new NextRequest("https://locateflow.com/api/legal/acceptance", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("legal acceptance route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user-1");
    mocks.recordLegalAcceptance.mockResolvedValue(undefined);
  });

  it("records onboarding legal consent through the shared legal gate", async () => {
    const response = await POST(makeRequest({
      legalConsents: {
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-26T12:00:00.000Z",
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.recordLegalAcceptance).toHaveBeenCalledWith({
      userId: "user-1",
      request: expect.any(NextRequest),
      page: "/onboarding?step=legal",
      source: "onboarding_legal_gate",
      consents: {
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-26T12:00:00.000Z",
      },
    });
  });

  it("rejects incomplete legal consent", async () => {
    const response = await POST(makeRequest({
      legalConsents: {
        termsAccepted: true,
        disclaimerAccepted: false,
      },
    }));

    expect(response.status).toBe(400);
    expect(mocks.recordLegalAcceptance).not.toHaveBeenCalled();
  });
});
