import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(resolve(here, "sponsored-client.tsx"), "utf8");
const pageSource = readFileSync(resolve(here, "page.tsx"), "utf8");

/** Collect dot-paths of every leaf string in a message subtree. */
function leafPaths(node: unknown, prefix = ""): string[] {
  if (typeof node === "string") return [prefix];
  if (node && typeof node === "object") {
    return Object.entries(node as Record<string, unknown>).flatMap(([key, value]) =>
      leafPaths(value, prefix ? `${prefix}.${key}` : key),
    );
  }
  return [];
}

describe("sponsored placements admin page", () => {
  it("guards the page server-side at providers:canRead before rendering", () => {
    expect(pageSource).toContain("requirePagePermission(\"providers\", \"canRead\"");
    expect(pageSource).toContain('export const dynamic = "force-dynamic"');
  });

  it("routes every mutation through the shared step-up modal", () => {
    expect(clientSource).toContain("PasswordConfirmModal");
    expect(clientSource).toContain("onConfirm={confirmMutation}");
    // Step-up credentials are merged into the captured mutation payload.
    expect(clientSource).toContain("body: JSON.stringify({ ...mutation.payload, ...stepUp })");
    // A 403 with requiresPassword keeps the modal open instead of closing it.
    expect(clientSource).toContain("requiresPassword");
    expect(clientSource).toContain("setMutationError(message)");
  });

  it("never sends impression/click counters in mutation payloads (read-only)", () => {
    const payloadBuilder = clientSource.slice(
      clientSource.indexOf("function buildPlacementPayload"),
      clientSource.indexOf("type PlacementStatus"),
    );
    expect(payloadBuilder.length).toBeGreaterThan(0);
    expect(payloadBuilder).not.toContain("impressions");
    expect(payloadBuilder).not.toContain("clicks");
  });

  it("renders the policy banner with the FTC / flag policy copy", () => {
    expect(clientSource).toContain('t("policyBanner")');
    expect(en.sponsored.policyBanner).toBe(
      "Sponsored placements render in a separate labeled slot, never inside organic rankings. SPONSORED_ENABLED runtime flag must be on; FTC clear-and-conspicuous labeling is mandatory.",
    );
    // The Spanish banner must carry the same non-negotiables.
    expect(es.sponsored.policyBanner).toContain("SPONSORED_ENABLED");
    expect(es.sponsored.policyBanner).toContain("FTC");
  });

  it("shows an honest SPONSORED_ENABLED status line in the policy banner", () => {
    // Resolved server-side via the admin runtime-config read path (the
    // /api/runtime-config catalog is SUPER_ADMIN-only; this page is VIEWER).
    expect(pageSource).toContain('getAdminRuntimeConfigValue("SPONSORED_ENABLED")');
    expect(pageSource).toContain("sponsoredEnabled={sponsoredEnabled}");
    // ON renders the mint (sage) pill; OFF renders the amber warning + a
    // link to Runtime Config where the flag lives.
    expect(clientSource).toContain('t("flag.on")');
    expect(clientSource).toContain('t("flag.off")');
    expect(clientSource).toContain('t("flag.offHint")');
    expect(clientSource).toContain('href="/runtime-config"');
    expect(clientSource).toContain("text-tone-sage-fg");
    expect(clientSource).toContain("text-tone-honey-fg");
    // A failed flag read degrades to no status line — never a wrong claim.
    expect(clientSource).toContain("sponsoredEnabled === null ? null :");
    // The OFF copy is explicit that nothing renders publicly.
    expect(en.sponsored.flag.offHint).toContain("placements will not render");
    expect(en.sponsored.flag.offHint).toContain("SPONSORED_ENABLED");
    expect(es.sponsored.flag.offHint).toContain("SPONSORED_ENABLED");
  });

  it("keeps en/es sponsored catalogs in key parity", () => {
    const enKeys = leafPaths((en as any).sponsored).sort();
    const esKeys = leafPaths((es as any).sponsored).sort();
    expect(enKeys.length).toBeGreaterThan(0);
    expect(esKeys).toEqual(enKeys);
  });

  it("uses only catalogued message keys (every static t() call resolves in en.json)", () => {
    const known = new Set(leafPaths((en as any).sponsored));
    const staticCalls = [...clientSource.matchAll(/\bt\("([^"]+)"/g)].map((m) => m[1]);
    expect(staticCalls.length).toBeGreaterThan(0);
    for (const key of staticCalls) {
      expect(known.has(key), `en.sponsored.${key}`).toBe(true);
    }
    // Dynamic kind/status keys.
    for (const kind of ["mover", "provider"]) {
      expect(known.has(`kind.${kind}`), `en.sponsored.kind.${kind}`).toBe(true);
    }
    for (const status of ["live", "scheduled", "expired", "inactive"]) {
      expect(known.has(`status.${status}`), `en.sponsored.status.${status}`).toBe(true);
    }
  });

  it("searches targets through the admin API, not a hand-rolled endpoint", () => {
    expect(clientSource).toContain("targetSearch: targetQuery.trim()");
    expect(clientSource).toContain("/api/sponsored");
  });
});
