import { describe, expect, it } from "vitest";

import {
  compareCoverageConfidence,
  getCurrentProductCopy,
  getCoverageConfidencePresentation,
  getManualTrackingDisclaimer,
  getMoveTaskEffectPresentation,
  getMoveTaskSourcePresentation,
  getMoveTaskStatusPresentation,
  getMoveTransitionActionPresentation,
  getProviderTrustPresentation,
  getTaskCompletionDisclaimer,
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

  it("formats user-created provider trust without verification claims", () => {
    const trust = getProviderTrustPresentation("USER_CUSTOM");

    expect(trust.label).toBe("User-added provider");
    expect(trust.canClaimVerified).toBe(false);
    expect(trust.description).toContain("private provider record");
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

  it("keeps explicit unknown coverage unknown even for polygon/live-address models", () => {
    expect(
      mapCoverageMatchToConfidence("unknown", { coverageModel: "polygon" }),
    ).toBe("UNKNOWN");
    expect(
      mapCoverageMatchToConfidence("unknown", { requiresAddressCheck: true }),
    ).toBe("UNKNOWN");
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

  it("formats move task lifecycle labels with local-only completion copy", () => {
    expect(getMoveTaskStatusPresentation("COMPLETED").description).toContain(
      "No external provider update",
    );
    expect(getMoveTaskSourcePresentation("CLASSIFIER").description).toContain(
      "deterministic",
    );
    expect(
      getMoveTaskEffectPresentation("MARK_AVAILABILITY_VERIFIED_BY_USER")
        .description,
    ).toContain("not official source verification");
  });

  it("exposes shared current-product caveat copy", () => {
    expect(getCurrentProductCopy("LISTED_PROVIDER")).toBe("Listed provider");
    expect(getManualTrackingDisclaimer()).toContain("Manual tracking only");
    expect(getManualTrackingDisclaimer()).toContain(
      "No automatic account update",
    );
    expect(getTaskCompletionDisclaimer()).toContain(
      "updates Move only",
    );
  });

  it("identifies address-sensitive provider categories", () => {
    expect(isCoverageAddressSensitive("UTILITY_ELECTRIC")).toBe(true);
    expect(isCoverageAddressSensitive("TRANSPORTATION_TRANSIT")).toBe(true);
    expect(isCoverageAddressSensitive("FINANCIAL_BANK")).toBe(false);
  });
});
