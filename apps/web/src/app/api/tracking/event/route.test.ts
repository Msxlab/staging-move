import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    userEvent: {
      create: vi.fn(),
      createMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/tracking-consent", () => ({
  getConsentedTrackingSession: vi.fn(),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getRuntimeConfigValue } from "@/lib/runtime-config";
import { getConsentedTrackingSession } from "@/lib/tracking-consent";
import { POST, PUT } from "./route";

const trackingMock = getConsentedTrackingSession as unknown as Mock;
const runtimeConfigMock = getRuntimeConfigValue as unknown as Mock;
const userEventMock = prisma.userEvent as unknown as {
  create: Mock;
  createMany: Mock;
};

function request(method: "POST" | "PUT", body: unknown) {
  return new NextRequest("https://locateflow.com/api/tracking/event", {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function rawRequest(method: "POST" | "PUT", body: string) {
  return new NextRequest("https://locateflow.com/api/tracking/event", {
    method,
    headers: { "Content-Type": "application/json" },
    body,
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  userEventMock.create.mockResolvedValue({});
  userEventMock.createMany.mockResolvedValue({ count: 1 });
  runtimeConfigMock.mockResolvedValue(null);
  trackingMock.mockResolvedValue({
    disabled: false,
    authSession: { userId: "user_1" },
  });
});

describe("/api/tracking/event", () => {
  it("does not persist events when existing analytics consent gate disables tracking", async () => {
    trackingMock.mockResolvedValue({ disabled: true, authSession: null });

    const response = await POST(request("POST", {
      event: "ai_briefing_viewed",
      metadata: { surface: "dashboard", briefing_state: "fallback" },
    }));

    await expect(response.json()).resolves.toEqual({ success: true, disabled: true });
    expect(userEventMock.create).not.toHaveBeenCalled();
  });

  it("strips non-allowlisted and forbidden fields from phase 1 event metadata", async () => {
    await POST(request("POST", {
      event: "trust_copy_shown",
      page: "/moving/plan/plan_123",
      sessionId: "session_1",
      metadata: {
        surface: "moving_plan",
        transition_action_type: "transfer",
        experiment_flag: "ux_trust_copy_v1",
        variant: "variant",
        task_id: "task_123",
        provider_account_changed: true,
        partner_lead: "sent",
        email: "person@example.com",
        address: "123 Main St",
      },
    }));

    expect(userEventMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        sessionId: "session_1",
        event: "trust_copy_shown",
        page: "/moving/plan/plan_123",
        metadata: JSON.stringify({
          surface: "moving_plan",
          transition_action_type: "transfer",
          experiment_flag: "ux_trust_copy_v1",
          variant: "variant",
        }),
      }),
    });
  });

  it("returns 400 for malformed event payloads instead of throwing", async () => {
    const response = await POST(rawRequest("POST", "{"));

    expect(response.status).toBe(400);
    expect(userEventMock.create).not.toHaveBeenCalled();
  });

  it("applies the same allowlist to batched phase 1 events", async () => {
    await PUT(request("PUT", {
      events: [
        {
          event: "onboarding_teaser_viewed",
          metadata: {
            surface: "onboarding",
            plan_tier: "free",
            experiment_flag: "ux_onboarding_teaser_v1",
            variant: "variant",
            move_date: "2026-08-01",
            destination_address: "Austin, TX",
          },
        },
      ],
    }));

    expect(userEventMock.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user_1",
          sessionId: null,
          event: "onboarding_teaser_viewed",
          page: null,
          metadata: JSON.stringify({
            surface: "onboarding",
            plan_tier: "free",
            experiment_flag: "ux_onboarding_teaser_v1",
            variant: "variant",
          }),
        },
      ],
    });
  });

  it("falls back safely for malformed batched event fields", async () => {
    await PUT(request("PUT", {
      events: [
        null,
        {
          event: 123,
          page: 456,
          sessionId: { bad: true },
          metadata: { query_length: 14 },
        },
      ],
    }));

    expect(userEventMock.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user_1",
          sessionId: null,
          event: "UNKNOWN",
          page: null,
          metadata: JSON.stringify({ query_length: 14 }),
        },
      ],
    });
  });

  it("can sample out non-experiment events when sampling is explicitly enabled", async () => {
    runtimeConfigMock.mockImplementation(async (key: string) => {
      if (key === "USER_EVENT_SAMPLING_ENABLED") return "true";
      if (key === "USER_EVENT_SAMPLING_RATE") return "0";
      return null;
    });

    const response = await POST(request("POST", {
      event: "provider_search",
      metadata: { query_length: 12 },
    }));

    await expect(response.json()).resolves.toEqual({ success: true, sampled: true });
    expect(userEventMock.create).not.toHaveBeenCalled();
  });

  it("keeps Phase-1 experiment events at 100 percent even when non-experiment sampling is zero", async () => {
    runtimeConfigMock.mockImplementation(async (key: string) => {
      if (key === "USER_EVENT_SAMPLING_ENABLED") return "true";
      if (key === "USER_EVENT_SAMPLING_RATE") return "0";
      return null;
    });

    await POST(request("POST", {
      event: "ai_briefing_viewed",
      metadata: {
        surface: "dashboard",
        briefing_state: "fallback",
        briefing_mode: "rule_based",
        experiment_flag: "ux_ai_briefing_experience_v1",
        variant: "variant",
      },
    }));

    expect(userEventMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: "ai_briefing_viewed",
        metadata: JSON.stringify({
          surface: "dashboard",
          briefing_state: "fallback",
          briefing_mode: "rule_based",
          experiment_flag: "ux_ai_briefing_experience_v1",
          variant: "variant",
        }),
      }),
    });
  });

  it("samples batched non-experiment events while preserving Phase-1 events", async () => {
    runtimeConfigMock.mockImplementation(async (key: string) => {
      if (key === "USER_EVENT_SAMPLING_ENABLED") return "true";
      if (key === "USER_EVENT_SAMPLING_RATE") return "0";
      return null;
    });

    const response = await PUT(request("PUT", {
      events: [
        { event: "provider_search", metadata: { query_length: 14 } },
        {
          event: "trust_copy_shown",
          metadata: {
            surface: "moving_plan",
            transition_action_type: "transfer",
            experiment_flag: "ux_trust_copy_v1",
            variant: "variant",
          },
        },
      ],
    }));

    await expect(response.json()).resolves.toEqual({ success: true, count: 1, sampled: 1 });
    expect(userEventMock.createMany).toHaveBeenCalledWith({
      data: [
        {
          userId: "user_1",
          sessionId: null,
          event: "trust_copy_shown",
          page: null,
          metadata: JSON.stringify({
            surface: "moving_plan",
            transition_action_type: "transfer",
            experiment_flag: "ux_trust_copy_v1",
            variant: "variant",
          }),
        },
      ],
    });
  });
});
