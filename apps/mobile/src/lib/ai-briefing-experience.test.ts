import { describe, expect, it } from "vitest";
import {
  deriveMobileBriefingState,
  fallbackMobileBriefingState,
  shouldSkipMobileBriefingForInstallDismissal,
} from "./ai-briefing-experience";

describe("mobile ai briefing experience flag", () => {
  it("keeps the legacy install-level dismissal only in control", () => {
    expect(shouldSkipMobileBriefingForInstallDismissal("control", "true")).toBe(true);
    expect(shouldSkipMobileBriefingForInstallDismissal("variant", "true")).toBe(false);
  });

  it("keeps control behavior hidden when the briefing is unavailable", () => {
    expect(fallbackMobileBriefingState("control")).toBeNull();
    expect(deriveMobileBriefingState({ configured: false }, "control")).toBeNull();
    expect(deriveMobileBriefingState({ configured: true }, "control")).toBeNull();
  });

  it("renders fallback instead of permanent hide for keyless or missing-content variant states", () => {
    for (const payload of [{ configured: false }, { configured: true }, null]) {
      const state = deriveMobileBriefingState(payload, "variant");
      expect(state).toMatchObject({ aiGenerated: false, entitled: true });
      expect(state?.briefing).toContain("move command center");
    }
  });

  it("renders the existing paid teaser state for gated mobile users", () => {
    expect(deriveMobileBriefingState({ configured: true, entitled: false }, "variant")).toEqual({
      briefing: "",
      aiGenerated: false,
      entitled: false,
    });
    expect(deriveMobileBriefingState({ configured: true, upgradeRequired: true }, "variant")).toEqual({
      briefing: "",
      aiGenerated: false,
      entitled: false,
    });
  });
});
