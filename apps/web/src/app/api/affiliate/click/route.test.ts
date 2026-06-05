import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    serviceProvider: { findFirst: vi.fn() },
    affiliateClick: { create: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn(() => Promise.resolve({ success: true, remaining: 29, resetAt: Date.now() + 60_000 })),
  getRateLimitKey: vi.fn(() => "affiliate:click:test"),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const mockPrisma = {
  serviceProvider: { findFirst: prisma.serviceProvider.findFirst as Mock },
  affiliateClick: { create: (prisma as any).affiliateClick.create as Mock },
};
const mockRequireDbUserId = requireDbUserId as any;
const mockRateLimit = rateLimit as any;

function makeRequest(input: Record<string, unknown>) {
  return new Request("http://localhost/api/affiliate/click", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  }) as any;
}

describe("affiliate click route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockRateLimit.mockResolvedValue({ success: true, remaining: 29, resetAt: Date.now() + 60_000 });
    mockPrisma.affiliateClick.create.mockResolvedValue({ id: "click-1" });
  });

  it("records a click and returns the stored affiliate URL for an active https offer", async () => {
    mockPrisma.serviceProvider.findFirst.mockResolvedValue({
      id: "prov-1",
      affiliateActive: true,
      affiliateUrl: "https://partner.example/offer?ref=locateflow",
      affiliateNetwork: "impact",
    });

    const response = await POST(makeRequest({ providerId: "prov-1", source: "provider_detail" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.url).toBe("https://partner.example/offer?ref=locateflow");
    expect(mockPrisma.affiliateClick.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: "user-1",
          providerId: "prov-1",
          source: "provider_detail",
          network: "impact",
        }),
      }),
    );
  });

  it("normalizes an unknown source to 'unknown'", async () => {
    mockPrisma.serviceProvider.findFirst.mockResolvedValue({
      id: "prov-1",
      affiliateActive: true,
      affiliateUrl: "https://partner.example/offer",
      affiliateNetwork: null,
    });

    await POST(makeRequest({ providerId: "prov-1", source: "totally-made-up" }));

    expect(mockPrisma.affiliateClick.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ source: "unknown" }) }),
    );
  });

  it("returns 404 (and records nothing) when the offer is inactive", async () => {
    mockPrisma.serviceProvider.findFirst.mockResolvedValue({
      id: "prov-1",
      affiliateActive: false,
      affiliateUrl: "https://partner.example/offer",
      affiliateNetwork: null,
    });

    const response = await POST(makeRequest({ providerId: "prov-1", source: "services" }));

    expect(response.status).toBe(404);
    expect(mockPrisma.affiliateClick.create).not.toHaveBeenCalled();
  });

  it("refuses to hand back a non-https affiliate URL", async () => {
    mockPrisma.serviceProvider.findFirst.mockResolvedValue({
      id: "prov-1",
      affiliateActive: true,
      affiliateUrl: "http://insecure.example/offer",
      affiliateNetwork: null,
    });

    const response = await POST(makeRequest({ providerId: "prov-1", source: "services" }));

    expect(response.status).toBe(404);
    expect(mockPrisma.affiliateClick.create).not.toHaveBeenCalled();
  });

  it("requires a providerId", async () => {
    const response = await POST(makeRequest({ source: "services" }));
    expect(response.status).toBe(400);
    expect(mockPrisma.serviceProvider.findFirst).not.toHaveBeenCalled();
  });

  it("returns 429 when rate limited, before touching the database", async () => {
    mockRateLimit.mockResolvedValue({ success: false, remaining: 0, resetAt: Date.now() + 60_000 });

    const response = await POST(makeRequest({ providerId: "prov-1", source: "services" }));

    expect(response.status).toBe(429);
    expect(mockPrisma.serviceProvider.findFirst).not.toHaveBeenCalled();
  });
});
