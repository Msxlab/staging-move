import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  moverFindMany: vi.fn(),
  partnerFindMany: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    moverApplication: { findMany: mocks.moverFindMany },
    partner: { findMany: mocks.partnerFindMany },
  },
}));

import { matchPartnersForLead } from "./match-partners";

describe("matchPartnersForLead", () => {
  beforeEach(() => vi.clearAllMocks());

  it("routes a moving lead to approved mover applications (mover_application kind)", async () => {
    mocks.moverFindMany.mockResolvedValue([
      { id: "app1", companyLegalName: "Acme Movers", dbaName: null, contactEmail: "m@x.com", serviceStates: "TX" },
    ]);
    const matches = await matchPartnersForLead({ category: "moving", toState: "TX" });
    expect(matches).toEqual([
      {
        partnerKind: "mover_application",
        partnerId: "app1",
        companyName: "Acme Movers",
        contactEmail: "m@x.com",
        serviceStates: ["TX"],
      },
    ]);
    expect(mocks.partnerFindMany).not.toHaveBeenCalled();
  });

  it("routes a cleaning lead to approved generic Partners of that category (partner kind)", async () => {
    mocks.partnerFindMany.mockResolvedValue([
      { id: "ptr1", companyName: "Sparkle Clean", contactEmail: "c@x.com", serviceStates: "TX,OK" },
    ]);
    const matches = await matchPartnersForLead({ category: "cleaning", toState: "tx" });
    expect(matches).toEqual([
      {
        partnerKind: "partner",
        partnerId: "ptr1",
        companyName: "Sparkle Clean",
        contactEmail: "c@x.com",
        serviceStates: ["TX", "OK"],
      },
    ]);
    expect(mocks.partnerFindMany.mock.calls[0][0].where).toEqual({ status: "APPROVED", category: "cleaning" });
    expect(mocks.moverFindMany).not.toHaveBeenCalled();
  });

  it("treats a Partner with no declared states as nationwide", async () => {
    mocks.partnerFindMany.mockResolvedValue([
      { id: "ptr1", companyName: "Anywhere Junk", contactEmail: "j@x.com", serviceStates: "" },
    ]);
    const matches = await matchPartnersForLead({ category: "junk", toState: "NY" });
    expect(matches).toHaveLength(1);
  });

  it("returns [] for an unknown category and never throws on a db error", async () => {
    expect(await matchPartnersForLead({ category: "utilities", toState: "TX" })).toEqual([]);
    mocks.partnerFindMany.mockRejectedValue(new Error("db down"));
    expect(await matchPartnersForLead({ category: "cleaning", toState: "TX" })).toEqual([]);
  });
});
