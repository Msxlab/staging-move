import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("service worker emergency shutoff", () => {
  it("keeps the worker disabled and avoids unregistering on every fetch", () => {
    const sw = read("public/sw.js");

    expect(sw).toContain("DISABLE_SERVICE_WORKER = true");
    expect(sw).toContain("let unregisterAttempted = false");
    expect(sw).toContain("self.clients.claim()");
    expect(sw).toContain("if (!unregisterAttempted)");
  });

  it("unregisters existing workers without registering a replacement", () => {
    const register = read("public/register-sw.js");

    expect(register).toContain("getRegistrations()");
    expect(register).toContain("registrations.length === 0 && cacheKeys.length === 0");
    expect(register).not.toContain(".register(");
  });

  it("does not run the PWA install prompt while the service worker is disabled", () => {
    const prompt = read("src/components/shared/install-prompt.tsx");

    expect(prompt).toContain("PWA_INSTALL_ENABLED = false");
    expect(prompt).toContain("if (!PWA_INSTALL_ENABLED) return");
  });
});
