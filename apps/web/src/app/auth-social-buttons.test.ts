import { readFileSync } from "fs";
import { join } from "path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("auth social button styling", () => {
  it("keeps Google and Apple buttons legible in light and dark themes", () => {
    const signIn = read("src/app/sign-in/page.tsx");
    const signUp = read("src/app/sign-up/page.tsx");
    const combined = `${signIn}\n${signUp}`;

    expect(combined).toContain("bg-white");
    expect(combined).toContain("text-slate-950");
    expect(combined).toContain("border border-slate-300");
    expect(combined).toContain("hover:border-slate-400");
    expect(combined).toContain("disabled:bg-slate-100");
    expect(combined).toContain("dark:bg-white");
    expect(combined).toContain("disabled:opacity-100");
    expect(combined).toContain("googleUnavailable");
    expect(combined).toContain("appleUnavailable");
    expect(combined).not.toContain("bg-black bg-gradient-to-b");
    expect(combined).not.toContain("from-zinc-800");
    expect(combined).not.toContain("disabled:opacity-60");
  });
});
