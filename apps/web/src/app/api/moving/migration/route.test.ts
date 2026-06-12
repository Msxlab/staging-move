import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    movingPlan: { findFirst: vi.fn() },
    service: { findMany: vi.fn() },
    serviceProvider: { findMany: vi.fn() },
    profile: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "moving-migration-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/provider-serviceability", () => ({
  enrichProviderServiceability: vi.fn(async () => ({
    fcc: { status: "skipped", confirmedCount: 0, blockGeoid: null },
    electric: { status: "skipped", confirmedCount: 0, utilityCount: 0 },
  })),
  applyProviderServiceabilityConfidence: vi.fn((provider, confidence) =>
    provider.fccServiceable || provider.utilityServiceable ? "AVAILABLE_AT_ADDRESS" : confidence,
  ),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import {
  applyProviderServiceabilityConfidence,
  enrichProviderServiceability,
} from "@/lib/provider-serviceability";
import { GET } from "./route";

const requireDbUserIdMock = requireDbUserId as unknown as Mock;
const rateLimitMock = rateLimit as unknown as Mock;
const movingPlanMock = prisma.movingPlan as unknown as { findFirst: Mock };
const serviceMock = prisma.service as unknown as { findMany: Mock };
const serviceProviderMock = prisma.serviceProvider as unknown as { findMany: Mock };
const profileMock = prisma.profile as unknown as { findUnique: Mock };
const enrichProviderServiceabilityMock = enrichProviderServiceability as unknown as Mock;
const applyProviderServiceabilityConfidenceMock = applyProviderServiceabilityConfidence as unknown as Mock;

function request() {
  return new NextRequest("https://locateflow.com/api/moving/migration?planId=plan-1");
}

describe("moving migration auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireDbUserIdMock.mockResolvedValue("user-1");
    movingPlanMock.findFirst.mockResolvedValue(null);
    serviceMock.findMany.mockResolvedValue([]);
    serviceProviderMock.findMany.mockResolvedValue([]);
    profileMock.findUnique.mockResolvedValue(null);
    enrichProviderServiceabilityMock.mockImplementation(async (providers: any[]) => {
      for (const provider of providers) {
        if (provider.id === "dest-xfinity") provider.fccServiceable = true;
      }
      return {
        fcc: { status: "ok", confirmedCount: 1, blockGeoid: "484530011001" },
        electric: { status: "skipped", confirmedCount: 0, utilityCount: 0 },
      };
    });
    applyProviderServiceabilityConfidenceMock.mockImplementation((provider, confidence) =>
      provider.fccServiceable || provider.utilityServiceable ? "AVAILABLE_AT_ADDRESS" : confidence,
    );
  });

  it("returns the auth gate response before migration analysis work when unauthenticated", async () => {
    requireDbUserIdMock.mockRejectedValue(new Error("UNAUTHORIZED"));

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.code).toBe("UNAUTHORIZED");
    expect(rateLimitMock).not.toHaveBeenCalled();
    expect(movingPlanMock.findFirst).not.toHaveBeenCalled();
  });

  it("uses address-level serviceability when ranking migration provider candidates", async () => {
    movingPlanMock.findFirst.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      deletedAt: null,
      fromAddressId: "from-1",
      toAddressId: "to-1",
      fromAddress: { state: "NJ", zip: "07030" },
      toAddress: {
        state: "TX",
        zip: "78701",
        latitude: 30.2672,
        longitude: -97.7431,
      },
    });
    serviceMock.findMany.mockResolvedValue([
      {
        id: "service-1",
        category: "UTILITY_INTERNET",
        providerName: "Old Internet",
        providerId: null,
        isActive: true,
        monthlyCost: null,
        migrationAction: null,
        provider: null,
      },
    ]);
    serviceProviderMock.findMany.mockResolvedValue([
      {
        id: "dest-xfinity",
        name: "Xfinity",
        slug: "xfinity",
        category: "UTILITY_INTERNET",
        scope: "FEDERAL",
        states: [],
        zipCodes: [],
        coverageModel: "live_address",
        coverages: [],
        popularityScore: 10,
      },
    ]);

    const response = await GET(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(enrichProviderServiceabilityMock).toHaveBeenCalledWith(
      expect.any(Array),
      { latitude: 30.2672, longitude: -97.7431 },
    );
    expect(applyProviderServiceabilityConfidenceMock).toHaveBeenCalled();
    expect(body.transitionPlans[0].destinationProviderCandidates[0]).toMatchObject({
      id: "dest-xfinity",
      name: "Xfinity",
      coverageConfidence: "AVAILABLE_AT_ADDRESS",
    });
  });
});
