import { describe, expect, it, vi } from "vitest";
import {
  findDuplicateCustomProvider,
  findListedProviderNameConflict,
} from "./custom-provider-duplicate-guard";

describe("custom provider duplicate guard", () => {
  it("blocks duplicate private provider names per user and category", async () => {
    const db = {
      userCustomProvider: {
        findMany: vi.fn().mockResolvedValue([{ id: "custom-1", name: "Corner Gym" }]),
      },
    };

    await expect(
      findDuplicateCustomProvider(db, {
        userId: "user-1",
        name: "corner-gym",
        category: "FITNESS_GYM",
      }),
    ).resolves.toMatchObject({ id: "custom-1" });
  });

  it("detects listed provider shadowing by normalized name", async () => {
    const db = {
      serviceProvider: {
        findMany: vi.fn().mockResolvedValue([
          { id: "listed-1", name: "PSE&G", slug: "pseg" },
        ]),
      },
    };

    await expect(
      findListedProviderNameConflict(db, {
        name: "PSE G",
        category: "UTILITY_ELECTRIC",
      }),
    ).resolves.toMatchObject({ id: "listed-1", slug: "pseg" });
  });
});
