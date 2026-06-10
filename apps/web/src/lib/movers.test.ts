import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  movingCompanyFindMany: vi.fn(),
  movingCompanyFindUnique: vi.fn(),
  placementFindFirst: vi.fn(),
  placementUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    movingCompany: {
      findMany: (...args: unknown[]) => mocks.movingCompanyFindMany(...args),
      findUnique: (...args: unknown[]) => mocks.movingCompanyFindUnique(...args),
    },
    sponsoredPlacement: {
      findFirst: (...args: unknown[]) => mocks.placementFindFirst(...args),
      update: (...args: unknown[]) => mocks.placementUpdate(...args),
    },
  },
}));

import {
  MAX_MOVERS,
  getActiveSponsoredMover,
  getMoversByState,
  protectYourMoveLink,
  rankMovers,
  recordSponsoredClick,
  recordSponsoredImpression,
  toMoverRow,
} from "./movers";

function company(overrides: Record<string, unknown> = {}) {
  return {
    id: "mc_1",
    usdotNumber: 123456,
    legalName: "Acme Van Lines LLC",
    dbaName: "Acme Movers",
    state: "TX",
    city: "Austin",
    phone: "5125551234",
    fleetSize: 12,
    complaintCount2y: 0,
    safetyRating: "Satisfactory",
    dataAsOf: new Date("2026-06-01T00:00:00.000Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("rankMovers", () => {
  it("orders Satisfactory > unrated > Conditional > Unsatisfactory, then fleet desc", () => {
    const ranked = rankMovers([
      { legalName: "D", safetyRating: "Unsatisfactory", fleetSize: 900 },
      { legalName: "C", safetyRating: "Conditional", fleetSize: 50 },
      { legalName: "B", safetyRating: null, fleetSize: 5 },
      { legalName: "A2", safetyRating: "Satisfactory", fleetSize: 3 },
      { legalName: "A1", safetyRating: "Satisfactory", fleetSize: 40 },
    ]);
    expect(ranked.map((m) => m.legalName)).toEqual(["A1", "A2", "B", "C", "D"]);
  });

  it("puts null fleet sizes after sized fleets within the same safety tier", () => {
    const ranked = rankMovers([
      { legalName: "NoFleet", safetyRating: null, fleetSize: null },
      { legalName: "Sized", safetyRating: null, fleetSize: 1 },
    ]);
    expect(ranked.map((m) => m.legalName)).toEqual(["Sized", "NoFleet"]);
  });

  it("does not mutate its input", () => {
    const input = [
      { legalName: "B", safetyRating: null, fleetSize: 1 },
      { legalName: "A", safetyRating: null, fleetSize: 2 },
    ];
    rankMovers(input);
    expect(input[0].legalName).toBe("B");
  });
});

describe("toMoverRow", () => {
  it("prefers the DBA name and includes USDOT + protectyourmove link", () => {
    const row = toMoverRow(company());
    expect(row.name).toBe("Acme Movers");
    expect(row.usdotNumber).toBe(123456);
    expect(row.dataAsOf).toBe("2026-06-01");
    expect(row.protectYourMoveUrl).toBe(protectYourMoveLink(123456));
    expect(row.protectYourMoveUrl).toContain("ai.fmcsa.dot.gov/hhg");
  });

  it("falls back to the legal name when DBA is blank", () => {
    expect(toMoverRow(company({ dbaName: "  " })).name).toBe("Acme Van Lines LLC");
    expect(toMoverRow(company({ dbaName: null })).name).toBe("Acme Van Lines LLC");
  });
});

describe("getMoversByState", () => {
  it("queries active HHG carriers for the normalized state and caps at MAX_MOVERS", async () => {
    mocks.movingCompanyFindMany.mockResolvedValue(
      Array.from({ length: 30 }, (_, i) =>
        company({ id: `mc_${i}`, usdotNumber: 1000 + i, legalName: `Carrier ${String(i).padStart(2, "0")}` }),
      ),
    );

    const rows = await getMoversByState({ state: "tx", limit: 99 });

    expect(mocks.movingCompanyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { state: "TX", active: true, hhgAuthorization: true },
      }),
    );
    expect(rows).toHaveLength(MAX_MOVERS);
  });

  it("adds the optional city filter when provided", async () => {
    mocks.movingCompanyFindMany.mockResolvedValue([]);
    await getMoversByState({ state: "TX", city: "  Austin  " });
    expect(mocks.movingCompanyFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { state: "TX", active: true, hhgAuthorization: true, city: "Austin" },
      }),
    );
  });

  it("ranks results (Satisfactory before Conditional) before slicing", async () => {
    mocks.movingCompanyFindMany.mockResolvedValue([
      company({ id: "a", legalName: "Big Conditional", safetyRating: "Conditional", fleetSize: 500 }),
      company({ id: "b", legalName: "Small Satisfactory", safetyRating: "Satisfactory", fleetSize: 2 }),
    ]);
    const rows = await getMoversByState({ state: "TX" });
    expect(rows.map((r) => r.legalName)).toEqual(["Small Satisfactory", "Big Conditional"]);
  });
});

describe("getActiveSponsoredMover", () => {
  const NOW = new Date("2026-06-10T12:00:00.000Z");

  it("returns null when no live placement matches", async () => {
    mocks.placementFindFirst.mockResolvedValue(null);
    expect(await getActiveSponsoredMover("TX", NOW)).toBeNull();
    expect(mocks.movingCompanyFindUnique).not.toHaveBeenCalled();
  });

  it("resolves the placement to its mover row with the disclosure label", async () => {
    mocks.placementFindFirst.mockResolvedValue({ id: "sp_1", label: "Sponsored", targetId: "mc_1" });
    mocks.movingCompanyFindUnique.mockResolvedValue({ ...company(), active: true, hhgAuthorization: true });

    const sponsored = await getActiveSponsoredMover("tx", NOW);

    expect(mocks.placementFindFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          kind: "mover",
          active: true,
          OR: [{ stateScope: "TX" }, { stateScope: null }],
        }),
      }),
    );
    expect(sponsored).not.toBeNull();
    expect(sponsored?.placementId).toBe("sp_1");
    expect(sponsored?.label).toBe("Sponsored");
    expect(sponsored?.mover.usdotNumber).toBe(123456);
  });

  it("returns null when the target company is inactive or lost HHG authority", async () => {
    mocks.placementFindFirst.mockResolvedValue({ id: "sp_1", label: "Sponsored", targetId: "mc_1" });
    mocks.movingCompanyFindUnique.mockResolvedValue({ ...company(), active: false, hhgAuthorization: true });
    expect(await getActiveSponsoredMover("TX", NOW)).toBeNull();

    mocks.movingCompanyFindUnique.mockResolvedValue({ ...company(), active: true, hhgAuthorization: false });
    expect(await getActiveSponsoredMover("TX", NOW)).toBeNull();
  });

  it("swallows lookup failures (sponsored may never break the list)", async () => {
    mocks.placementFindFirst.mockRejectedValue(new Error("db down"));
    expect(await getActiveSponsoredMover("TX", NOW)).toBeNull();
  });
});

describe("fire-and-forget counters", () => {
  it("bumps impressions without awaiting and swallows rejections", async () => {
    mocks.placementUpdate.mockRejectedValue(new Error("db down"));
    expect(() => recordSponsoredImpression("sp_1")).not.toThrow();
    expect(mocks.placementUpdate).toHaveBeenCalledWith({
      where: { id: "sp_1" },
      data: { impressions: { increment: 1 } },
    });
    // Let the detached promise settle — the rejection must not surface.
    await new Promise((r) => setTimeout(r, 0));
  });

  it("bumps clicks and ignores invalid ids without touching the db", () => {
    mocks.placementUpdate.mockResolvedValue({});
    recordSponsoredClick("sp_2");
    expect(mocks.placementUpdate).toHaveBeenCalledWith({
      where: { id: "sp_2" },
      data: { clicks: { increment: 1 } },
    });

    mocks.placementUpdate.mockClear();
    recordSponsoredClick("");
    recordSponsoredClick("x".repeat(31));
    expect(mocks.placementUpdate).not.toHaveBeenCalled();
  });
});
