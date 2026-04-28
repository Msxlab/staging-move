import { describe, expect, it, vi } from "vitest";
import { findDuplicateTrackedService } from "./service-duplicate-guard";

describe("service duplicate guard", () => {
  it("matches listed provider duplicates by provider id", async () => {
    const db = {
      service: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "service-1",
            providerName: "PSE&G",
            providerId: "provider-1",
            customProviderId: null,
          },
        ]),
      },
    };

    await expect(
      findDuplicateTrackedService(db, {
        userId: "user-1",
        addressId: "address-1",
        category: "utility_electric",
        providerName: "Public Service Electric",
        providerId: "provider-1",
      }),
    ).resolves.toMatchObject({ id: "service-1" });

    expect(db.service.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          category: "UTILITY_ELECTRIC",
          isActive: true,
          deletedAt: null,
          OR: [
            { migrationAction: null },
            {
              migrationAction: {
                notIn: expect.arrayContaining(["CANCEL", "REMOVED", "ARCHIVED"]),
              },
            },
          ],
        }),
      }),
    );
  });

  it("matches name duplicates after normalization", async () => {
    const db = {
      service: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: "service-2",
            providerName: "Neighborhood Dental, LLC",
            providerId: null,
            customProviderId: "custom-1",
          },
        ]),
      },
    };

    await expect(
      findDuplicateTrackedService(db, {
        userId: "user-1",
        addressId: "address-1",
        category: "HEALTHCARE_DENTIST",
        providerName: "Neighborhood Dental LLC",
      }),
    ).resolves.toMatchObject({ id: "service-2" });
  });
});
