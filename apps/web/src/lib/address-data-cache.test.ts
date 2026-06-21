import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  findUnique: vi.fn(),
  upsert: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    addressDataCacheEntry: {
      findUnique: (...a: unknown[]) => mocks.findUnique(...a),
      upsert: (...a: unknown[]) => mocks.upsert(...a),
    },
  },
}));

import { buildGeoKey, getOrFetchSection } from "./address-data-cache";

const NOW = 1_750_000_000_000;

describe("address-data-cache", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.findUnique.mockResolvedValue(null);
    mocks.upsert.mockResolvedValue({});
  });

  it("serves a fresh REAL entry from cache without calling upstream (HIT)", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "REAL",
      dataJson: JSON.stringify({ zone: "X" }),
      expiresAt: new Date(NOW + 1000),
    });
    const fetcher = vi.fn();
    const res = await getOrFetchSection({ section: "FLOOD", lat: 40.7128, lng: -74.006, fetcher, now: NOW });

    expect(res).toEqual({ data: { zone: "X" }, cache: "HIT" });
    expect(fetcher).not.toHaveBeenCalled();
    expect(mocks.upsert).not.toHaveBeenCalled();
  });

  it("re-fetches and persists when the entry is expired (RETRY)", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "REAL",
      dataJson: JSON.stringify({ zone: "OLD" }),
      expiresAt: new Date(NOW - 1),
    });
    const fetcher = vi.fn().mockResolvedValue({ data: { zone: "NEW" }, status: "REAL" });
    const res = await getOrFetchSection({ section: "FLOOD", lat: 40.7128, lng: -74.006, fetcher, now: NOW });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(res).toEqual({ data: { zone: "NEW" }, cache: "RETRY" });
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it("re-fetches a non-expired but non-REAL entry (retry-if-not-real)", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "DEGRADED",
      dataJson: JSON.stringify(null),
      expiresAt: new Date(NOW + 100_000),
    });
    const fetcher = vi.fn().mockResolvedValue({ data: { zone: "X" }, status: "REAL" });
    const res = await getOrFetchSection({ section: "FLOOD", lat: 1, lng: 2, fetcher, now: NOW });

    expect(fetcher).toHaveBeenCalledOnce();
    expect(res.cache).toBe("RETRY");
  });

  it("fetches and persists on a cold miss (MISS)", async () => {
    const fetcher = vi.fn().mockResolvedValue({ data: { aqi: 42 }, status: "REAL" });
    const res = await getOrFetchSection({ section: "AIR", lat: 1, lng: 2, fetcher, now: NOW });

    expect(res).toEqual({ data: { aqi: 42 }, cache: "MISS" });
    expect(mocks.upsert).toHaveBeenCalledOnce();
  });

  it("falls back to a stale row when the fetcher throws (STALE)", async () => {
    mocks.findUnique.mockResolvedValue({
      status: "REAL",
      dataJson: JSON.stringify({ zone: "OLD" }),
      expiresAt: new Date(NOW - 1),
    });
    const fetcher = vi.fn().mockRejectedValue(new Error("upstream down"));
    const res = await getOrFetchSection({ section: "FLOOD", lat: 1, lng: 2, fetcher, now: NOW });

    expect(res).toEqual({ data: { zone: "OLD" }, cache: "STALE" });
  });

  it("propagates the error on a cold miss when the fetcher throws", async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error("upstream down"));
    await expect(
      getOrFetchSection({ section: "FLOOD", lat: 1, lng: 2, fetcher, now: NOW }),
    ).rejects.toThrow("upstream down");
  });

  it("rounds coordinates so nearby points share a cache cell", () => {
    expect(buildGeoKey("FLOOD", 40.7128, -74.00601)).toBe(buildGeoKey("FLOOD", 40.712804, -74.006013));
    expect(buildGeoKey("WEATHER", 40.0, -74.0, "2026-07-02")).toContain(":2026-07-02");
  });
});
