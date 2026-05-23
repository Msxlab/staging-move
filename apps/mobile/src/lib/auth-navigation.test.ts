import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("mobile auth navigation", () => {
  it("registers the OAuth password setup screen in the root stack", () => {
    const layout = readFileSync(join(process.cwd(), "app/_layout.tsx"), "utf8");

    expect(layout).toContain('name="setup-password"');
  });
});
