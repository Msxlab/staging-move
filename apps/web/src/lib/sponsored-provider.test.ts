import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  placementFindFirst: vi.fn(),
  providerFindUnique: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    sponsoredPlacement: { findFirst: mocks.placementFindFirst },
    serviceProvider: { findUnique: mocks.providerFindUnique },
  },
}));

import { getActiveSponsoredProvider } from "./sponsored-provider";

describe("getActiveSponsoredProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resolves an active placement to its provider with the FTC label", async () => {
    mocks.placementFindFirst.mockResolvedValue({ id: "pl_1", label: "Sponsored", targetId: "prov_1" });
    mocks.providerFindUnique.mockResolvedValue({
      id: "prov_1",
      name: "Acme Internet",
      slug: "acme-internet",
      category: "UTILITY_INTERNET",
      website: "https://acme.example",
      logoUrl: null,
      affiliateActive: true,
      isActive: true,
    });

    const result = await getActiveSponsoredProvider("UTILITY_INTERNET", "tx");

    expect(result).toEqual({
      placementId: "pl_1",
      label: "Sponsored",
      provider: {
        id: "prov_1",
        name: "Acme Internet",
        slug: "acme-internet",
        category: "UTILITY_INTERNET",
        website: "https://acme.example",
        logoUrl: null,
        affiliateActive: true,
      },
    });
    // Scope normalized + only kind=provider placements considered.
    const where = mocks.placementFindFirst.mock.calls[0][0].where;
    expect(where.kind).toBe("provider");
    expect(where.active).toBe(true);
    expect(where.AND).toEqual([
      { OR: [{ stateScope: "TX" }, { stateScope: null }] },
      { OR: [{ categoryScope: "UTILITY_INTERNET" }, { categoryScope: null }] },
    ]);
  });

  it("returns null when there is no live placement", async () => {
    mocks.placementFindFirst.mockResolvedValue(null);
    expect(await getActiveSponsoredProvider("UTILITY_INTERNET", "TX")).toBeNull();
    expect(mocks.providerFindUnique).not.toHaveBeenCalled();
  });

  it("returns null when the target provider is inactive (never break the page)", async () => {
    mocks.placementFindFirst.mockResolvedValue({ id: "pl_1", label: "Sponsored", targetId: "prov_1" });
    mocks.providerFindUnique.mockResolvedValue({
      id: "prov_1",
      name: "Gone",
      slug: "gone",
      category: "UTILITY_INTERNET",
      website: null,
      logoUrl: null,
      affiliateActive: false,
      isActive: false,
    });
    expect(await getActiveSponsoredProvider("UTILITY_INTERNET", "TX")).toBeNull();
  });

  it("fails safe to null if the query throws", async () => {
    mocks.placementFindFirst.mockRejectedValue(new Error("db down"));
    expect(await getActiveSponsoredProvider("UTILITY_INTERNET", "TX")).toBeNull();
  });
});
