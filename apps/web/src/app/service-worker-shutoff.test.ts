import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function read(path: string) {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("service worker enabled + auth-safe", () => {
  it("does not disable itself and never tries to unregister on every fetch", () => {
    const sw = read("public/sw.js");

    // The old emergency shutoff is gone: the worker is live, not self-disabling.
    expect(sw).not.toContain("DISABLE_SERVICE_WORKER = true");
    expect(sw).not.toContain("unregisterAttempted");
    expect(sw).not.toContain("self.registration.unregister()");
    // It claims clients normally as an enabled PWA shell.
    expect(sw).toContain("self.clients.claim()");
  });

  it("bypasses the data layer and every auth/onboarding/verify surface", () => {
    const sw = read("public/sw.js");

    expect(sw).toContain("BYPASS_PREFIXES");
    for (const prefix of [
      "/api/",
      "/sign-in",
      "/sign-up",
      "/onboarding",
      "/verify-email",
      "/reset-password",
      "/oauth",
    ]) {
      expect(sw).toContain(`"${prefix}"`);
    }
    // Bypassed requests are passed straight through (the worker returns without
    // calling respondWith for them).
    expect(sw).toContain("if (matchesPrefix(url.pathname, BYPASS_PREFIXES)) return;");
  });

  it("treats navigations as network-first with /offline only as an offline fallback", () => {
    const sw = read("public/sw.js");

    // Navigations go to the network first.
    expect(sw).toContain('request.mode === "navigate"');
    expect(sw).toContain("fetch(request).catch(");
    // The cached /offline page is the last-resort fallback on a genuine network
    // failure. Auth/onboarding/verify/api/oauth/portal are already bypassed
    // above, so only public + app pages can reach it, and /offline is a static
    // auth-free shell (no session/token/redirect) — safe for any of them.
    expect(sw).toContain('caches.match("/offline")');

    // HARD auth-safety guarantee: navigation HTML is NEVER cached. Isolate the
    // navigation branch and assert it neither stores nor reads cached document
    // HTML (only the static /offline shell, never the request itself).
    const navStart = sw.indexOf('request.mode === "navigate"');
    const navEnd = sw.indexOf("self.addEventListener(\"message\"");
    const navBranch = sw.slice(navStart, navEnd);
    expect(navBranch).not.toContain("cache.put");
    expect(navBranch).not.toContain("caches.match(request)");
  });

  it("never lets a bare-slash prefix match every path (offline-allowlist regression)", () => {
    const sw = read("public/sw.js");

    // A bare "/" prefix must match ONLY the exact root, or any allowlist using it
    // would match every route — the defect that served the offline shell to all
    // app routes. Lock in the exact-match guard in matchesPrefix.
    expect(sw).toContain('if (p === "/") return pathname === "/";');
  });

  it("register-sw.js registers the auth-safe worker at /sw.js", () => {
    const register = read("public/register-sw.js");

    expect(register).toContain(".register(");
    expect(register).toContain('"/sw.js"');
    // The old shutoff flow (unregister-and-never-replace) is gone.
    expect(register).not.toContain("registrations.length === 0 && cacheKeys.length === 0");
  });

  it("install prompt handles beforeinstallprompt AND keeps the native store path", () => {
    const prompt = read("src/components/shared/install-prompt.tsx");

    // Smart PWA install: the component drives the browser install dialog.
    expect(prompt).toContain("usePwaInstall");
    expect(prompt).toContain("canPromptInstall");
    expect(prompt).toContain("promptInstall");

    // Mobile/native path is still present (iOS App Store / Google Play).
    expect(prompt).toContain("@/lib/store-links");
    expect(prompt).toContain("IOS_APP_STORE_URL");
    expect(prompt).toContain("ANDROID_PLAY_STORE_URL");
    expect(prompt).toContain("WaitlistForm");

    // The beforeinstallprompt handling lives in usePwaInstall, which the prompt
    // consumes — assert the hook wires the event.
    const hook = read("src/lib/use-pwa-install.ts");
    expect(hook).toContain('addEventListener("beforeinstallprompt"');
    expect(hook).toContain(".prompt()");
  });
});
