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
  },
}));

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  LAST_PLAN_CACHE_KEY,
  clearLastPlanHint,
  persistLastPlanHint,
  readLastPlanHint,
} from "./last-plan-cache";

describe("last-plan-cache", () => {
  beforeEach(() => {
    storage.clear();
    vi.clearAllMocks();
  });

  it("round-trips a written premium hint", async () => {
    const ok = await persistLastPlanHint({ premium: true, planTier: "PRO" });
    expect(ok).toBe(true);

    const read = await readLastPlanHint();
    expect(read).toEqual({ premium: true, planTier: "PRO" });
  });

  it("round-trips a free hint and normalizes a blank tier to null", async () => {
    await persistLastPlanHint({ premium: false, planTier: "   " });
    const read = await readLastPlanHint();
    expect(read).toEqual({ premium: false, planTier: null });
  });

  it("returns null when nothing has been persisted", async () => {
    expect(await readLastPlanHint()).toBeNull();
  });

  it("returns null on a corrupt (non-JSON) payload instead of throwing", async () => {
    storage.set(LAST_PLAN_CACHE_KEY, "{not valid json");
    expect(await readLastPlanHint()).toBeNull();
  });

  it("returns null when the parsed payload is missing a boolean premium flag", async () => {
    // An old / malformed shape (premium stored as a string) must be rejected so
    // the dashboard falls back to the neutral skeleton rather than a bad hint.
    storage.set(LAST_PLAN_CACHE_KEY, JSON.stringify({ premium: "yes", planTier: "PRO" }));
    expect(await readLastPlanHint()).toBeNull();
  });

  it("returns null when the parsed payload is not an object", async () => {
    storage.set(LAST_PLAN_CACHE_KEY, JSON.stringify("FAMILY"));
    expect(await readLastPlanHint()).toBeNull();
  });

  it("coerces a non-string planTier to null but keeps a valid premium flag", async () => {
    storage.set(LAST_PLAN_CACHE_KEY, JSON.stringify({ premium: true, planTier: 42 }));
    expect(await readLastPlanHint()).toEqual({ premium: true, planTier: null });
  });

  it("hardens premium to a strict boolean on write", async () => {
    // A truthy-but-not-true value must serialize as false, never leak through.
    await persistLastPlanHint({ premium: 1 as unknown as boolean, planTier: "PRO" });
    expect(await readLastPlanHint()).toEqual({ premium: false, planTier: "PRO" });
  });

  it("clears the persisted hint", async () => {
    await persistLastPlanHint({ premium: true, planTier: "FAMILY" });
    await clearLastPlanHint();
    expect(await readLastPlanHint()).toBeNull();
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith(LAST_PLAN_CACHE_KEY);
  });

  it("returns false (never throws) when the write fails", async () => {
    (AsyncStorage.setItem as any).mockRejectedValueOnce(new Error("disk full"));
    expect(await persistLastPlanHint({ premium: true, planTier: "PRO" })).toBe(false);
  });

  it("returns null (never throws) when the read fails", async () => {
    (AsyncStorage.getItem as any).mockRejectedValueOnce(new Error("io error"));
    expect(await readLastPlanHint()).toBeNull();
  });
});
