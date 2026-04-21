import { describe, expect, it } from "vitest";
import { findProviderConflicts, sanitizeProviderSeedRecords } from "@locateflow/shared";

describe("sanitizeProviderSeedRecords", () => {
  it("dedupes same-category slug collisions by keeping the more complete record", () => {
    const result = sanitizeProviderSeedRecords([
      {
        name: "PODS",
        slug: "pods",
        category: "HOUSING_MOVING",
        website: "https://www.pods.com",
      },
      {
        name: "PODS",
        slug: "pods",
        category: "HOUSING_MOVING",
        website: "https://www.pods.com",
        description: "Portable storage and moving containers",
        phone: "1-800-776-7637",
      },
    ]);

    expect(result.providers).toHaveLength(1);
    expect(result.providers[0].slug).toBe("pods");
    expect(result.providers[0].description).toBe("Portable storage and moving containers");
    expect(result.deduped[0]?.removedCount).toBe(1);
  });

  it("renames cross-category slug collisions instead of silently dropping them", () => {
    const result = sanitizeProviderSeedRecords([
      {
        name: "Rover",
        slug: "rover",
        category: "HEALTHCARE_VET",
        website: "https://www.rover.com",
      },
      {
        name: "Rover",
        slug: "rover",
        category: "PET_SERVICES",
        website: "https://www.rover.com/services",
      },
    ]);

    expect(result.providers).toHaveLength(2);
    expect(result.providers.map((provider) => provider.slug)).toEqual(["rover", "rover-pet-services"]);
    expect(result.renamed[0]?.to).toBe("rover-pet-services");
  });
});

describe("findProviderConflicts", () => {
  it("detects slug and same-category semantic duplicates", () => {
    const existing = [
      {
        id: "provider-1",
        name: "TaskRabbit",
        slug: "taskrabbit",
        category: "HOUSING_HOME_SERVICE",
        website: "https://www.taskrabbit.com",
      },
    ];

    const slugConflict = findProviderConflicts(existing, {
      name: "TaskRabbit Moving Help",
      slug: "taskrabbit",
      category: "HOUSING_MOVING",
      website: "https://www.taskrabbit.com/moving",
    });
    const semanticConflict = findProviderConflicts(existing, {
      name: "TaskRabbit",
      slug: "taskrabbit-home-services",
      category: "HOUSING_HOME_SERVICE",
      website: "https://www.taskrabbit.com",
    });

    expect(slugConflict[0]?.type).toBe("slug");
    expect(semanticConflict[0]?.type).toBe("name-category");
  });
});
