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

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { GET } from "./route";

const requireDbUserIdMock = requireDbUserId as unknown as Mock;
const rateLimitMock = rateLimit as unknown as Mock;
const movingPlanMock = prisma.movingPlan as unknown as { findFirst: Mock };

function request() {
  return new NextRequest("https://locateflow.com/api/moving/migration?planId=plan-1");
}

describe("moving migration auth handling", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireDbUserIdMock.mockResolvedValue("user-1");
    movingPlanMock.findFirst.mockResolvedValue(null);
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
});
