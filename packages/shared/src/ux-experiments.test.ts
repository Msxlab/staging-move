import { describe, expect, it } from "vitest";
import {
  UX_AI_BRIEFING_EXPERIENCE_FLAG,
  UX_ONBOARDING_TEASER_FLAG,
  UX_TRUST_COPY_FLAG,
  getOnboardingTeaserPrimaryAction,
  resolveUxAiBriefingExperienceVariant,
  resolveUxOnboardingTeaserVariant,
  resolveUxTrustCopyVariant,
  shouldShowOnboardingTeaser,
} from "./ux-experiments";

describe("ux_ai_briefing_experience_v1 flag resolver", () => {
  it("defaults to control", () => {
    expect(UX_AI_BRIEFING_EXPERIENCE_FLAG).toBe("ux_ai_briefing_experience_v1");
    expect(resolveUxAiBriefingExperienceVariant(undefined)).toBe("control");
    expect(resolveUxAiBriefingExperienceVariant("")).toBe("control");
    expect(resolveUxAiBriefingExperienceVariant("control")).toBe("control");
  });

  it("recognizes the approved variant values", () => {
    expect(resolveUxAiBriefingExperienceVariant("variant")).toBe("variant");
    expect(resolveUxAiBriefingExperienceVariant("treatment")).toBe("variant");
    expect(resolveUxAiBriefingExperienceVariant("v1")).toBe("variant");
    expect(resolveUxAiBriefingExperienceVariant("true")).toBe("variant");
    expect(resolveUxAiBriefingExperienceVariant(true)).toBe("variant");
  });
});

describe("ux_trust_copy_v1 flag resolver", () => {
  it("defaults to control", () => {
    expect(UX_TRUST_COPY_FLAG).toBe("ux_trust_copy_v1");
    expect(resolveUxTrustCopyVariant(undefined)).toBe("control");
    expect(resolveUxTrustCopyVariant("")).toBe("control");
    expect(resolveUxTrustCopyVariant("control")).toBe("control");
  });

  it("recognizes the approved variant values", () => {
    expect(resolveUxTrustCopyVariant("variant")).toBe("variant");
    expect(resolveUxTrustCopyVariant("treatment")).toBe("variant");
    expect(resolveUxTrustCopyVariant("v1")).toBe("variant");
    expect(resolveUxTrustCopyVariant("true")).toBe("variant");
    expect(resolveUxTrustCopyVariant(true)).toBe("variant");
  });
});

describe("ux_onboarding_teaser_v1 flag resolver", () => {
  it("defaults to control", () => {
    expect(UX_ONBOARDING_TEASER_FLAG).toBe("ux_onboarding_teaser_v1");
    expect(resolveUxOnboardingTeaserVariant(undefined)).toBe("control");
    expect(resolveUxOnboardingTeaserVariant("")).toBe("control");
    expect(resolveUxOnboardingTeaserVariant("control")).toBe("control");
  });

  it("recognizes the approved variant values", () => {
    expect(resolveUxOnboardingTeaserVariant("variant")).toBe("variant");
    expect(resolveUxOnboardingTeaserVariant("treatment")).toBe("variant");
    expect(resolveUxOnboardingTeaserVariant("v1")).toBe("variant");
    expect(resolveUxOnboardingTeaserVariant("true")).toBe("variant");
    expect(resolveUxOnboardingTeaserVariant(true)).toBe("variant");
  });

  it("keeps control as the current cohort gate", () => {
    expect(
      shouldShowOnboardingTeaser({
        hasDestinationAndDate: true,
        isPremium: true,
        variant: "control",
      }),
    ).toBe(false);
    expect(
      shouldShowOnboardingTeaser({
        hasDestinationAndDate: true,
        isPremium: false,
        variant: "control",
      }),
    ).toBe(true);
  });

  it("widens the variant to every user with destination and move date", () => {
    expect(
      shouldShowOnboardingTeaser({
        hasDestinationAndDate: true,
        isPremium: true,
        variant: "variant",
      }),
    ).toBe(true);
    expect(
      shouldShowOnboardingTeaser({
        hasDestinationAndDate: true,
        isPremium: false,
        variant: "variant",
      }),
    ).toBe(true);
    expect(
      shouldShowOnboardingTeaser({
        hasDestinationAndDate: false,
        isPremium: true,
        variant: "variant",
      }),
    ).toBe(false);
  });

  it("keeps the free paywall closed from the teaser primary action", () => {
    expect(getOnboardingTeaserPrimaryAction({ isPremium: false })).toBe("complete_without_plan");
    expect(getOnboardingTeaserPrimaryAction({ isPremium: true })).toBe("create_plan");
  });
});
