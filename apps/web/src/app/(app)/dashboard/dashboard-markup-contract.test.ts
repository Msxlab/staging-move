import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

function readDashboardSource(relativePath: string): string {
  const cwd = process.cwd();
  const webRoot = cwd.endsWith(`${path.sep}apps${path.sep}web`) ? cwd : path.join(cwd, "apps", "web");
  return readFileSync(path.join(webRoot, "src", "app", "(app)", "dashboard", relativePath), "utf8");
}

function linkWrappedButtons(source: string): string[] {
  return source.match(/<Link\b(?:(?!<\/Link>)[\s\S])*<button\b/g) ?? [];
}

describe("dashboard CTA markup contract", () => {
  it("does not nest buttons inside links in dashboard widgets", () => {
    expect(linkWrappedButtons(readDashboardSource("dashboard-client.tsx"))).toEqual([]);
  });

  it("does not nest buttons inside links in the Move Command Center", () => {
    expect(linkWrappedButtons(readDashboardSource("move-command-center.tsx"))).toEqual([]);
  });
});
