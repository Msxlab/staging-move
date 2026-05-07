import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { ADMIN_RESOURCES } from "./admin-permissions";

const SEED_PATH = path.resolve(
  __dirname,
  "../../../../packages/db/prisma/seed-admin.ts",
);

/**
 * The runtime permission matrix lives in admin-permissions.ts and the
 * seed inlines its own copy in seed-admin.ts (the seed runs as a Prisma
 * tsx script without Next path aliases). If the two drift, freshly seeded
 * SUPER_ADMINs come up missing rows for newer resources — and the
 * fallback in checkPermission was removed, so a missing row means denied.
 */
function parseSeededResources(source: string): string[] {
  const match = source.match(/const adminResources\s*=\s*\[([\s\S]*?)\];/);
  if (!match) return [];
  return Array.from(match[1].matchAll(/["']([a-z_]+)["']/g)).map((m) => m[1]);
}

describe("admin permission seed parity", () => {
  const seedSource = readFileSync(SEED_PATH, "utf-8");
  const seeded = parseSeededResources(seedSource);

  it("seeds every resource declared in ADMIN_RESOURCES", () => {
    const missing = ADMIN_RESOURCES.filter((r) => !seeded.includes(r));
    expect(missing).toEqual([]);
  });

  it("does not seed any resource that is not in ADMIN_RESOURCES", () => {
    const stale = seeded.filter((r) => !(ADMIN_RESOURCES as readonly string[]).includes(r));
    expect(stale).toEqual([]);
  });

  it("seeds at least one resource (sanity check that parsing worked)", () => {
    expect(seeded.length).toBeGreaterThan(0);
  });
});
