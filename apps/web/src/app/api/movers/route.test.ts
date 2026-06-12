import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  getUserPlan: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  getMoversByState: vi.fn(),
  getActiveSponsoredMover: vi.fn(),
  recordSponsoredImpression: vi.fn(),
  recordSponsoredClick: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: (...args: unknown[]) => mocks.requireDbUserId(...args),
}));

vi.mock("@/lib/api-gates", () => ({
  apiGateErrorResponse: (error: unknown) => {
    if (error instanceof Error && error.message === "UNAUTHORIZED") {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });
    }
    return null;
  },
}));

vi.mock("@/lib/plan-limits", () => ({
  getUserPlan: (...args: unknown[]) => mocks.getUserPlan(...args),
}));

vi.mock("@/lib/request-entitlements", async () => {
  const { planFeatures } = await vi.importActual<typeof import("@locateflow/shared")>("@locateflow/shared");
  return {
    requestHasPlanFeature: async (_request: Request, userId: string, feature: keyof ReturnType<typeof planFeatures>) => {
      const plan = await mocks.getUserPlan(userId);
      return planFeatures(plan.plan)[feature] === true;
    },
  };
});

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

vi.mock("@/lib/movers", () => ({
  getMoversByState: (...args: unknown[]) => mocks.getMoversByState(...args),
  getActiveSponsoredMover: (...args: unknown[]) => mocks.getActiveSponsoredMover(...args),
  recordSponsoredImpression: (...args: unknown[]) => mocks.recordSponsoredImpression(...args),
  recordSponsoredClick: (...args: unknown[]) => mocks.recordSponsoredClick(...args),
}));

import { GET, POST } from "./route";

function getRequest(query: string): NextRequest {
  return new NextRequest(`http://localhost/api/movers${query}`);
}

function postRequest(body: unknown): NextRequest {
  return new NextRequest("http://localhost/api/movers", {
    method: "POST",
    body: typeof body === "string" ? body : JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

const MOVER = {
  id: "mc_1",
  usdotNumber: 123456,
  name: "Acme Movers",
  legalName: "Acme Van Lines LLC",
  dbaName: "Acme Movers",
  city: "Austin",
  state: "TX",
  phone: null,
  fleetSize: 12,
  complaintCount2y: 0,
  safetyRating: "Satisfactory",
  dataAsOf: "2026-06-01",
  protectYourMoveUrl: "https://ai.fmcsa.dot.gov/hhg/search.asp",
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireDbUserId.mockResolvedValue("user-1");
  // moverSuggestions is Pro-only under the overhauled entitlement matrix
  // (2026-06-10 ladder) — the entitled-path tests below need a Pro plan.
  mocks.getUserPlan.mockResolvedValue({ plan: "PRO" });
  mocks.getRuntimeConfigValue.mockResolvedValue(null); // SPONSORED_ENABLED off
  mocks.getMoversByState.mockResolvedValue([MOVER]);
  mocks.getActiveSponsoredMover.mockResolvedValue(null);
});

describe("GET /api/movers", () => {
  it("401s when unauthenticated", async () => {
    mocks.requireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await GET(getRequest("?state=TX"));
    expect(res.status).toBe(401);
  });

  it("400s on a missing or malformed state", async () => {
    expect((await GET(getRequest(""))).status).toBe(400);
    expect((await GET(getRequest("?state=Texas"))).status).toBe(400);
    expect(mocks.getMoversByState).not.toHaveBeenCalled();
  });

  it("answers 200 entitled:false for FREE_TRIAL without touching the catalog", async () => {
    mocks.getUserPlan.mockResolvedValue({ plan: "FREE_TRIAL" });
    const res = await GET(getRequest("?state=TX"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({
      configured: true,
      entitled: false,
      upgradeRequired: "MOVER_SUGGESTIONS_UPGRADE_REQUIRED",
    });
    expect(mocks.getMoversByState).not.toHaveBeenCalled();
    expect(mocks.getActiveSponsoredMover).not.toHaveBeenCalled();
  });

  it.each(["INDIVIDUAL", "FAMILY"])("gates %s too (moverSuggestions is Pro-only)", async (plan) => {
    mocks.getUserPlan.mockResolvedValue({ plan });
    const body = await (await GET(getRequest("?state=TX"))).json();
    expect(body.entitled).toBe(false);
    expect(body.upgradeRequired).toBe("MOVER_SUGGESTIONS_UPGRADE_REQUIRED");
  });

  it("returns ranked movers (with USDOT + protectyourmove link) for entitled plans", async () => {
    const res = await GET(getRequest("?state=tx&city=Austin"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.entitled).toBe(true);
    expect(body.state).toBe("TX");
    expect(body.movers).toHaveLength(1);
    expect(body.movers[0].usdotNumber).toBe(123456);
    expect(body.movers[0].protectYourMoveUrl).toContain("ai.fmcsa.dot.gov/hhg");
    expect(mocks.getMoversByState).toHaveBeenCalledWith({ state: "TX", city: "Austin" });
    // Flag off → no placement lookup at all.
    expect(body.sponsored).toBeNull();
    expect(mocks.getActiveSponsoredMover).not.toHaveBeenCalled();
  });

  it("includes the sponsored slot and bumps impressions when SPONSORED_ENABLED=true", async () => {
    mocks.getRuntimeConfigValue.mockImplementation(async (key: string) =>
      key === "SPONSORED_ENABLED" ? "true" : null,
    );
    mocks.getActiveSponsoredMover.mockResolvedValue({
      placementId: "sp_1",
      label: "Sponsored",
      mover: MOVER,
    });

    const body = await (await GET(getRequest("?state=TX"))).json();

    expect(body.sponsored.placementId).toBe("sp_1");
    expect(body.sponsored.label).toBe("Sponsored");
    expect(mocks.recordSponsoredImpression).toHaveBeenCalledWith("sp_1");
  });

  it("keeps serving organic movers when the flag read itself rejects", async () => {
    mocks.getRuntimeConfigValue.mockRejectedValue(new Error("db down"));
    const res = await GET(getRequest("?state=TX"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.movers).toHaveLength(1);
    expect(body.sponsored).toBeNull();
  });

  it("500s when the catalog query fails", async () => {
    mocks.getMoversByState.mockRejectedValue(new Error("boom"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await GET(getRequest("?state=TX"))).status).toBe(500);
    consoleSpy.mockRestore();
  });
});

describe("POST /api/movers (sponsored click beacon)", () => {
  it("401s when unauthenticated", async () => {
    mocks.requireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));
    expect((await POST(postRequest({ placementId: "sp_1" }))).status).toBe(401);
    expect(mocks.recordSponsoredClick).not.toHaveBeenCalled();
  });

  it("records the click and answers 204 when the flag is on", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue("true");
    const res = await POST(postRequest({ placementId: "sp_1" }));
    expect(res.status).toBe(204);
    expect(mocks.recordSponsoredClick).toHaveBeenCalledWith("sp_1");
  });

  it("answers 204 without recording when the flag is off or the body is junk", async () => {
    expect((await POST(postRequest({ placementId: "sp_1" }))).status).toBe(204);
    mocks.getRuntimeConfigValue.mockResolvedValue("true");
    expect((await POST(postRequest("not json {{{"))).status).toBe(204);
    expect((await POST(postRequest({ placementId: 42 }))).status).toBe(204);
    expect(mocks.recordSponsoredClick).not.toHaveBeenCalled();
  });
});
