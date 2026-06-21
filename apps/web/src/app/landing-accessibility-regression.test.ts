import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("landing accessibility regressions", () => {
  it("keeps the hero headline accessible as one spaced sentence", () => {
    const page = read("src/app/page.tsx");

    expect(page).toContain('const heroTitle = `${heroPrefix} ${heroAccent} ${heroSuffix}`;');
    expect(page).toContain("aria-label={heroTitle}");
    expect(page).toContain('<span aria-hidden="true">');
  });
});
