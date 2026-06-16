import {
  resolveUxAiBriefingExperienceVariant,
  type UxAiBriefingExperienceVariant,
} from "@locateflow/shared";

export interface MobileMoveBriefingState {
  briefing: string;
  aiGenerated: boolean;
  entitled?: boolean;
}

export interface MobileBriefingApiResponse {
  configured?: boolean;
  entitled?: boolean;
  upgradeRequired?: unknown;
  briefing?: unknown;
  aiGenerated?: unknown;
}

export const MOBILE_AI_BRIEFING_FALLBACK_BRIEFING =
  "Your move command center is still ready. Use your next critical actions and move plan to keep address-linked tasks moving.";

export function getMobileUxAiBriefingExperienceVariant(): UxAiBriefingExperienceVariant {
  return resolveUxAiBriefingExperienceVariant(process.env.EXPO_PUBLIC_UX_AI_BRIEFING_EXPERIENCE_V1);
}

export function shouldSkipMobileBriefingForInstallDismissal(
  variant: UxAiBriefingExperienceVariant,
  dismissedValue: string | null,
): boolean {
  return variant === "control" && dismissedValue === "true";
}

export function fallbackMobileBriefingState(
  variant: UxAiBriefingExperienceVariant,
): MobileMoveBriefingState | null {
  if (variant !== "variant") return null;
  return {
    briefing: MOBILE_AI_BRIEFING_FALLBACK_BRIEFING,
    aiGenerated: false,
    entitled: true,
  };
}

export function deriveMobileBriefingState(
  response: MobileBriefingApiResponse | null | undefined,
  variant: UxAiBriefingExperienceVariant,
): MobileMoveBriefingState | null {
  if (!response || response.configured === false) return fallbackMobileBriefingState(variant);
  if (response.entitled === false || response.upgradeRequired === true) {
    return { briefing: "", aiGenerated: false, entitled: false };
  }
  if (typeof response.briefing !== "string" || response.briefing.length === 0) {
    return fallbackMobileBriefingState(variant);
  }
  return {
    briefing: response.briefing,
    aiGenerated: response.aiGenerated === true,
    entitled: true,
  };
}
