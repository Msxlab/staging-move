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
});
