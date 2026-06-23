import { describe, expect, it } from "vitest";
import { UPSELL_GATE_CODES, shouldSuppressUpsellGate } from "./subscription-gate";

describe("shouldSuppressUpsellGate", () => {
  it("never suppresses when consumer-free is off (flag-OFF parity)", () => {
    // With the flag OFF every gate code routes to the normal upsell/access path,
    // exactly as today.
    for (const code of UPSELL_GATE_CODES) {
      expect(shouldSuppressUpsellGate(code, false)).toBe(false);
    }
    expect(shouldSuppressUpsellGate("SERVICE_LIMIT_REACHED", false)).toBe(false);
  });

  it("suppresses a recognised gate code when consumer-free is on", () => {
    // A stale/cached gate response under consumer-free must not dead-end the
    // user at an un-buyable Upgrade CTA.
    for (const code of UPSELL_GATE_CODES) {
      expect(shouldSuppressUpsellGate(code, true)).toBe(true);
    }
  });

  it("does not suppress unrelated or missing codes even when free", () => {
    expect(shouldSuppressUpsellGate("DUPLICATE_ACTIVE_SERVICE", true)).toBe(false);
    expect(shouldSuppressUpsellGate(null, true)).toBe(false);
    expect(shouldSuppressUpsellGate(undefined, true)).toBe(false);
  });
});
