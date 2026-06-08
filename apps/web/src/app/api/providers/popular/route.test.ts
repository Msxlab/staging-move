import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    address: {
      findMany: vi.fn(),
    },
    service: {
      findMany: vi.fn(),
    },
    serviceProvider: {
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

import { prisma } from "@/lib/db";
import { GET } from "./route";

const mockAddress = prisma.address as unknown as { findMany: Mock };
const mockService = prisma.service as unknown as { findMany: Mock };
const mockServiceProvider = prisma.serviceProvider as unknown as { findMany: Mock };

function makeRequest(search = "?state=TX") {
  return new Request(`http://localhost/api/providers/popular${search}`) as any;
}

// Build `count` distinct users each with one address in the state.
function addressesForUsers(count: number) {
  return Array.from({ length: count }, (_, i) => ({ userId: `u${i}` }));
}

// Each entry: provider used by `users` distinct users (one active service each).
function servicesFor(providers: Array<{ id: string; name: string; users: number }>) {
  const rows: Array<{ userId: string; providerId: string; providerName: string }> = [];
  let userSeq = 0;
  for (const p of providers) {
    for (let i = 0; i < p.users; i++) {
      rows.push({ userId: `svc-u${userSeq++}`, providerId: p.id, providerName: p.name });
    }
  }
  return rows;
}

describe("popular providers route (k-anonymity / F-002)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddress.findMany.mockResolvedValue([]);
    mockService.findMany.mockResolvedValue([]);
    mockServiceProvider.findMany.mockResolvedValue([]);
  });

  it("requires a valid 2-letter state", async () => {
    const response = await GET(makeRequest("?state=TEXAS"));
    expect(response.status).toBe(400);
  });

  it("suppresses all per-provider data when the state cohort is below K", async () => {
    // 8 distinct users — well under the K=20 state cohort threshold (the live
    // ~8-user scale that makes this exploitable).
    mockAddress.findMany.mockResolvedValue(addressesForUsers(8));
    mockService.findMany.mockResolvedValue(
      servicesFor([
        { id: "comcast", name: "Comcast", users: 5 },
        { id: "att", name: "AT&T", users: 3 },
      ]),
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.suppressed).toBe(true);
    // No per-provider figures leak for a sparse state.
    expect(body.topProviders).toEqual([]);
    expect(body.popularity).toEqual({});
    // Provider-catalog stats are never queried for a suppressed state.
    expect(mockServiceProvider.findMany).not.toHaveBeenCalled();
  });

  it("omits providers whose distinct user set is below the per-provider floor", async () => {
    // State clears K (>=20 distinct users), but a niche provider is used by only
    // 2 distinct users — below the floor of 5 — so it must not appear.
    mockAddress.findMany.mockResolvedValue(addressesForUsers(25));
    mockService.findMany.mockResolvedValue(
      servicesFor([
        { id: "comcast", name: "Comcast", users: 12 },
        { id: "att", name: "AT&T", users: 7 },
        { id: "tiny-isp", name: "Tiny ISP", users: 2 },
      ]),
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.suppressed).toBeUndefined();

    const ids = body.topProviders.map((p: { providerId: string }) => p.providerId);
    expect(ids).toContain("comcast");
    expect(ids).toContain("att");
    // Below-floor provider is omitted entirely — no raw low count exposed.
    expect(ids).not.toContain("tiny-isp");
    expect(body.popularity["tiny-isp"]).toBeUndefined();
    // Exposed rows carry the distinct userCount and all clear the floor.
    for (const p of body.topProviders) {
      expect(p.userCount).toBeGreaterThanOrEqual(5);
    }
  });

  it("returns full per-provider data for a well-populated state", async () => {
    mockAddress.findMany.mockResolvedValue(addressesForUsers(30));
    mockService.findMany.mockResolvedValue(
      servicesFor([
        { id: "comcast", name: "Comcast", users: 18 },
        { id: "att", name: "AT&T", users: 9 },
      ]),
    );

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.suppressed).toBeUndefined();
    expect(body.topProviders).toHaveLength(2);

    const comcast = body.topProviders.find((p: { providerId: string }) => p.providerId === "comcast");
    expect(comcast.usageCount).toBe(18);
    expect(comcast.userCount).toBe(18);
    expect(comcast.percentOfUsers).toBe(Math.round((18 / 30) * 100));
    expect(body.popularity.comcast).toBeGreaterThan(0);
  });

  it("returns an empty result for a state with no users", async () => {
    mockAddress.findMany.mockResolvedValue([]);

    const response = await GET(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.userCount).toBe(0);
    expect(mockService.findMany).not.toHaveBeenCalled();
  });
});
