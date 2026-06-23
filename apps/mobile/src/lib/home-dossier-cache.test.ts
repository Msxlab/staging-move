import { beforeEach, describe, expect, it, vi } from "vitest";
import type { HomeDossierResponse } from "./home-dossier";

const { storage, apiGet } = vi.hoisted(() => ({
  storage: new Map<string, string>(),
  apiGet: vi.fn(),
}));

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    getAllKeys: vi.fn(() => Promise.resolve([...storage.keys()])),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((k) => storage.delete(k));
      return Promise.resolve();
    }),
  },
}));

vi.mock("@/lib/api", () => ({
  api: { get: apiGet },
}));

import {
  clearHomeDossierCacheEpochForTests,
  clearHomeDossierMemoryCacheForTests,
  fetchHomeDossier,
  peekHomeDossierMemoryCache,
  readHomeDossierCache,
  writeHomeDossierCache,
} from "./home-dossier-cache";

function dossier(overrides: Partial<HomeDossierResponse> = {}): HomeDossierResponse {
  return {
    configured: true,
    address: { id: "addr_1", city: "Wayne", state: "NJ" },
    air: { status: "ok", aqi: 42, category: "Good" },
    housing: {
      status: "ok",
      zip: "07470",
      countyName: "Passaic County",
      metroName: "Bergen-Passaic, NJ HUD Metro FMR Area",
      areaName: "Bergen-Passaic, NJ HUD Metro FMR Area",
      fairMarketRent: {
        year: 2026,
        oneBedroom: 2100,
        twoBedroom: 2660,
        threeBedroom: 3300,
        fourBedroom: 3900,
        zipSpecific: false,
      },
      incomeLimits: {
        year: 2026,
        medianIncome: 139100,
        lowIncome4Person: 108400,
      },
    },
    ...overrides,
  };
}

describe("home-dossier-cache", () => {
  beforeEach(() => {
    storage.clear();
    apiGet.mockReset();
    clearHomeDossierMemoryCacheForTests();
    clearHomeDossierCacheEpochForTests();
  });

  it("serves a fresh summary cache without calling the API", async () => {
    await writeHomeDossierCache("addr_1", "summary", dossier());

    const result = await fetchHomeDossier("addr_1", "summary");

    expect(apiGet).not.toHaveBeenCalled();
    expect(result.fromCache).toBe(true);
    expect(result.data?.air?.aqi).toBe(42);
  });

  it("lets a full dossier payload satisfy the current-home summary", async () => {
    await writeHomeDossierCache("addr_1", "full", dossier({ flood: { status: "ok", zone: "X", isHighRisk: false } }));

    const cached = await readHomeDossierCache("addr_1", "summary");

    expect(cached?.data.flood?.zone).toBe("X");
    expect(cached?.data.housing?.fairMarketRent?.twoBedroom).toBe(2660);
  });

  it("can synchronously hydrate mobile cards from memory cache", async () => {
    await writeHomeDossierCache("addr_1", "full", dossier({ flood: { status: "ok", zone: "X", isHighRisk: false } }));

    const full = peekHomeDossierMemoryCache("addr_1", "full");
    const summary = peekHomeDossierMemoryCache("addr_1", "summary");

    expect(full?.source).toBe("memory");
    expect(full?.data.flood?.zone).toBe("X");
    expect(summary?.source).toBe("memory");
    expect(summary?.data.housing?.fairMarketRent?.twoBedroom).toBe(2660);
  });

  it("marks synchronous memory snapshots stale without hiding them", async () => {
    const staleWrittenAt = new Date(Date.now() - 31 * 60 * 1000);
    await writeHomeDossierCache("addr_1", "full", dossier(), staleWrittenAt);

    const cached = peekHomeDossierMemoryCache("addr_1", "full");

    expect(cached?.stale).toBe(true);
    expect(cached?.data.air?.category).toBe("Good");
  });

  it("does not let a summary payload replace a full dossier fetch", async () => {
    await writeHomeDossierCache("addr_1", "summary", dossier());
    apiGet.mockResolvedValueOnce({
      data: dossier({ flood: { status: "ok", zone: "AE", isHighRisk: true } }),
      error: false,
    });

    const result = await fetchHomeDossier("addr_1", "full");

    expect(apiGet).toHaveBeenCalledWith("/api/addresses/addr_1/dossier", undefined);
    expect(result.fromCache).toBe(false);
    expect(result.data?.flood?.zone).toBe("AE");
  });

  it("falls back to stale cached data when the refresh fails", async () => {
    const staleWrittenAt = new Date(Date.now() - 31 * 60 * 1000);
    await writeHomeDossierCache("addr_1", "summary", dossier(), staleWrittenAt);
    apiGet.mockResolvedValueOnce({ data: null, error: true });

    const result = await fetchHomeDossier("addr_1", "summary");

    expect(apiGet).toHaveBeenCalledWith("/api/addresses/addr_1/dossier", { summary: "1" });
    expect(result.error).toBe(true);
    expect(result.fromCache).toBe(true);
    expect(result.stale).toBe(true);
    expect(result.data?.air?.category).toBe("Good");
  });

  // ── H7: cache epoch keyed on the entitlement gate ──────────────────────────
  describe("H7 gate-derived cache epoch", () => {
    it("flag-OFF byte-identical: a stable gate keeps serving the same entry, no extra fetch", async () => {
      // An entitled (full) dossier is the steady state for a paid user with the
      // CONSUMER_FREE flag OFF. Writing then fetching must hit cache exactly as
      // before the epoch existed — proving the default suffix ("") is inert.
      await writeHomeDossierCache("addr_1", "full", dossier({ entitled: true }));

      const result = await fetchHomeDossier("addr_1", "full");

      expect(apiGet).not.toHaveBeenCalled();
      expect(result.fromCache).toBe(true);
      expect(result.data?.air?.aqi).toBe(42);
    });

    it("a gated teaser cached before a flip is NOT served once a full dossier re-keys the cache", async () => {
      // Pre-flip: server returns a locked teaser → cached under the gated epoch.
      const teaser = dossier({ entitled: false, upgradeRequired: true });
      await writeHomeDossierCache("addr_1", "full", teaser);
      expect((await readHomeDossierCache("addr_1", "full"))?.data.entitled).toBe(false);

      // Flip ON (server now resolves the same address to the full dossier). A
      // forced refresh writes the entitled payload, which advances the gate
      // epoch so the old teaser key is abandoned.
      clearHomeDossierMemoryCacheForTests();
      apiGet.mockResolvedValueOnce({
        data: dossier({ entitled: true, flood: { status: "ok", zone: "AE", isHighRisk: true } }),
        error: false,
      });
      const refreshed = await fetchHomeDossier("addr_1", "full", { force: true });
      expect(refreshed.data?.entitled).toBe(true);
      expect(refreshed.data?.flood?.zone).toBe("AE");

      // The teaser still physically exists under its old (gated) key, but the
      // current (entitled) epoch never reads it — a fresh read returns the full
      // dossier, never the stale teaser.
      clearHomeDossierMemoryCacheForTests();
      const afterFlip = await readHomeDossierCache("addr_1", "full");
      expect(afterFlip?.data.entitled).toBe(true);
      expect(afterFlip?.data.flood?.zone).toBe("AE");
    });
  });
});
