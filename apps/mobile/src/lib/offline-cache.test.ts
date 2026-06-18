import { beforeEach, describe, expect, it, vi } from "vitest";

const storage = new Map<string, string>();

vi.mock("@react-native-async-storage/async-storage", () => ({
  default: {
    getItem: vi.fn((key: string) => Promise.resolve(storage.get(key) ?? null)),
    setItem: vi.fn((key: string, value: string) => {
      storage.set(key, value);
      return Promise.resolve();
    }),
    removeItem: vi.fn((key: string) => {
      storage.delete(key);
      return Promise.resolve();
    }),
    getAllKeys: vi.fn(() => Promise.resolve([...storage.keys()])),
    multiRemove: vi.fn((keys: string[]) => {
      keys.forEach((k) => storage.delete(k));
      return Promise.resolve();
    }),
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  OFFLINE_CACHE_PREFIX,
  asArray,
  asObject,
  clearAllOfflineCaches,
  peekOfflineCache,
  readOfflineCache,
  writeOfflineCache,
} from "./offline-cache";

describe("offline-cache", () => {
  beforeEach(async () => {
    storage.clear();
    vi.clearAllMocks();
    await clearAllOfflineCaches();
    storage.clear();
    vi.clearAllMocks();
  });

  it("round-trips an array payload and stamps updatedAt", async () => {
    const now = new Date("2026-06-11T10:00:00.000Z");
    const ok = await writeOfflineCache("services", [{ id: "s1" }, { id: "s2" }], now);
    expect(ok).toBe(true);

    const entry = await readOfflineCache("services", asArray);
    expect(entry).not.toBeNull();
    expect(entry?.data).toEqual([{ id: "s1" }, { id: "s2" }]);
    expect(entry?.updatedAt).toBe("2026-06-11T10:00:00.000Z");
  });

  it("namespaces keys under the offline prefix", async () => {
    await writeOfflineCache("moving", [1, 2, 3]);
    expect(storage.has(`${OFFLINE_CACHE_PREFIX}moving`)).toBe(true);
  });

  it("returns null when nothing was persisted", async () => {
    expect(await readOfflineCache("services", asArray)).toBeNull();
  });

  it("returns null on a corrupt (non-JSON) payload instead of throwing", async () => {
    storage.set(`${OFFLINE_CACHE_PREFIX}services`, "{not valid json");
    expect(await readOfflineCache("services", asArray)).toBeNull();
  });

  it("rejects a wrong-version envelope (old shape) as null", async () => {
    storage.set(
      `${OFFLINE_CACHE_PREFIX}services`,
      JSON.stringify({ v: 99, updatedAt: "2026-01-01T00:00:00.000Z", data: [1] }),
    );
    expect(await readOfflineCache("services", asArray)).toBeNull();
  });

  it("returns null when the sanitizer rejects the data", async () => {
    await writeOfflineCache("services", { not: "an array" });
    expect(await readOfflineCache("services", asArray)).toBeNull();
  });

  it("supports a custom sanitizer that reshapes the payload", async () => {
    await writeOfflineCache("services", { services: [{ id: "a" }], addresses: [] });
    const entry = await readOfflineCache("services", (raw) => {
      if (typeof raw !== "object" || raw === null) return null;
      const o = raw as Record<string, unknown>;
      const services = asArray(o.services);
      const addresses = asArray(o.addresses);
      return services && addresses ? { services, addresses } : null;
    });
    expect(entry?.data).toEqual({ services: [{ id: "a" }], addresses: [] });
  });

  it("peeks the in-memory cache synchronously after a successful write", async () => {
    const now = new Date("2026-06-18T10:00:00.000Z");
    await writeOfflineCache("detail.service.svc_1", { id: "svc_1", providerName: "Water" }, now);
    storage.clear();

    const entry = peekOfflineCache("detail.service.svc_1", asObject);

    expect(entry?.data).toEqual({ id: "svc_1", providerName: "Water" });
    expect(entry?.updatedAt).toBe("2026-06-18T10:00:00.000Z");
  });

  it("accepts object payloads and rejects arrays for detail caches", async () => {
    await writeOfflineCache("detail.address.addr_1", { id: "addr_1" });
    await writeOfflineCache("detail.address.bad", [{ id: "addr_1" }]);

    expect((await readOfflineCache("detail.address.addr_1", asObject))?.data).toEqual({ id: "addr_1" });
    expect(await readOfflineCache("detail.address.bad", asObject)).toBeNull();
  });

  it("clears every offline cache by prefix but leaves other keys", async () => {
    await writeOfflineCache("services", [1]);
    await writeOfflineCache("moving", [2]);
    storage.set("locateflow.unrelated", "keep-me");

    await clearAllOfflineCaches();

    expect(await readOfflineCache("services", asArray)).toBeNull();
    expect(await readOfflineCache("moving", asArray)).toBeNull();
    expect(peekOfflineCache("services", asArray)).toBeNull();
    expect(peekOfflineCache("moving", asArray)).toBeNull();
    expect(storage.get("locateflow.unrelated")).toBe("keep-me");
  });

  it("returns false (never throws) when the write fails", async () => {
    (AsyncStorage.setItem as any).mockRejectedValueOnce(new Error("disk full"));
    expect(await writeOfflineCache("services", [1])).toBe(false);
  });

  it("returns null (never throws) when the read fails", async () => {
    (AsyncStorage.getItem as any).mockRejectedValueOnce(new Error("io error"));
    expect(await readOfflineCache("services", asArray)).toBeNull();
  });

  it("does not throw when clearing fails", async () => {
    (AsyncStorage.getAllKeys as any).mockRejectedValueOnce(new Error("io error"));
    await expect(clearAllOfflineCaches()).resolves.toBeUndefined();
  });
});
