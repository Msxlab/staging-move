import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    movingPlan: { findUnique: vi.fn() },
    service: { findMany: vi.fn() },
    serviceProvider: { findMany: vi.fn() },
  },
}));

vi.mock("@/lib/provider-serviceability", () => ({
  enrichProviderServiceability: vi.fn(async () => ({
    fcc: { status: "skipped", confirmedCount: 0, blockGeoid: null },
    electric: { status: "skipped", confirmedCount: 0, utilityCount: 0 },
  })),
  applyProviderServiceabilityConfidence: vi.fn((provider, confidence) =>
    provider.fccServiceable || provider.utilityServiceable ? "AVAILABLE_AT_ADDRESS" : confidence,
  ),
}));

import { prisma } from "@/lib/db";
import {
  applyProviderServiceabilityConfidence,
  enrichProviderServiceability,
} from "@/lib/provider-serviceability";
import {
  buildMoveTransitionContext,
  buildMoveTaskTitle,
  buildMoveTaskDueDate,
  buildMoveTaskIdempotencyKey,
  buildChecklistTaskIdempotencyKey,
  buildChecklistProfile,
} from "./move-task-generation";

const movingPlanMock = prisma.movingPlan as unknown as { findUnique: Mock };
const serviceMock = prisma.service as unknown as { findMany: Mock };
const serviceProviderMock = prisma.serviceProvider as unknown as { findMany: Mock };
const enrichProviderServiceabilityMock = enrichProviderServiceability as unknown as Mock;
const applyProviderServiceabilityConfidenceMock = applyProviderServiceabilityConfidence as unknown as Mock;

const basePlan = {
  serviceId: "service-1",
  actionType: "SHOP_PROVIDER",
  destinationProviderCandidates: [],
} as any;

beforeEach(() => {
  vi.clearAllMocks();
  enrichProviderServiceabilityMock.mockImplementation(async (providers: any[]) => {
    for (const provider of providers) {
      if (provider.id === "dest-xfinity") provider.fccServiceable = true;
    }
    return {
      fcc: { status: "ok", confirmedCount: 1, blockGeoid: "484530011001" },
      electric: { status: "skipped", confirmedCount: 0, utilityCount: 0 },
    };
  });
  applyProviderServiceabilityConfidenceMock.mockImplementation((provider, confidence) =>
    provider.fccServiceable || provider.utilityServiceable ? "AVAILABLE_AT_ADDRESS" : confidence,
  );
});

describe("move task idempotency keys", () => {
  it("includes normalized origin and destination states", () => {
    const njToTx = buildMoveTaskIdempotencyKey("plan-1", basePlan, {
      fromState: "nj",
      toState: "tx",
    });
    const njToNj = buildMoveTaskIdempotencyKey("plan-1", basePlan, {
      fromState: "NJ",
      toState: "NJ",
    });

    expect(njToTx).toContain(":NJ:TX");
    expect(njToNj).toContain(":NJ:NJ");
    expect(njToTx).not.toBe(njToNj);
  });

  it("keeps retry keys stable for the same route", () => {
    expect(
      buildMoveTaskIdempotencyKey("plan-1", basePlan, {
        fromState: " NJ ",
        toState: " TX ",
      }),
    ).toBe(
      buildMoveTaskIdempotencyKey("plan-1", basePlan, {
        fromState: "NJ",
        toState: "TX",
      }),
    );
  });
});

describe("buildMoveTransitionContext", () => {
  it("feeds address-level serviceability confidence into destination candidates", async () => {
    movingPlanMock.findUnique.mockResolvedValue({
      id: "plan-1",
      userId: "user-1",
      workspaceId: null,
      deletedAt: null,
      fromAddressId: "from-1",
      toAddressId: "to-1",
      workspace: null,
      fromAddress: { state: "NJ", zip: "07030" },
      toAddress: {
        state: "TX",
        zip: "78701",
        latitude: 30.2672,
        longitude: -97.7431,
      },
    });
    serviceMock.findMany.mockResolvedValue([
      {
        id: "service-1",
        category: "UTILITY_INTERNET",
        providerName: "Old Internet",
        providerId: null,
        customProviderId: null,
        provider: null,
        customProvider: null,
      },
    ]);
    serviceProviderMock.findMany.mockResolvedValue([
      {
        id: "dest-xfinity",
        name: "Xfinity",
        slug: "xfinity",
        category: "UTILITY_INTERNET",
        scope: "FEDERAL",
        states: [],
        zipCodes: [],
        coverageModel: "live_address",
        coverages: [],
        popularityScore: 10,
      },
    ]);

    const context = await buildMoveTransitionContext("user-1", "plan-1");

    expect(enrichProviderServiceabilityMock).toHaveBeenCalledWith(
      expect.any(Array),
      { latitude: 30.2672, longitude: -97.7431 },
    );
    expect(applyProviderServiceabilityConfidenceMock).toHaveBeenCalled();
    expect(context.transitionPlans[0]?.destinationProviderCandidates[0]).toMatchObject({
      id: "dest-xfinity",
      name: "Xfinity",
      coverageConfidence: "AVAILABLE_AT_ADDRESS",
    });
  });
});

describe("buildMoveTaskTitle", () => {
  it("uses the destination candidate for destination setup tasks", () => {
    expect(
      buildMoveTaskTitle({
        actionLabel: "Start destination service",
        actionType: "START_SERVICE",
        serviceProviderName: "JCP&L",
        serviceCategory: "UTILITY_ELECTRIC",
        destinationProviderCandidates: [{ id: "con-ed", name: "Con Edison" }],
      } as any),
    ).toBe("Start destination service: Con Edison");
  });

  it("keeps the current provider for old-address tasks", () => {
    expect(
      buildMoveTaskTitle({
        actionLabel: "Stop old service",
        actionType: "STOP_SERVICE",
        serviceProviderName: "JCP&L",
        serviceCategory: "UTILITY_ELECTRIC",
        destinationProviderCandidates: [{ id: "con-ed", name: "Con Edison" }],
      } as any),
    ).toBe("Stop old service: JCP&L");
  });
});

describe("move task due dates", () => {
  const moveDate = new Date("2026-06-30T12:00:00Z");
  const earlyNow = new Date("2026-05-01T12:00:00Z");

  it("assigns pre-move due dates by action urgency", () => {
    expect(buildMoveTaskDueDate(moveDate, "MAIL_FORWARDING", earlyNow)?.toISOString().slice(0, 10)).toBe("2026-06-16");
    expect(buildMoveTaskDueDate(moveDate, "VERIFY_AVAILABILITY", earlyNow)?.toISOString().slice(0, 10)).toBe("2026-06-09");
    expect(buildMoveTaskDueDate(moveDate, "UPDATE_ADDRESS", earlyNow)?.toISOString().slice(0, 10)).toBe("2026-06-23");
  });

  it("schedules government updates after the move date", () => {
    expect(buildMoveTaskDueDate(moveDate, "GOVERNMENT_UPDATE", earlyNow)?.toISOString().slice(0, 10)).toBe("2026-07-10");
  });

  it("keeps near-term pre-move tasks due today instead of in the past", () => {
    expect(buildMoveTaskDueDate(moveDate, "START_SERVICE", new Date("2026-06-28T12:00:00Z"))?.toISOString().slice(0, 10)).toBe("2026-06-28");
  });
});

describe("checklist task idempotency keys", () => {
  it("is stable per (plan, template, route) and distinct from classifier keys", () => {
    const a = buildChecklistTaskIdempotencyKey("plan-1", "P2_USCIS", { fromState: "nj", toState: "tx" });
    const b = buildChecklistTaskIdempotencyKey("plan-1", "P2_USCIS", { fromState: "NJ", toState: "TX" });
    const other = buildChecklistTaskIdempotencyKey("plan-1", "P3_DRIVERS_LICENSE", { fromState: "NJ", toState: "TX" });
    expect(a).toBe(b);
    expect(a).toContain("checklist-task:plan-1:P2_USCIS:NJ:TX");
    expect(a).not.toBe(other);
  });
});

describe("buildChecklistProfile", () => {
  it("promotes to MILITARY when isMilitary is set, regardless of moveType", () => {
    const profile = buildChecklistProfile({ isMilitary: true, moveType: "PERSONAL" });
    expect(profile.moveType).toBe("MILITARY");
  });

  it("defaults a null/unknown move type to PERSONAL", () => {
    expect(buildChecklistProfile(null).moveType).toBe("PERSONAL");
    expect(buildChecklistProfile({ moveType: "weird" }).moveType).toBe("PERSONAL");
  });

  it("preserves an explicit BUSINESS move type", () => {
    expect(buildChecklistProfile({ moveType: "BUSINESS" }).moveType).toBe("BUSINESS");
  });
});
