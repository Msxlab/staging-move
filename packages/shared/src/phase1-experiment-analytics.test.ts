import { describe, expect, it } from "vitest";
import {
  PHASE1_ANALYTICS_EVENTS,
  buildAiBriefingActionClickedMetadata,
  buildAiBriefingViewedMetadata,
  buildOnboardingTeaserViewedMetadata,
  buildTrustCopyShownMetadata,
  buildUpgradeClickedMetadata,
  sanitizePhase1EventMetadata,
} from "./phase1-experiment-analytics";

const FORBIDDEN_FIELDS = [
  "email",
  "phone",
  "address",
  "street",
  "zip",
  "name",
  "user_id",
  "customer_id",
  "provider_account_changed",
  "partner_lead",
  "ai_prompt",
  "ai_response",
  "document_contents",
  "raw_url",
  "referrer",
  "confirmation_number",
  "account_number",
];

function expectOnlyKeys(value: Record<string, unknown>, keys: string[]) {
  expect(Object.keys(value).sort()).toEqual(keys.sort());
}

describe("phase 1 experiment analytics metadata", () => {
  it("keeps event names compatible with UserEvent.event", () => {
    for (const event of Object.values(PHASE1_ANALYTICS_EVENTS)) {
      expect(event).toMatch(/^[a-z0-9_]+$/);
      expect(event.length).toBeLessThanOrEqual(50);
    }
  });

  it("allowlists only ai_briefing_viewed properties", () => {
    const metadata = sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.AI_BRIEFING_VIEWED, {
      surface: "dashboard",
      briefing_state: "fallback",
      briefing_mode: "rule_based",
      experiment_flag: "ux_ai_briefing_experience_v1",
      variant: "variant",
      address: "123 Main St",
      provider_account_changed: true,
      random_key: "nope",
    });

    expect(metadata).toEqual({
      surface: "dashboard",
      briefing_state: "fallback",
      briefing_mode: "rule_based",
      experiment_flag: "ux_ai_briefing_experience_v1",
      variant: "variant",
    });
  });

  it("allowlists only ai_briefing_action_clicked properties", () => {
    const metadata = sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.AI_BRIEFING_ACTION_CLICKED, {
      surface: "dashboard",
      source: "briefing",
      action_type: "service_category",
      briefing_mode: "ai_generated",
      experiment_flag: "ux_ai_briefing_experience_v1",
      variant: "control",
      raw_url: "/services/new?category=UTILITY_INTERNET",
    });

    expect(metadata).toEqual({
      surface: "dashboard",
      source: "briefing",
      action_type: "service_category",
      briefing_mode: "ai_generated",
      experiment_flag: "ux_ai_briefing_experience_v1",
      variant: "control",
    });
  });

  it("allowlists only trust_copy_shown properties", () => {
    const metadata = sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.TRUST_COPY_SHOWN, {
      surface: "moving_plan",
      transition_action_type: "transfer",
      experiment_flag: "ux_trust_copy_v1",
      variant: "variant",
      task_id: "task_123",
      provider_name: "Provider",
    });

    expect(metadata).toEqual({
      surface: "moving_plan",
      transition_action_type: "transfer",
      experiment_flag: "ux_trust_copy_v1",
      variant: "variant",
    });
  });

  it("allowlists only onboarding_teaser_viewed properties", () => {
    const metadata = sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.ONBOARDING_TEASER_VIEWED, {
      surface: "onboarding",
      plan_tier: "free",
      experiment_flag: "ux_onboarding_teaser_v1",
      variant: "variant",
      move_date: "2026-08-01",
      destination_address: "Austin, TX",
    });

    expect(metadata).toEqual({
      surface: "onboarding",
      plan_tier: "free",
      experiment_flag: "ux_onboarding_teaser_v1",
      variant: "variant",
    });
  });

  it("allowlists only upgrade_clicked properties", () => {
    const metadata = sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.UPGRADE_CLICKED, {
      surface: "dashboard",
      upgrade_surface: "ai_briefing",
      target_plan_tier: "family",
      feature_gate: "ai_briefing",
      experiment_flag: "ux_ai_briefing_experience_v1",
      variant: "variant",
      stripe_customer_id: "cus_123",
      amount: 9900,
    });

    expect(metadata).toEqual({
      surface: "dashboard",
      upgrade_surface: "ai_briefing",
      target_plan_tier: "family",
      feature_gate: "ai_briefing",
      experiment_flag: "ux_ai_briefing_experience_v1",
      variant: "variant",
    });
  });

  it("prevents forbidden and PII-like fields from all phase 1 event builders", () => {
    const built = [
      buildAiBriefingViewedMetadata({
        briefingState: "content",
        briefingMode: "ai_generated",
        variant: "variant",
      }),
      buildAiBriefingActionClickedMetadata({
        actionType: "plan",
        briefingMode: "rule_based",
        variant: "variant",
      }),
      buildTrustCopyShownMetadata({
        transitionActionType: "STOP_SERVICE",
        variant: "variant",
      }),
      buildOnboardingTeaserViewedMetadata({
        planTier: "free",
        variant: "variant",
      }),
      buildUpgradeClickedMetadata({
        upgradeSurface: "onboarding_teaser",
        targetPlanTier: "individual",
        featureGate: "onboarding_teaser",
        variant: "variant",
        experimentFlag: "ux_onboarding_teaser_v1",
      }),
    ];

    for (const metadata of built) {
      for (const forbidden of FORBIDDEN_FIELDS) {
        expect(metadata).not.toHaveProperty(forbidden);
      }
      expect(JSON.stringify(metadata)).not.toContain("person@example.com");
      expect(JSON.stringify(metadata)).not.toContain("123 Main");
    }
  });

  it("normalizes open input into closed enums", () => {
    const metadata = sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.UPGRADE_CLICKED, {
      surface: "https://example.com/raw",
      plan_tier: "person@example.com",
      state: "California",
      source: "https://raw.referrer",
      upgrade_surface: "partner_lead",
      target_plan_tier: "customer-123",
      feature_gate: "provider_account_changed",
      experiment_flag: "secret_flag",
      variant: "treatment-a",
    });

    expectOnlyKeys(metadata ?? {}, [
      "surface",
      "plan_tier",
      "state",
      "source",
      "upgrade_surface",
      "target_plan_tier",
      "feature_gate",
      "experiment_flag",
      "variant",
    ]);
    expect(metadata).toEqual({
      surface: "unknown",
      plan_tier: "unknown",
      state: "unknown",
      source: "unknown",
      upgrade_surface: "unknown",
      target_plan_tier: "unknown",
      feature_gate: "unknown",
      experiment_flag: "none",
      variant: "unknown",
    });
  });
});
