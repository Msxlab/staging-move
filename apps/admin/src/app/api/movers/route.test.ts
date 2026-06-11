import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
  moverFindMany: vi.fn(),
  moverCount: vi.fn(),
  moverAggregate: vi.fn(),
  moverGroupBy: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requirePermission: mocks.requirePermission,
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    movingCompany: {
      findMany: mocks.moverFindMany,
      count: mocks.moverCount,
      aggregate: mocks.moverAggregate,
      groupBy: mocks.moverGroupBy,
    },
  },
}));

import * as route from "./route";

const { GET } = route;

function getRequest(query: string) {
  return new Request(`https://admin.locateflow.com/api/movers${query}`) as any;
}

const sampleMover = {
  id: "mover_1",
  usdotNumber: 12345,
  legalName: "ACME VAN LINES",
  dbaName: "Acme Movers",
  state: "TX",
  city: "Austin",
  phone: "5125550100",
  hhgAuthorization: true,
  fleetSize: 12,
  complaintCount2y: 0,
  safetyRating: "Satisfactory",
  dataAsOf: "2026-05-01T00:00:00.000Z",
  active: true,
};

describe("admin movers collection route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requirePermission.mockResolvedValue({ adminId: "admin_1", email: "a@x.com", role: "VIEWER" });
    mocks.moverFindMany.mockResolvedValue([sampleMover]);
    mocks.moverCount.mockResolvedValue(1);
    mocks.moverAggregate.mockResolvedValue({ _max: { dataAsOf: new Date("2026-05-01T00:00:00.000Z") } });
    mocks.moverGroupBy.mockResolvedValue([
      { state: "CA", _count: { id: 3 } },
      { state: "TX", _count: { id: 5 } },
    ]);
  });

  it("is read-only: the catalog is ETL-filled, so no POST/PUT/DELETE exist", () => {
    // The honest posture — there is deliberately no import trigger (the
    // FMCSA census download is form-gated and the ETL needs a local CSV).
    expect((route as any).POST).toBeUndefined();
    expect((route as any).PUT).toBeUndefined();
    expect((route as any).DELETE).toBeUndefined();
    expect((route as any).PATCH).toBeUndefined();
  });

  it("lists movers with honest catalog-freshness metadata derived from the rows", async () => {
    const response = await GET(getRequest(""));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.movers).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.freshness).toMatchObject({
      newestDataAsOf: "2026-05-01T00:00:00.000Z",
      statesCovered: 2,
    });
    expect(body.freshness.stateCounts).toEqual([
      { state: "CA", count: 3 },
      { state: "TX", count: 5 },
    ]);
  });

  it("computes freshness over the whole catalog, not the filtered view", async () => {
    await GET(getRequest("?state=TX&status=inactive"));

    // First two count calls are the filtered list count + the unfiltered
    // total; the active count is explicitly { active: true } only.
    const countArgs = mocks.moverCount.mock.calls.map((call) => call[0]);
    expect(countArgs).toContainEqual(undefined);
    expect(countArgs).toContainEqual({ where: { active: true } });
    expect(mocks.moverAggregate).toHaveBeenCalledWith({ _max: { dataAsOf: true } });
  });

  it("searches by USDOT number and by legal/DBA name", async () => {
    await GET(getRequest("?search=12345"));
    expect(mocks.moverFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { usdotNumber: 12345 },
            { legalName: { contains: "12345" } },
            { dbaName: { contains: "12345" } },
          ]),
        }),
      }),
    );

    await GET(getRequest("?search=acme"));
    expect(mocks.moverFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { legalName: { contains: "acme" } },
            { dbaName: { contains: "acme" } },
          ],
        }),
      }),
    );
  });

  it("applies state, status, and HHG filters (and ignores junk state codes)", async () => {
    await GET(getRequest("?state=tx&status=inactive&hhg=authorized"));
    expect(mocks.moverFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { state: "TX", active: false, hhgAuthorization: true },
      }),
    );

    await GET(getRequest("?state=Texas&hhg=none"));
    expect(mocks.moverFindMany).toHaveBeenLastCalledWith(
      expect.objectContaining({
        where: { hhgAuthorization: false },
      }),
    );
  });

  it("paginates with a clamped perPage and deterministic ordering", async () => {
    await GET(getRequest("?page=3&perPage=9999"));
    expect(mocks.moverFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 200,
        take: 100,
        orderBy: [{ legalName: "asc" }, { usdotNumber: "asc" }],
      }),
    );
  });

  it("degrades gracefully when freshness aggregates fail — list still renders", async () => {
    mocks.moverGroupBy.mockRejectedValueOnce(new Error("boom"));

    const response = await GET(getRequest(""));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.movers).toHaveLength(1);
    expect(body.freshness).toBeNull();
  });

  it("reads at the VIEWER floor on the providers resource", async () => {
    await GET(getRequest(""));
    expect(mocks.requirePermission).toHaveBeenCalledWith("providers", "canRead", { minimumRole: "VIEWER" });
  });

  it("maps UNAUTHORIZED/FORBIDDEN to 401/403", async () => {
    mocks.requirePermission.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    expect((await GET(getRequest(""))).status).toBe(401);

    mocks.requirePermission.mockRejectedValueOnce(new Error("FORBIDDEN"));
    expect((await GET(getRequest(""))).status).toBe(403);
  });
});
