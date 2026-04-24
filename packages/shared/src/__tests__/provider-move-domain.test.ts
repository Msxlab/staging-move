import { describe, expect, it } from "vitest";

import {
  compareCoverageConfidence,
  getCoverageConfidencePresentation,
  getMoveTransitionActionPresentation,
  getProviderTrustPresentation,
  isCoverageAddressSensitive,
  mapCoverageMatchToConfidence,
} from "../provider-move-domain";

describe("provider move domain helpers", () => {
  it("uses listed provider copy by default", () => {
    const trust = getProviderTrustPresentation(undefined);

    expect(trust.status).toBe("LISTED");
    expect(trust.label).toBe("Listed provider");
    expect(trust.canClaimVerified).toBe(false);
    expect(trust.description).toContain("manual tracking");
  });

  it("maps coverage match levels to shared confidence labels", () => {
    expect(mapCoverageMatchToConfidence("exact")).toBe("EXACT_ZIP");
    expect(mapCoverageMatchToConfidence("prefix")).toBe("ZIP_PREFIX");
    expect(mapCoverageMatchToConfidence("polygon")).toBe("MAPPED_SERVICE_AREA");
    expect(
      mapCoverageMatchToConfidence("state", { scope: "FEDERAL" }),
    ).toBe("NATIONAL_OR_FEDERAL");
    expect(mapCoverageMatchToConfidence("state", { scope: "STATE" })).toBe(
      "STATE_LEVEL",
    );
    expect(
      mapCoverageMatchToConfidence("state", { requiresAddressCheck: true }),
    ).toBe("ADDRESS_CHECK_REQUIRED");
  });

  it("orders coverage confidence from exact ZIP down to unknown", () => {
    const values = [
      "UNKNOWN",
      "STATE_LEVEL",
      "EXACT_ZIP",
      "NATIONAL_OR_FEDERAL",
    ] as const;

    expect([...values].sort(compareCoverageConfidence)).toEqual([
      "EXACT_ZIP",
      "STATE_LEVEL",
      "NATIONAL_OR_FEDERAL",
      "UNKNOWN",
    ]);
  });

  it("marks weak coverage labels as caveated", () => {
    expect(
      getCoverageConfidencePresentation("ADDRESS_CHECK_REQUIRED")
        .requiresCaveat,
    ).toBe(true);
    expect(getCoverageConfidencePresentation("UNKNOWN").label).toBe(
      "Coverage unverified",
    );
  });

  it("formats transition action labels without implying automation", () => {
    const forwarding = getMoveTransitionActionPresentation("MAIL_FORWARDING");

    expect(forwarding.label).toBe("Forward mail");
    expect(forwarding.description).toContain("manual");
    expect(forwarding.description).toContain("No connector execution");
  });

  it("identifies address-sensitive provider categories", () => {
    expect(isCoverageAddressSensitive("UTILITY_ELECTRIC")).toBe(true);
    expect(isCoverageAddressSensitive("TRANSPORTATION_TRANSIT")).toBe(true);
    expect(isCoverageAddressSensitive("FINANCIAL_BANK")).toBe(false);
  });
});
