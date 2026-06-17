import { getUserSession } from "@/lib/auth";
import { isFeatureEnabled } from "@/lib/feature-flags";
import { UX_ONBOARDING_TEASER_FLAG, type UxOnboardingTeaserVariant } from "@locateflow/shared";
import OnboardingClient from "./onboarding-client";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const session = await getUserSession();
  const flagEnabled = session
    ? await isFeatureEnabled(UX_ONBOARDING_TEASER_FLAG, { userId: session.userId })
    : false;
  const uxOnboardingTeaserVariant: UxOnboardingTeaserVariant = flagEnabled ? "variant" : "control";

  return <OnboardingClient uxOnboardingTeaserVariant={uxOnboardingTeaserVariant} />;
}
