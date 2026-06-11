import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import en from "@/i18n/messages/en.json";
import es from "@/i18n/messages/es.json";

const here = dirname(fileURLToPath(import.meta.url));
const clientSource = readFileSync(resolve(here, "movers-client.tsx"), "utf8");
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

describe("licensed movers admin page", () => {
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

  it("only ever issues corrections PATCHes — no create/delete and no ETL trigger", () => {
    // The catalog is ETL-owned: the client must not POST/PUT/DELETE, and
    // must not pretend to trigger an import (the FMCSA census download is
    // form-gated, so the script only runs locally against a CSV).
    expect(clientSource).toContain('method: "PATCH"');
    expect(clientSource).not.toContain('"POST"');
    expect(clientSource).not.toContain('"PUT"');
    expect(clientSource).not.toContain('"DELETE"');
    expect(clientSource).not.toMatch(/fetch\([^)]*etl/i);
  });

  it("never sends ETL-owned identity fields in the corrections payload", () => {
    const payloadBuilder = clientSource.slice(
      clientSource.indexOf("function buildCorrectionsPayload"),
      clientSource.indexOf("function moverDisplayName"),
    );
    expect(payloadBuilder.length).toBeGreaterThan(0);
    for (const field of ["usdotNumber", "legalName", "dbaName", "hhgAuthorization", "fleetSize", "dataAsOf"]) {
      expect(payloadBuilder, `payload must not contain ${field}`).not.toContain(field);
    }
  });

  it("derives last-import metadata from the rows instead of an import log", () => {
    // The freshness strip is honest: max(dataAsOf) + counts from the API,
    // and it degrades gracefully (null hides the strip, list still works).
    expect(clientSource).toContain("data.freshness ?? null");
    expect(clientSource).toContain("newestDataAsOf");
    expect(clientSource).toContain("statesCovered");
  });

  it("explains the ETL in the empty state with the script path, in both locales", () => {
    expect(clientSource).toContain('t("empty.description")');
    expect(en.movers.empty.description).toBe(
      "Catalog is filled by scripts/etl-fmcsa-movers.mjs — download the FMCSA census CSV and run it; see script header.",
    );
    expect(es.movers.empty.description).toContain("scripts/etl-fmcsa-movers.mjs");
    expect(es.movers.empty.description).toContain("FMCSA");
  });

  it("keeps en/es movers catalogs in key parity", () => {
    const enKeys = leafPaths((en as any).movers).sort();
    const esKeys = leafPaths((es as any).movers).sort();
    expect(enKeys.length).toBeGreaterThan(0);
    expect(esKeys).toEqual(enKeys);
  });

  it("uses only catalogued message keys (every static t() call resolves in en.json)", () => {
    const known = new Set(leafPaths((en as any).movers));
    const staticCalls = [...clientSource.matchAll(/\bt\("([^"]+)"/g)].map((m) => m[1]);
    expect(staticCalls.length).toBeGreaterThan(0);
    for (const key of staticCalls) {
      expect(known.has(key), `en.movers.${key}`).toBe(true);
    }
    // Dynamic safety-rating keys.
    for (const rating of ["satisfactory", "conditional", "unsatisfactory"]) {
      expect(known.has(`safety.${rating}`), `en.movers.safety.${rating}`).toBe(true);
    }
  });

  it("has the nav entry catalogued in both locales", () => {
    expect((en as any).nav.movers).toBeTruthy();
    expect((es as any).nav.movers).toBeTruthy();
  });
});
