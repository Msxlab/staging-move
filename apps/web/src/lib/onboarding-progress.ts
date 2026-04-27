import { ONBOARDING_COMPLETED_EVENT } from "@/lib/legal";

export const ONBOARDING_SERVICES_SKIPPED_EVENT = "ONBOARDING_SERVICES_SKIPPED";
export const ONBOARDING_MOVING_SKIPPED_EVENT = "ONBOARDING_MOVING_SKIPPED";

export type OnboardingStep = "profile" | "address" | "services" | "moving" | "complete";

export interface OnboardingProgressInput {
  hasProfile: boolean;
  hasRequiredLegalConsents: boolean;
  addressCount: number;
  serviceCount: number;
  movingPlanCount: number;
  servicesSkipped: boolean;
  movingSkipped: boolean;
  completedEvent: boolean;
}

export interface OnboardingProgress {
  completed: boolean;
  step: OnboardingStep;
  stepIndex: number;
}

export function getOnboardingProgress(input: OnboardingProgressInput): OnboardingProgress {
  if (!input.hasProfile || !input.hasRequiredLegalConsents) {
    return { completed: false, step: "profile", stepIndex: 0 };
  }

  if (input.completedEvent) {
    return { completed: true, step: "complete", stepIndex: 4 };
  }

  if (input.addressCount <= 0) {
    return { completed: false, step: "address", stepIndex: 1 };
  }

  if (input.serviceCount <= 0 && !input.servicesSkipped) {
    return { completed: false, step: "services", stepIndex: 2 };
  }

  if (input.movingPlanCount <= 0 && !input.movingSkipped) {
    return { completed: false, step: "moving", stepIndex: 3 };
  }

  return { completed: true, step: "complete", stepIndex: 4 };
}

export function getOnboardingGateRedirect(input: OnboardingProgressInput): string | null {
  const progress = getOnboardingProgress(input);
  if (progress.completed) return null;
  if (!input.hasRequiredLegalConsents) return "/onboarding?step=legal";
  return "/onboarding";
}

export function summarizeOnboardingEvents(events: Array<{ event: string }>) {
  const names = new Set(events.map((item) => item.event));
  return {
    servicesSkipped: names.has(ONBOARDING_SERVICES_SKIPPED_EVENT),
    movingSkipped: names.has(ONBOARDING_MOVING_SKIPPED_EVENT),
    completedEvent: names.has(ONBOARDING_COMPLETED_EVENT),
  };
}

export const ONBOARDING_PROGRESS_EVENTS = [
  ONBOARDING_SERVICES_SKIPPED_EVENT,
  ONBOARDING_MOVING_SKIPPED_EVENT,
  ONBOARDING_COMPLETED_EVENT,
] as const;
