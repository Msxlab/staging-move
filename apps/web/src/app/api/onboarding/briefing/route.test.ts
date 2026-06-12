import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { BRIEFING_META_SENTINEL, type BriefingAction } from "@/lib/onboarding-briefing";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  userFindUnique: vi.fn(),
  movingPlanFindFirst: vi.fn(),
  serviceFindMany: vi.fn(),
  savedProviderFindMany: vi.fn(),
  addressFindFirst: vi.fn(),
  rateLimit: vi.fn(),
  getRuntimeConfigValue: vi.fn(),
  resolveWorkspaceDataScope: vi.fn(),
  generateLlmBriefing: vi.fn(),
  getUserPlan: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findUnique: (...args: unknown[]) => mocks.userFindUnique(...args) },
    movingPlan: { findFirst: (...args: unknown[]) => mocks.movingPlanFindFirst(...args) },
    service: { findMany: (...args: unknown[]) => mocks.serviceFindMany(...args) },
    savedProvider: { findMany: (...args: unknown[]) => mocks.savedProviderFindMany(...args) },
    address: { findFirst: (...args: unknown[]) => mocks.addressFindFirst(...args) },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: (...args: unknown[]) => mocks.requireDbUserId(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: (...args: unknown[]) => mocks.rateLimit(...args),
  getRateLimitKey: () => "rl-key",
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: (...args: unknown[]) => mocks.getRuntimeConfigValue(...args),
}));

vi.mock("@/lib/workspace-data-scope", () => ({
  resolveWorkspaceDataScope: (...args: unknown[]) => mocks.resolveWorkspaceDataScope(...args),
  scopedRecordWhere: (_scope: unknown, where: unknown) => where,
}));

vi.mock("@/lib/service-active", () => ({
  activeTrackedServiceWhereForScope: () => ({}),
}));

// Plan entitlement: getUserPlan is mocked (no DB); planFeatures stays REAL so
// the gate exercises the actual @locateflow/shared feature matrix.
vi.mock("@/lib/plan-limits", () => ({
  getUserPlan: (...args: unknown[]) => mocks.getUserPlan(...args),
}));

// Keep the REAL signal/action/encoding logic; stub only the network call.
vi.mock("@/lib/onboarding-briefing", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/onboarding-briefing")>();
  return {
    ...actual,
    generateLlmBriefing: (...args: unknown[]) => mocks.generateLlmBriefing(...args),
  };
});

import { POST } from "./route";

function makeRequest() {
  return new NextRequest("https://locateflow.com/api/onboarding/briefing", {
    method: "POST",
  });
}

/** Primes the prisma mocks. `carCount` is the fingerprint knob tests turn. */
function primeData({ carCount = 1, state = "NJ" }: { carCount?: number; state?: string } = {}) {
  mocks.userFindUnique.mockResolvedValue({
    profile: {
      hasChildren: false,
      hasPets: false,
      carCount,
      hasSenior: false,
      isBusinessOwner: false,
      isMilitary: false,
      needsStorage: false,
      moveType: "PERSONAL",
    },
  });
  mocks.movingPlanFindFirst.mockResolvedValue({
    status: "PLANNING",
    moveDate: null,
    toAddress: { state },
  });
  mocks.serviceFindMany.mockResolvedValue([]);
  mocks.savedProviderFindMany.mockResolvedValue([]);
  mocks.addressFindFirst.mockResolvedValue({ state, ownership: "RENTER" });
}

const TARGET_KINDS = ["category", "state_rule", "plan", "services"];

function expectActionsWithTargets(actions: BriefingAction[]) {
  expect(Array.isArray(actions)).toBe(true);
  expect(actions.length).toBeGreaterThan(0);
  for (const action of actions) {
    expect(typeof action.title).toBe("string");
    // Backwards compatibility for old clients.
    expect(action.deeplink).toBeDefined();
    // New machine-readable target.
    expect(action.target).toBeDefined();
    expect(TARGET_KINDS).toContain(action.target.kind);
  }
}

// The route caches per user+day in module state; a fresh user per test isolates.
let userSeq = 0;

describe("/api/onboarding/briefing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userSeq += 1;
    mocks.requireDbUserId.mockResolvedValue(`user_${userSeq}`);
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getRuntimeConfigValue.mockResolvedValue("test-api-key");
    // aiBriefing is Family+Pro under the overhauled matrix (Individual loses AI),
    // so the entitled-path default is FAMILY — the lowest tier with the feature.
    mocks.getUserPlan.mockResolvedValue({ plan: "FAMILY", hasPremium: true, isActive: true });
    mocks.resolveWorkspaceDataScope.mockResolvedValue({
      workspaceId: null,
      memberRole: "OWNER",
    });
    mocks.generateLlmBriefing.mockResolvedValue("Here is your AI summary.");
    primeData();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("rejects unauthenticated callers", async () => {
    mocks.requireDbUserId.mockRejectedValueOnce(new Error("UNAUTHORIZED"));
    const response = await POST(makeRequest());
    expect(response.status).toBe(401);
  });

  it("returns 429 when the per-minute rate limit trips", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ success: false });
    const response = await POST(makeRequest());
    expect(response.status).toBe(429);
  });

  it("hides the AI section (configured:false) when no API key is set", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);
    const response = await POST(makeRequest());
    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body).toEqual({ configured: false });
    expect(mocks.generateLlmBriefing).not.toHaveBeenCalled();
  });

  it("free plan gets the 200 upgrade teaser — no LLM call, no signal queries", async () => {
    mocks.getUserPlan.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });

    const response = await POST(makeRequest());
    const body = await response.json();

    // 200 (never 403) so old clients — which require a string `briefing` —
    // fail soft to the deterministic dashboard.
    expect(response.status).toBe(200);
    expect(body).toEqual({
      configured: true,
      entitled: false,
      upgradeRequired: "AI_BRIEFING_UPGRADE_REQUIRED",
    });
    expect(mocks.generateLlmBriefing).not.toHaveBeenCalled();
    // The gate short-circuits before any signal gathering.
    expect(mocks.userFindUnique).not.toHaveBeenCalled();
    expect(mocks.movingPlanFindFirst).not.toHaveBeenCalled();
    expect(mocks.serviceFindMany).not.toHaveBeenCalled();
  });

  it("configured:false wins over the plan gate on a keyless deployment", async () => {
    mocks.getRuntimeConfigValue.mockResolvedValue(null);
    mocks.getUserPlan.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });

    const body = await (await POST(makeRequest())).json();

    // No upgrade CTA for a feature this deployment cannot serve to anyone.
    expect(body).toEqual({ configured: false });
  });

  it("every paid tier passes the gate (FAMILY and PRO included)", async () => {
    for (const plan of ["FAMILY", "PRO"]) {
      userSeq += 1; // fresh user per tier — the route caches per user+day
      mocks.requireDbUserId.mockResolvedValue(`user_${userSeq}`);
      mocks.getUserPlan.mockResolvedValue({ plan, hasPremium: true, isActive: true });

      const body = await (await POST(makeRequest())).json();

      expect(body.configured).toBe(true);
      expect(body.upgradeRequired).toBeUndefined();
      expect(typeof body.briefing).toBe("string");
    }
  });

  it("gated requests never consume the daily AI budget (upgrade mid-day still generates)", async () => {
    mocks.getUserPlan.mockResolvedValue({ plan: "FREE_TRIAL", hasPremium: false, isActive: true });
    for (let i = 0; i < 5; i += 1) {
      const body = await (await POST(makeRequest())).json();
      expect(body.upgradeRequired).toBe("AI_BRIEFING_UPGRADE_REQUIRED");
    }
    expect(mocks.generateLlmBriefing).not.toHaveBeenCalled();

    // Same user upgrades the same day to an AI tier → full budget still available.
    mocks.getUserPlan.mockResolvedValue({ plan: "FAMILY", hasPremium: true, isActive: true });
    const body = await (await POST(makeRequest())).json();
    expect(body.cached).toBe(false);
    expect(body.source).toBe("ai");
    expect(mocks.generateLlmBriefing).toHaveBeenCalledTimes(1);
  });

  it("ai path: returns { source, cached } meta and a target on every action", async () => {
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.source).toBe("ai");
    expect(body.cached).toBe(false);
    expectActionsWithTargets(body.actions);
    // Pending essentials produce category targets with catalog keys.
    expect(
      body.actions.some(
        (a: BriefingAction) => a.target.kind === "category" && "category" in a.target,
      ),
    ).toBe(true);

    // Targets also ride inside the encoded briefing tail (mobile parses this).
    const idx = body.briefing.indexOf(BRIEFING_META_SENTINEL);
    expect(idx).toBeGreaterThan(0);
    const meta = JSON.parse(body.briefing.slice(idx + BRIEFING_META_SENTINEL.length).trim());
    expectActionsWithTargets(meta.actions);
  });

  it("rule_based path: AI failure degrades gracefully and still carries targets", async () => {
    mocks.generateLlmBriefing.mockResolvedValue(null);
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.source).toBe("rule_based");
    expect(body.aiGenerated).toBe(false);
    expectActionsWithTargets(body.actions);
  });

  it("same-day repeat with unchanged inputs serves the cache — no second API call", async () => {
    const first = await (await POST(makeRequest())).json();
    expect(first.cached).toBe(false);

    const second = await (await POST(makeRequest())).json();
    expect(second.cached).toBe(true);
    expect(second.source).toBe("ai");
    expect(second.briefing).toBe(first.briefing);
    // Cached responses still carry the structured actions for the card.
    expectActionsWithTargets(second.actions);
    expect(mocks.generateLlmBriefing).toHaveBeenCalledTimes(1);
  });

  it("a changed input fingerprint triggers a regeneration while budget remains", async () => {
    mocks.generateLlmBriefing
      .mockResolvedValueOnce("Summary for one car.")
      .mockResolvedValueOnce("Summary for two cars.");
    primeData({ carCount: 1 });
    const first = await (await POST(makeRequest())).json();

    primeData({ carCount: 2 }); // materially different signals → new fingerprint
    const second = await (await POST(makeRequest())).json();

    expect(second.cached).toBe(false);
    expect(second.briefing).not.toBe(first.briefing);
    expect(mocks.generateLlmBriefing).toHaveBeenCalledTimes(2);
  });

  it("hard daily cap: after 3 generations, changed inputs serve the cached briefing without an API call (never an error)", async () => {
    for (const carCount of [1, 2, 3]) {
      primeData({ carCount });
      const body = await (await POST(makeRequest())).json();
      expect(body.cached).toBe(false);
    }
    expect(mocks.generateLlmBriefing).toHaveBeenCalledTimes(3);

    // 4th distinct fingerprint, same UTC day → capped, served from cache.
    primeData({ carCount: 4 });
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.configured).toBe(true);
    expect(body.cached).toBe(true);
    expect(body.source).toBe("ai");
    expectActionsWithTargets(body.actions);
    expect(mocks.generateLlmBriefing).toHaveBeenCalledTimes(3);
  });

  it("the cap and cache roll over at UTC midnight (per-day key)", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-10T12:00:00Z"));

    for (const carCount of [1, 2, 3]) {
      primeData({ carCount });
      await POST(makeRequest());
    }
    primeData({ carCount: 4 });
    const capped = await (await POST(makeRequest())).json();
    expect(capped.cached).toBe(true);
    expect(mocks.generateLlmBriefing).toHaveBeenCalledTimes(3);

    // Next UTC day → fresh budget; the same changed fingerprint now regenerates.
    vi.setSystemTime(new Date("2026-06-11T00:05:00Z"));
    const nextDay = await (await POST(makeRequest())).json();
    expect(nextDay.cached).toBe(false);
    expect(nextDay.source).toBe("ai");
    expect(mocks.generateLlmBriefing).toHaveBeenCalledTimes(4);
  });

  it("goes quiet (allEssentialsHandled, no LLM) when every essential is handled — saved providers count too", async () => {
    // Compute the exact pending essentials for the primed profile, then mark them
    // ALL handled via SAVED PROVIDERS (proves saved providers are in the owned set
    // AND that an empty pending list takes the quiet path with no AI spend).
    const { getEssentialSetupCategories } = await import("@/lib/recommendation-engine");
    primeData({ carCount: 0 });
    const profile = {
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      hasSenior: false,
      carCount: 0,
      hasDisability: false,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
      isMilitary: false,
      isBusinessOwner: false,
      moveType: "PERSONAL",
      ownership: "RENT",
    } as const;
    const { critical, important } = getEssentialSetupCategories(profile, []);
    mocks.savedProviderFindMany.mockResolvedValue(
      [...critical, ...important].map((category) => ({ provider: { category } })),
    );

    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.allEssentialsHandled).toBe(true);
    expect(body.actions).toEqual([]);
    expect(body.aiGenerated).toBe(false);
    expect(typeof body.briefing).toBe("string");
    // No AI generation spent when there is nothing essential to surface.
    expect(mocks.generateLlmBriefing).not.toHaveBeenCalled();
  });

  it("failed AI attempts still consume budget (hammering guard) and pin the cached fallback", async () => {
    mocks.generateLlmBriefing.mockResolvedValue(null); // API down all day
    for (const carCount of [1, 2, 3]) {
      primeData({ carCount });
      const body = await (await POST(makeRequest())).json();
      expect(body.source).toBe("rule_based");
    }
    primeData({ carCount: 4 });
    const body = await (await POST(makeRequest())).json();
    expect(body.cached).toBe(true);
    expect(body.source).toBe("rule_based");
    expect(mocks.generateLlmBriefing).toHaveBeenCalledTimes(3);
  });
});
