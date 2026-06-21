import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("admin Aurora theme token integration", () => {
  it("keeps legacy rose/orange aliases on the cool primary while foil remains honey", () => {
    const globals = read("src/app/globals.css");
    const aurora = read("src/app/aurora.css");

    expect(globals).toContain("--rose:        #7FB6E8;");
    expect(globals).toContain("--brand-orange:       #7FB6E8;");
    expect(globals).toContain("--foil:        #F2C46C;");
    expect(globals).toContain("--brand-amber:        #F2C46C;");
    expect(globals).toContain("--border-focus: rgba(127, 182, 232, 0.55);");

    expect(aurora).toContain("--rose:        var(--au-cool);");
    expect(aurora).toContain("--brand-orange:       var(--au-cool);");
    expect(aurora).toContain("--foil:        var(--au-violet);");
    expect(aurora).toContain("--brand-amber:        var(--au-violet);");
    expect(aurora).not.toContain("--rose:        var(--au-violet);");
    expect(aurora).not.toContain("--brand-orange:       var(--au-violet);");
  });
});
