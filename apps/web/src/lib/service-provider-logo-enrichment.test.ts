import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { enrichServicesWithProviderCatalog } from "./service-provider-logo-enrichment";

vi.mock("@/lib/db", () => ({
  prisma: {
    serviceProvider: {
      findMany: vi.fn(),
    },
  },
}));

import { prisma } from "@/lib/db";

const mockServiceProvider = prisma.serviceProvider as unknown as { findMany: Mock };

describe("service provider logo enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockServiceProvider.findMany.mockResolvedValue([]);
  });

  it("adds catalog logo and website when a service is missing its provider relation", async () => {
    mockServiceProvider.findMany.mockResolvedValueOnce([
      {
        id: "provider-usps",
        name: "USPS",
        slug: "usps",
        category: "GOVERNMENT_POSTAL",
        website: "https://www.usps.com",
        phone: "1-800-275-8777",
        logoUrl: "https://assets.locateflow.com/providers/usps.png",
        scope: "FEDERAL",
      },
    ]);

    const [service] = await enrichServicesWithProviderCatalog([
      {
        id: "service-1",
        providerName: "USPS",
        category: "GOVERNMENT_POSTAL",
        provider: null,
        website: null,
        phone: null,
      },
    ]);

    expect(mockServiceProvider.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          deletedAt: null,
          isActive: true,
          OR: expect.arrayContaining([
            { name: { in: ["USPS"] } },
            { slug: { in: ["usps"] } },
          ]),
        }),
      }),
    );
    expect(service).toMatchObject({
      provider: {
        id: "provider-usps",
        name: "USPS",
        logoUrl: "https://assets.locateflow.com/providers/usps.png",
        website: "https://www.usps.com",
      },
      providerLogoUrl: "https://assets.locateflow.com/providers/usps.png",
      logoUrl: "https://assets.locateflow.com/providers/usps.png",
      website: "https://www.usps.com",
      phone: "1-800-275-8777",
    });
  });

  it("keeps an existing service/provider logo without querying the catalog", async () => {
    const services = [
      {
        providerName: "UPS",
        category: "GOVERNMENT_POSTAL",
        provider: { logoUrl: "https://assets.example/ups.png" },
      },
    ];

    await expect(enrichServicesWithProviderCatalog(services)).resolves.toBe(services);
    expect(mockServiceProvider.findMany).not.toHaveBeenCalled();
  });

  it("prefers the category-matching provider when names collide", async () => {
    mockServiceProvider.findMany.mockResolvedValueOnce([
      {
        id: "provider-tax",
        name: "Acme",
        slug: "acme",
        category: "GOVERNMENT_TAX",
        website: "https://tax.example",
        phone: null,
        logoUrl: "https://assets.example/tax.png",
        scope: "FEDERAL",
      },
      {
        id: "provider-electric",
        name: "Acme",
        slug: "acme",
        category: "UTILITY_ELECTRIC",
        website: "https://electric.example",
        phone: null,
        logoUrl: "https://assets.example/electric.png",
        scope: "STATE",
      },
    ]);

    const [service] = await enrichServicesWithProviderCatalog([
      {
        providerName: "Acme",
        category: "UTILITY_ELECTRIC",
        provider: null,
      },
    ]);

    expect(service.provider).toMatchObject({
      id: "provider-electric",
      logoUrl: "https://assets.example/electric.png",
    });
  });
});
