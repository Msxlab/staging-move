export const UX_AI_BRIEFING_EXPERIENCE_FLAG = "ux_ai_briefing_experience_v1";
export const UX_TRUST_COPY_FLAG = "ux_trust_copy_v1";
export const UX_ONBOARDING_TEASER_FLAG = "ux_onboarding_teaser_v1";

export type UxExperimentVariant = "control" | "variant";
export type UxAiBriefingExperienceVariant = UxExperimentVariant;
export type UxTrustCopyVariant = UxExperimentVariant;
export type UxOnboardingTeaserVariant = UxExperimentVariant;

function resolveUxExperimentVariant(raw: unknown): UxExperimentVariant {
  if (raw === true) return "variant";
  if (typeof raw !== "string") return "control";

  const value = raw.trim().toLowerCase();
  if (
    value === "variant" ||
    value === "treatment" ||
    value === "v1" ||
    value === "on" ||
    value === "true" ||
    value === "1" ||
    value === "enabled"
  ) {
    return "variant";
  }

  return "control";
}

export function resolveUxAiBriefingExperienceVariant(raw: unknown): UxAiBriefingExperienceVariant {
  return resolveUxExperimentVariant(raw);
}

export function isUxAiBriefingExperienceVariant(raw: unknown): boolean {
  return resolveUxAiBriefingExperienceVariant(raw) === "variant";
}

export function resolveUxTrustCopyVariant(raw: unknown): UxTrustCopyVariant {
  return resolveUxExperimentVariant(raw);
}

export function isUxTrustCopyVariant(raw: unknown): boolean {
  return resolveUxTrustCopyVariant(raw) === "variant";
}

export function resolveUxOnboardingTeaserVariant(raw: unknown): UxOnboardingTeaserVariant {
  return resolveUxExperimentVariant(raw);
}

export function isUxOnboardingTeaserVariant(raw: unknown): boolean {
  return resolveUxOnboardingTeaserVariant(raw) === "variant";
}

export function shouldShowOnboardingTeaser(input: {
  hasDestinationAndDate: boolean;
  isPremium: boolean;
  variant?: UxOnboardingTeaserVariant;
}): boolean {
  if (!input.hasDestinationAndDate) return false;
  if (input.variant === "variant") return true;
  return !input.isPremium;
}

export function getOnboardingTeaserPrimaryAction(input: {
  isPremium: boolean;
}): "create_plan" | "complete_without_plan" {
  return input.isPremium ? "create_plan" : "complete_without_plan";
}
