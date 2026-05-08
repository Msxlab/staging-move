import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    profile: {
      findUnique: vi.fn(),
    },
    address: {
      findMany: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    movingPlan: {
      findFirst: vi.fn(),
    },
    serviceProvider: {
      findMany: vi.fn(),
    },
    stateRule: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@locateflow/db", () => ({
  getProviderCoverageMetadata: vi.fn(() => null),
}));

vi.mock("@/lib/recommendation-engine", () => ({
  scoreProviders: vi.fn((providers: unknown[]) => providers),
  buildRecommendationClusters: vi.fn((providers: unknown[]) => ({
    recommended: [],
    clusters: [],
    allProviders: providers,
  })),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { GET } from "./route";

const mockRequireDbUserId = requireDbUserId as unknown as Mock;
const mockProfile = prisma.profile as unknown as { findUnique: Mock };
const mockAddress = prisma.address as unknown as { findMany: Mock };
const mockService = prisma.service as unknown as { findMany: Mock };
const mockMovingPlan = prisma.movingPlan as unknown as { findFirst: Mock };
const mockServiceProvider = prisma.serviceProvider as unknown as { findMany: Mock };
const rateLimitMock = rateLimit as unknown as Mock;

function makeRequest(search = "") {
  return new Request(`http://localhost/api/providers/recommendations${search}`) as any;
}

describe("provider recommendations route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireDbUserId.mockResolvedValue("user-1");
    mockProfile.findUnique.mockResolvedValue(null);
    mockAddress.findMany.mockResolvedValue([]);
    mockService.findMany.mockResolvedValue([]);
    mockMovingPlan.findFirst.mockResolvedValue(null);
    mockServiceProvider.findMany.mockResolvedValue([]);
  });

  it("keeps no-context recommendations to federal non-transit candidates", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.allProviders).toEqual([]);
    expect(mockServiceProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          scope: "FEDERAL",
          category: { not: "TRANSPORTATION_TRANSIT" },
        }),
        include: { coverages: false },
      }),
    );
    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.stringContaining("rl:provider_recommendations:user:"),
      expect.objectContaining({ limit: 120, windowSeconds: 60, failClosed: false }),
    );
  });

  it("uses a generous recommendation limit so normal dashboard usage is not throttled", async () => {
    await GET(makeRequest());

    expect(rateLimitMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({ limit: 120, windowSeconds: 60 }),
    );
  });
});
