import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ findMany: vi.fn() }));

vi.mock("@/lib/db", () => ({
  prisma: { moverApplication: { findMany: mocks.findMany } },
}));

import { matchMoversForLead, MAX_LEAD_MATCHES } from "./match-movers";

const app = (over: Partial<Record<string, unknown>> = {}) => ({
  id: "app_1",
  companyLegalName: "Acme Movers LLC",
  dbaName: null,
  contactEmail: "ops@acme.example",
  serviceStates: "TX,OK",
  ...over,
});

describe("matchMoversForLead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("matches approved movers serving the destination state; prefers dbaName", async () => {
    mocks.findMany.mockResolvedValue([app({ dbaName: "Acme Moving Co" })]);
    const matches = await matchMoversForLead({ toState: "tx", fromState: "ca" });
    expect(matches).toEqual([
      {
        moverApplicationId: "app_1",
        companyName: "Acme Moving Co",
        contactEmail: "ops@acme.example",
        serviceStates: ["TX", "OK"],
      },
    ]);
    // Only APPROVED partners are even queried.
    expect(mocks.findMany.mock.calls[0][0].where).toEqual({ status: "APPROVED" });
  });

  it("treats a partner with no declared states as nationwide", async () => {
    mocks.findMany.mockResolvedValue([app({ serviceStates: "" })]);
    const matches = await matchMoversForLead({ toState: "NY" });
    expect(matches).toHaveLength(1);
  });

  it("excludes partners that don't serve the route and those with no email", async () => {
    mocks.findMany.mockResolvedValue([
      app({ id: "a", serviceStates: "FL" }),
      app({ id: "b", contactEmail: null, serviceStates: "TX" }),
      app({ id: "c", serviceStates: "TX" }),
    ]);
    const matches = await matchMoversForLead({ toState: "TX" });
    expect(matches.map((m) => m.moverApplicationId)).toEqual(["c"]);
  });

  it("caps the fan-out at MAX_LEAD_MATCHES", async () => {
    mocks.findMany.mockResolvedValue(
      Array.from({ length: 10 }, (_, i) => app({ id: `a${i}`, serviceStates: "TX" })),
    );
    const matches = await matchMoversForLead({ toState: "TX", limit: 99 });
    expect(matches).toHaveLength(MAX_LEAD_MATCHES);
  });

  it("returns nothing for a missing/invalid state and never throws on a db error", async () => {
    expect(await matchMoversForLead({ toState: "" })).toEqual([]);
    mocks.findMany.mockRejectedValue(new Error("db down"));
    expect(await matchMoversForLead({ toState: "TX" })).toEqual([]);
  });
});
