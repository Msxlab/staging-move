import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import { execSync } from "child_process";

/**
 * Regression guard for the CSRF middleware contract: every web-side DELETE
 * fetch must send `Content-Type: application/json`. The middleware
 * (apps/web/src/middleware.ts applyCsrfCheck) rejects mutating API requests
 * without `application/json` or `multipart/form-data`. A bare
 * `fetch(url, { method: "DELETE" })` therefore round-trips as 403
 * INVALID_CONTENT_TYPE.
 */

const REPO_ROOT = path.resolve(__dirname, "../../../..");
const WEB_SRC = path.resolve(__dirname, "..");

function listFiles(): string[] {
  // Use git ls-files so we never accidentally scan node_modules or build output.
  const out = execSync("git ls-files apps/web/src", {
    cwd: REPO_ROOT,
    encoding: "utf-8",
  });
  return out
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.endsWith(".ts") || line.endsWith(".tsx"));
}

function isFetchDeleteCallSite(line: string): boolean {
  return /method:\s*["']DELETE["']/.test(line);
}

describe("DELETE fetch callers send Content-Type: application/json", () => {
  const offenders: Array<{ file: string; line: number; snippet: string }> = [];
  const files = listFiles();

  for (const relPath of files) {
    if (relPath.endsWith(".test.ts") || relPath.endsWith(".test.tsx")) continue;
    // r2-client signs S3 requests directly; that DELETE is authenticated by
    // AWS SigV4 and never goes through the web app's CSRF middleware.
    if (relPath.includes("storage/r2-client")) continue;

    const abs = path.resolve(REPO_ROOT, relPath);
    const source = readFileSync(abs, "utf-8");
    const lines = source.split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      if (!isFetchDeleteCallSite(lines[i])) continue;
      const window = lines.slice(Math.max(0, i - 6), Math.min(lines.length, i + 7)).join("\n");
      if (!/["']Content-Type["']\s*:\s*["']application\/json["']/i.test(window)) {
        offenders.push({
          file: path.relative(WEB_SRC, abs),
          line: i + 1,
          snippet: lines[i].trim(),
        });
      }
    }
  }

  it("has no DELETE fetch sites without an application/json content type nearby", () => {
    expect(offenders).toEqual([]);
  });
});
