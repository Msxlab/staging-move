import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("admin Aurora theme token integration", () => {
  it("keeps legacy primary aliases sapphire while semantic rose stays risk red", () => {
    const globals = read("src/app/globals.css");
    const aurora = read("src/app/aurora.css");

    expect(globals).toContain("--rose:        #5B8DEF;");
    expect(globals).toContain("--brand-orange:       #5B8DEF;");
    expect(globals).toContain("--foil:        #5B8DEF;");
    expect(globals).toContain("--brand-amber:        #E0A85A;");
    expect(globals).toContain("--tone-rose-fg: #E25C5C;");
    expect(globals).toContain("--tone-orange-fg: #5B8DEF;");
    expect(globals).toContain("--tone-sky-fg: #37C2C9;");
    expect(globals).toContain("--border-focus: rgba(91, 141, 239, 0.55);");

    expect(aurora).toContain("--rose:        var(--au-cool);");
    expect(aurora).toContain("--brand-orange:       var(--au-cool);");
    expect(aurora).toContain("--foil:        var(--au-violet);");
    expect(aurora).toContain("--brand-amber:        var(--au-amber);");
    expect(aurora).toContain("--tone-rose-fg:    var(--au-coral);");
    expect(aurora).toContain("--tone-orange-fg:  var(--au-cool);");
    expect(aurora).toContain("--tone-sky-fg:     #37C2C9;");
    expect(aurora).not.toContain("--rose:        var(--au-violet);");
    expect(aurora).not.toContain("--brand-orange:       var(--au-violet);");
  });
});
