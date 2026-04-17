import { describe, it, expect } from "vitest";
import { CATEGORY_META, PROVIDER_CATEGORY_VALUES } from "../recommendation-engine";

describe("category taxonomy", () => {
  it("every PROVIDER_CATEGORY_VALUES entry has matching CATEGORY_META", () => {
    const missing = PROVIDER_CATEGORY_VALUES.filter((v) => !CATEGORY_META[v]);
    expect(missing).toEqual([]);
  });

  it("CATEGORY_META has no orphan keys outside PROVIDER_CATEGORY_VALUES", () => {
    const canonical = new Set<string>(PROVIDER_CATEGORY_VALUES);
    const orphans = Object.keys(CATEGORY_META).filter((k) => !canonical.has(k));
    expect(orphans).toEqual([]);
  });

  it("CATEGORY_META orders are unique", () => {
    const orders = Object.values(CATEGORY_META).map((m) => m.order);
    const unique = new Set(orders);
    expect(unique.size).toBe(orders.length);
  });

  it("every CATEGORY_META entry has non-empty label and icon", () => {
    for (const [key, meta] of Object.entries(CATEGORY_META)) {
      expect(meta.label, `${key} missing label`).toBeTruthy();
      expect(meta.icon, `${key} missing icon`).toBeTruthy();
    }
  });
});
