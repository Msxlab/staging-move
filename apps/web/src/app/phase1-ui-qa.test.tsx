import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("lucide-react", () => {
  const icon = (name: string) => {
    const Stub = (props: { className?: string }) => <svg data-lucide={name} className={props.className} />;
    Stub.displayName = name;
    return Stub;
  };
  return { Sparkles: icon("sparkles"), X: icon("x"), ChevronRight: icon("chevron-right") };
});

vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
    onClick,
  }: {
    href?: string;
    children?: unknown;
    className?: string;
    onClick?: () => void;
  }) => (
    <a href={href} className={className} onClick={onClick}>
      {children as never}
    </a>
  ),
}));

vi.mock("@/lib/analytics", () => ({
  trackEvent: vi.fn(),
}));

vi.mock("next-intl", async () => {
  const en = (await import("@/i18n/messages/en.json")).default as unknown as Record<
    string,
    Record<string, string>
  >;
  const useTranslations = (namespace: string) => {
    const t = (key: string, vars?: Record<string, unknown>) =>
      (en[namespace]?.[key] ?? key).replace(/\{(\w+)\}/g, (_m, name: string) => String(vars?.[name] ?? ""));
    return t;
  };
  return { useTranslations, useLocale: () => "en-US" };
});

import {
  actionHref,
  briefingActionTelemetryType,
  briefingTelemetryForState,
  deriveBriefingState,
  MoveBriefingTeaser,
  parseBriefing,
  shouldShowBriefingForStage,
} from "@/components/dashboard/move-briefing-card";
import {
  DASHBOARD_DETAILS_WIDGETS,
  resolveDashboardTopSlots,
  shouldUseDashboardDetailsSection,
  splitDashboardDetailWidgets,
} from "./(app)/dashboard/dashboard-ux-experiment";
import {
  MoveTaskTrustConfirmation,
  shouldShowMoveTaskTrustConfirmation,
  shouldShowMoveTaskTrustLegalLine,
} from "./(app)/moving/plan/trust-copy";
import {
  buildAiBriefingViewedMetadata,
  buildOnboardingTeaserViewedMetadata,
  buildTrustCopyShownMetadata,
  getOnboardingTeaserPrimaryAction,
  PHASE1_ANALYTICS_EVENTS,
  sanitizePhase1EventMetadata,
  shouldShowOnboardingTeaser,
} from "@locateflow/shared";
import {
  deriveMobileBriefingState,
  fallbackMobileBriefingState,
  shouldSkipMobileBriefingForInstallDismissal,
} from "../../../mobile/src/lib/ai-briefing-experience";

const SENTINEL = "<<<LF_BRIEFING_META>>>";
const encodedBriefing = `Ready.\n${SENTINEL}\n${JSON.stringify({
  moveStage: "planning",
  actions: [
    { title: "Add internet", why: "critical", target: { kind: "category", category: "UTILITY_INTERNET" } },
    { title: "Open plan", why: "next", target: { kind: "plan" } },
  ],
})}`;

describe("Phase-1 UI QA automated-render verification", () => {
  it("Exp 1: briefing state matrix matches control, variant, gated, and content expectations", () => {
    expect(deriveBriefingState({ configured: false }, "control")).toEqual({ kind: "hidden" });
    const fallback = deriveBriefingState({ configured: false }, "variant");
    expect(fallback.kind).toBe("briefing");
    expect(fallback.kind === "briefing" ? fallback.aiGenerated : true).toBe(false);
    expect(parseBriefing(fallback.kind === "briefing" ? fallback.briefing : "").proseLines[0]).toContain(
      "move command center",
    );

    expect(deriveBriefingState({ configured: true }, "control")).toEqual({ kind: "hidden" });
    expect(deriveBriefingState({ configured: true }, "variant").kind).toBe("briefing");

    expect(deriveBriefingState({ configured: true, entitled: false }, "control")).toEqual({ kind: "teaser" });
    expect(deriveBriefingState({ configured: true, upgradeRequired: true }, "variant")).toEqual({ kind: "teaser" });

    expect(deriveBriefingState({ configured: true, briefing: encodedBriefing, aiGenerated: true }, "control")).toEqual({
      kind: "briefing",
      briefing: encodedBriefing,
      aiGenerated: true,
    });
  });

  it("Exp 1: fallback/teaser UI routes and telemetry buckets stay coarse", () => {
    const teaserMarkup = renderToStaticMarkup(<MoveBriefingTeaser uxAiBriefingExperienceVariant="variant" />);
    expect(teaserMarkup).toContain('href="/pricing"');
    expect(teaserMarkup).toContain("Unlock with Family");

    const parsed = parseBriefing(encodedBriefing);
    expect(actionHref(parsed.actions[0])).toBe("/services/new?category=UTILITY_INTERNET");
    expect(actionHref(parsed.actions[1])).toBe("/moving");
    expect(briefingActionTelemetryType(parsed.actions[0])).toBe("service_category");
    expect(briefingTelemetryForState({ kind: "teaser" })).toEqual({
      briefingState: "teaser",
      briefingMode: "gated_teaser",
    });
    expect(buildAiBriefingViewedMetadata({
      briefingState: "fallback",
      briefingMode: "rule_based",
      variant: "variant",
    })).toMatchObject({
      experiment_flag: "ux_ai_briefing_experience_v1",
      variant: "variant",
      briefing_state: "fallback",
      briefing_mode: "rule_based",
    });
  });

  it("Exp 1: dashboard first-session order changes only for variant users without saved prefs", () => {
    expect(resolveDashboardTopSlots("control").slice(0, 4)).toEqual([
      "briefing",
      "householdActivation",
      "commandCenter",
      "nextCriticalActions",
    ]);
    expect(resolveDashboardTopSlots("variant").slice(0, 3)).toEqual([
      "commandCenter",
      "nextCriticalActions",
      "briefing",
    ]);
    expect(shouldUseDashboardDetailsSection("variant", null)).toBe(true);
    expect(shouldUseDashboardDetailsSection("variant", { order: ["routeMap", "moving"] })).toBe(false);

    const split = splitDashboardDetailWidgets(
      ["moving", "homeDossier", "routeMap", "budgetDonut", "recent"],
      DASHBOARD_DETAILS_WIDGETS,
    );
    expect(split.primary).toEqual(["moving", "recent"]);
    expect(split.details).toEqual(["homeDossier", "routeMap", "budgetDonut"]);
  });

  it("Exp 1: dismissal is stage-scoped in variant and mobile install dismissal stays control-only", () => {
    expect(
      shouldShowBriefingForStage({
        variant: "variant",
        moveStage: "planning",
        seenStage: null,
        dismissedStage: "planning",
      }),
    ).toBe(false);
    expect(
      shouldShowBriefingForStage({
        variant: "variant",
        moveStage: "in_progress",
        seenStage: null,
        dismissedStage: "planning",
      }),
    ).toBe(true);
    expect(shouldSkipMobileBriefingForInstallDismissal("control", "true")).toBe(true);
    expect(shouldSkipMobileBriefingForInstallDismissal("variant", "true")).toBe(false);
    expect(fallbackMobileBriefingState("control")).toBeNull();
    expect(deriveMobileBriefingState({ configured: false }, "variant")).toMatchObject({
      aiGenerated: false,
      entitled: true,
    });
    expect(deriveMobileBriefingState({ configured: true, entitled: false }, "variant")).toEqual({
      briefing: "",
      aiGenerated: false,
      entitled: false,
    });
  });

  it("Exp 2: trust confirmation renders for guided action types after done/dismissed but not verified integrations", () => {
    for (const actionType of ["STOP_SERVICE", "START_SERVICE", "TRANSFER_SERVICE", "CANCEL_OR_CLOSE", "UPDATE_ADDRESS"]) {
      for (const terminalState of [
        { isDone: false, isDismissed: false },
        { isDone: true, isDismissed: false },
        { isDone: false, isDismissed: true },
      ]) {
        const input = { actionType, variant: "variant" as const, ...terminalState };
        const markup = renderToStaticMarkup(<MoveTaskTrustConfirmation {...input} />);
        expect(shouldShowMoveTaskTrustConfirmation(input)).toBe(true);
        expect(shouldShowMoveTaskTrustLegalLine(input)).toBe(true);
        expect(markup).toContain("LocateFlow only");
        expect(markup).toContain("provider account is unchanged");
      }
    }

    expect(
      renderToStaticMarkup(
        <MoveTaskTrustConfirmation
          actionType="STOP_SERVICE"
          localEffect={{ localOnly: false, noExternalAutomation: false }}
          variant="variant"
          isDone
        />,
      ),
    ).toBe("");
  });

  it("Exp 3: onboarding teaser widens in variant while free users still avoid the plan-create action", () => {
    expect(shouldShowOnboardingTeaser({
      hasDestinationAndDate: true,
      isPremium: true,
      variant: "control",
    })).toBe(false);
    expect(shouldShowOnboardingTeaser({
      hasDestinationAndDate: true,
      isPremium: false,
      variant: "control",
    })).toBe(true);
    expect(shouldShowOnboardingTeaser({
      hasDestinationAndDate: true,
      isPremium: true,
      variant: "variant",
    })).toBe(true);
    expect(shouldShowOnboardingTeaser({
      hasDestinationAndDate: false,
      isPremium: false,
      variant: "variant",
    })).toBe(false);
    expect(getOnboardingTeaserPrimaryAction({ isPremium: false })).toBe("complete_without_plan");
    expect(getOnboardingTeaserPrimaryAction({ isPremium: true })).toBe("create_plan");
  });

  it("Phase-1 telemetry allowlist strips non-coarse and forbidden props", () => {
    const trust = buildTrustCopyShownMetadata({
      transitionActionType: "TRANSFER_SERVICE",
      variant: "variant",
    });
    expect(trust).toEqual({
      platform: "web",
      surface: "moving_plan",
      experiment_flag: "ux_trust_copy_v1",
      variant: "variant",
      transition_action_type: "transfer",
    });

    const onboarding = buildOnboardingTeaserViewedMetadata({
      planTier: "free",
      variant: "variant",
    });
    expect(onboarding).toEqual({
      platform: "web",
      surface: "onboarding",
      plan_tier: "free",
      experiment_flag: "ux_onboarding_teaser_v1",
      variant: "variant",
    });

    const hostile = sanitizePhase1EventMetadata(PHASE1_ANALYTICS_EVENTS.ONBOARDING_TEASER_VIEWED, {
      surface: "onboarding",
      plan_tier: "free",
      experiment_flag: "ux_onboarding_teaser_v1",
      variant: "variant",
      destination_address: "123 Main St",
      email: "person@example.com",
      move_date: "2026-08-01",
    });
    expect(hostile).toEqual({
      surface: "onboarding",
      plan_tier: "free",
      experiment_flag: "ux_onboarding_teaser_v1",
      variant: "variant",
    });
  });

  it("Exp 3 source guardrail keeps the free teaser branch before moving-plan persistence", () => {
    const file = path.join(process.cwd(), "src", "app", "onboarding", "onboarding-client.tsx");
    const source = readFileSync(file, "utf8");
    const freeBranch = source.indexOf("if (wantsToMove && !isPremium)");
    const saveMovingPlanCall = source.indexOf("const planId = await saveMovingPlan();");

    expect(freeBranch).toBeGreaterThan(-1);
    expect(saveMovingPlanCall).toBeGreaterThan(-1);
    expect(freeBranch).toBeLessThan(saveMovingPlanCall);
    expect(source).toContain("PHASE1_ANALYTICS_EVENTS.ONBOARDING_TEASER_VIEWED");
  });
});
