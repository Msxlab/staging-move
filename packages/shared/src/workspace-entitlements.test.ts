import { describe, expect, it } from "vitest";
import { overflowCount, planFeatures, seatLimitForPlan } from "./workspace-entitlements";

describe("planFeatures", () => {
  it("Pro unlocks everything with 10 seats", () => {
    const f = planFeatures("PRO");
    expect(f).toMatchObject({ seatLimit: 10, apiConnectors: true, partnerHub: true, advancedExport: true });
  });

  it("Family: 6 seats, manual connectors + labels, no API connectors / Partner Hub", () => {
    const f = planFeatures("FAMILY");
    expect(f).toMatchObject({ seatLimit: 6, apiConnectors: false, manualConnectors: true, partnerHub: false, addressLabels: true });
  });

  it("Individual is solo with manual connectors only", () => {
    const f = planFeatures("INDIVIDUAL");
    expect(f.seatLimit).toBe(1);
    expect(f.manualConnectors).toBe(true);
    expect(f.apiConnectors).toBe(false);
  });

  it("unknown / null plan falls back to the Free Trial floor", () => {
    expect(planFeatures(null).seatLimit).toBe(1);
    expect(planFeatures("WHATEVER").manualConnectors).toBe(false);
  });

  it("AI briefing matrix: Family + Pro only (Individual loses it; cap is cost control, not a tier line)", () => {
    expect(planFeatures("PRO").aiBriefing).toBe(true);
    expect(planFeatures("FAMILY").aiBriefing).toBe(true);
    expect(planFeatures("INDIVIDUAL").aiBriefing).toBe(false);
    expect(planFeatures("FREE_TRIAL").aiBriefing).toBe(false);
    // Unknown / missing plans fall to the Free Trial floor (no AI briefing).
    expect(planFeatures(null).aiBriefing).toBe(false);
    expect(planFeatures("WHATEVER").aiBriefing).toBe(false);
  });

  it("Home Dossier matrix: Individual and up, free trial no", () => {
    expect(planFeatures("PRO").homeDossier).toBe(true);
    expect(planFeatures("FAMILY").homeDossier).toBe(true);
    expect(planFeatures("INDIVIDUAL").homeDossier).toBe(true);
    expect(planFeatures("FREE_TRIAL").homeDossier).toBe(false);
    expect(planFeatures("FREE_TRIAL").homeDossierPreview).toBe(true);
    // Unknown / missing plans fall to the Free Trial floor (no dossier).
    expect(planFeatures(null).homeDossier).toBe(false);
    expect(planFeatures(null).homeDossierPreview).toBe(true);
    expect(planFeatures("WHATEVER").homeDossier).toBe(false);
    expect(planFeatures("WHATEVER").homeDossierPreview).toBe(true);
  });

  it("Pro-only differentiators: movers, priority support, multi-plan", () => {
    expect(planFeatures("PRO").moverSuggestions).toBe(true);
    expect(planFeatures("FAMILY").moverSuggestions).toBe(false);
    expect(planFeatures("INDIVIDUAL").dossierPdf).toBe(true);
    expect(planFeatures("FAMILY").dossierPdf).toBe(true);
    expect(planFeatures("PRO").dossierPdf).toBe(true);
    expect(planFeatures("FREE_TRIAL").dossierPdf).toBe(false);
    expect(planFeatures("PRO").prioritySupport).toBe(true);
    expect(planFeatures("PRO").concurrentPlanLimit).toBe(3);
    expect(planFeatures("FAMILY").concurrentPlanLimit).toBe(1);
  });

  it("Neighborhood Intelligence matrix: Pro only (everyone else, including unknown, no)", () => {
    expect(planFeatures("PRO").neighborhoodIntel).toBe(true);
    expect(planFeatures("FAMILY").neighborhoodIntel).toBe(false);
    expect(planFeatures("INDIVIDUAL").neighborhoodIntel).toBe(false);
    expect(planFeatures("FREE_TRIAL").neighborhoodIntel).toBe(false);
    expect(planFeatures(null).neighborhoodIntel).toBe(false);
    expect(planFeatures("WHATEVER").neighborhoodIntel).toBe(false);
  });

  it("VIN check + weather/digest: Individual and up; real map: Family and up", () => {
    expect(planFeatures("INDIVIDUAL").vehicleCheck).toBe(true);
    expect(planFeatures("FREE_TRIAL").vehicleCheck).toBe(false);
    expect(planFeatures("INDIVIDUAL").weatherDigest).toBe(true);
    expect(planFeatures("FREE_TRIAL").weatherDigest).toBe(false);
    expect(planFeatures("INDIVIDUAL").realMap).toBe(false);
    expect(planFeatures("FAMILY").realMap).toBe(true);
  });
});

describe("seatLimitForPlan", () => {
  it("matches the plan ceilings", () => {
    expect(seatLimitForPlan("PRO")).toBe(10);
    expect(seatLimitForPlan("FAMILY")).toBe(6);
    expect(seatLimitForPlan("INDIVIDUAL")).toBe(1);
    expect(seatLimitForPlan(undefined)).toBe(1);
  });
});

describe("overflowCount", () => {
  it("counts members beyond the seat limit", () => {
    expect(overflowCount("FAMILY", 8)).toBe(2);
    expect(overflowCount("PRO", 5)).toBe(0);
    expect(overflowCount("INDIVIDUAL", 1)).toBe(0);
  });
});
