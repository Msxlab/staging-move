import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = readFileSync(join(process.cwd(), "src/components/theme-provider.tsx"), "utf8");

describe("ThemeProvider defaults", () => {
  it("defaults fresh sessions to the dark Move Sapphire theme while keeping system opt-in available", () => {
    expect(source).toContain('defaultTheme="dark"');
    expect(source).toContain('enableSystem');
    expect(source).toContain('themes={["light", "dark", "system"]}');
  });
});
