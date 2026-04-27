import { describe, expect, it } from "vitest";
import {
  ONBOARDING_MOVING_SKIPPED_EVENT,
  ONBOARDING_SERVICES_SKIPPED_EVENT,
  getOnboardingGateRedirect,
  getOnboardingProgress,
  summarizeOnboardingEvents,
} from "./onboarding-progress";

const base = {
  hasProfile: true,
  hasRequiredLegalConsents: true,
  addressCount: 1,
  serviceCount: 1,
  movingPlanCount: 1,
  servicesSkipped: false,
  movingSkipped: false,
  completedEvent: false,
};

describe("getOnboardingProgress", () => {
  it("starts new users at profile until profile and legal consent exist", () => {
    expect(getOnboardingProgress({ ...base, hasProfile: false }).step).toBe("profile");
    expect(getOnboardingProgress({ ...base, hasRequiredLegalConsents: false }).step).toBe("profile");
  });

  it("resumes address when profile exists but no address is saved", () => {
    expect(getOnboardingProgress({ ...base, addressCount: 0 })).toEqual({
      completed: false,
      step: "address",
      stepIndex: 1,
    });
  });

  it("resumes services when no service exists and services were not skipped", () => {
    expect(getOnboardingProgress({ ...base, serviceCount: 0 }).step).toBe("services");
  });

  it("moves past services when the user explicitly skipped provider selection", () => {
    expect(getOnboardingProgress({ ...base, serviceCount: 0, servicesSkipped: true, movingPlanCount: 0 }).step).toBe("moving");
  });

  it("completes onboarding after optional moving is skipped", () => {
    expect(getOnboardingProgress({ ...base, serviceCount: 0, servicesSkipped: true, movingPlanCount: 0, movingSkipped: true })).toEqual({
      completed: true,
      step: "complete",
      stepIndex: 4,
    });
  });

  it("honors the explicit completion event", () => {
    expect(getOnboardingProgress({ ...base, addressCount: 0, completedEvent: true }).completed).toBe(true);
  });

  it("does not let a completion event bypass the legal gate", () => {
    expect(getOnboardingProgress({
      ...base,
      hasRequiredLegalConsents: false,
      completedEvent: true,
    }).completed).toBe(false);
  });

  it("routes missing legal consent to the legal onboarding step", () => {
    expect(getOnboardingGateRedirect({ ...base, hasRequiredLegalConsents: false })).toBe(
      "/onboarding?step=legal",
    );
    expect(getOnboardingGateRedirect({ ...base, addressCount: 0 })).toBe("/onboarding");
    expect(getOnboardingGateRedirect(base)).toBeNull();
  });
});

describe("summarizeOnboardingEvents", () => {
  it("extracts persisted skip decisions from user events", () => {
    expect(
      summarizeOnboardingEvents([
        { event: ONBOARDING_SERVICES_SKIPPED_EVENT },
        { event: ONBOARDING_MOVING_SKIPPED_EVENT },
      ]),
    ).toEqual({
      servicesSkipped: true,
      movingSkipped: true,
      completedEvent: false,
    });
  });
});
