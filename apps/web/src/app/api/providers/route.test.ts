import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("next/cache", () => ({
  unstable_cache: <T extends (...args: unknown[]) => unknown>(fn: T) => fn,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    serviceProvider: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@locateflow/db", () => ({
  getProviderCoverageMetadata: vi.fn(() => null),
}));

import { prisma } from "@/lib/db";
import { GET } from "./route";

const mockServiceProvider = prisma.serviceProvider as unknown as {
  findMany: Mock;
};

function makeRequest(search = "") {
  return new Request(`http://localhost/api/providers${search}`) as any;
}

describe("providers route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceProvider.findMany.mockResolvedValue([]);
  });

  it("defaults no-context provider listings to federal providers", async () => {
    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toEqual([]);
    expect(mockServiceProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isActive: true,
          scope: "FEDERAL",
        }),
        include: { coverages: false },
      }),
    );
  });

  it("does not dump all state providers when state scope lacks state or ZIP context", async () => {
    const response = await GET(makeRequest("?scope=STATE"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toEqual([]);
    expect(body.total).toBe(0);
    expect(mockServiceProvider.findMany).not.toHaveBeenCalled();
  });

  it("does not dump all state providers for state-scoped text search without state or ZIP context", async () => {
    const response = await GET(makeRequest("?scope=STATE&q=electric"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.providers).toEqual([]);
    expect(body.total).toBe(0);
    expect(mockServiceProvider.findMany).not.toHaveBeenCalled();
  });
});
