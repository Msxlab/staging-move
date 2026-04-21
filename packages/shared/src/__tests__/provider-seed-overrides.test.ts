import { describe, expect, it } from "vitest";
import { FEDERAL_NEW, STATE_PROVIDERS } from "../../../db/prisma/seed-data/provider-seed";
import { expandCoverageRows } from "../provider-coverage";

describe("provider coverage overrides", () => {
  it("injects ZIP prefixes into high-confidence local providers", () => {
    const allProviders = [...FEDERAL_NEW, ...STATE_PROVIDERS];

    const conEd = allProviders.find((provider) => provider.slug === "con-edison");
    const austinWater = allProviders.find((provider) => provider.slug === "austin-water");
    const cta = allProviders.find((provider) => provider.slug === "cta");

    expect(conEd?.zipCodes).toEqual(
      expect.arrayContaining(["100", "112", "116"])
    );
    expect(austinWater?.zipCodes).toEqual(["786", "787"]);
    expect(cta?.zipCodes).toEqual(["606", "607", "608"]);
  });

  it("expands overridden ZIP prefixes into coverage rows instead of whole-state rows", () => {
    const allProviders = [...FEDERAL_NEW, ...STATE_PROVIDERS];
    const septa = allProviders.find((provider) => provider.slug === "septa");

    expect(septa).toBeDefined();

    const rows = expandCoverageRows({
      scope: septa!.scope,
      states: septa!.states,
      zipCodes: septa!.zipCodes,
    });

    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.zipPrefix || row.zipExact)).toBe(true);
    expect(rows.some((row) => row.zipPrefix === "191")).toBe(true);
    expect(rows.some((row) => row.zipExact === null && row.state === "PA")).toBe(true);
  });
});
