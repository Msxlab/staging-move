import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import {
  ONBOARDING_SERVICES_SKIPPED_EVENT,
  ONBOARDING_STARTED_EVENT,
  onboardingStepViewedEvent,
} from "@/lib/onboarding-progress";
import { ONBOARDING_COMPLETED_EVENT } from "@/lib/legal";

vi.mock("@/lib/db", () => ({
  prisma: {
    userEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    address: {
      count: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user-1")),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/workspace-data-scope", () => ({
  resolveWorkspaceDataScope: vi.fn(() =>
    Promise.resolve({
      actorUserId: "user-1",
      ownerUserId: "user-1",
      workspaceId: null,
      workspaceMode: false,
      memberRole: null,
      memberStatus: null,
    }),
  ),
  scopedRecordWhere: (_scope: unknown, extra: Record<string, unknown> = {}) => ({
    userId: "user-1",
    ...extra,
  }),
}));

vi.mock("@/lib/impersonation-audit", () => ({
  auditImpersonatedMutation: vi.fn(() => Promise.resolve()),
}));

import { prisma } from "@/lib/db";
import { rateLimit } from "@/lib/rate-limit";
import { POST } from "./route";

const userEvent = prisma.userEvent as unknown as { findFirst: Mock; create: Mock };
const addressCount = (prisma as unknown as { address: { count: Mock } }).address.count;
const mockRateLimit = rateLimit as unknown as Mock;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/onboarding/progress", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("onboarding progress route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userEvent.findFirst.mockResolvedValue(null);
    userEvent.create.mockResolvedValue({});
    addressCount.mockResolvedValue(1);
    mockRateLimit.mockResolvedValue({ success: true });
  });

  it("persists a services-skipped onboarding event idempotently", async () => {
    const response = await POST(makeRequest({ event: "SERVICES_SKIPPED" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.event).toBe(ONBOARDING_SERVICES_SKIPPED_EVENT);
    expect(userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        event: ONBOARDING_SERVICES_SKIPPED_EVENT,
        page: "/api/onboarding/progress",
      }),
    });
  });

  it("does not duplicate an existing progress event", async () => {
    userEvent.findFirst.mockResolvedValue({ id: "evt-1" });

    const response = await POST(makeRequest({ event: "SERVICES_SKIPPED" }));

    expect(response.status).toBe(200);
    expect(userEvent.create).not.toHaveBeenCalled();
  });

  it("records the ONBOARDING_STARTED funnel event", async () => {
    const response = await POST(makeRequest({ event: "STARTED" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.event).toBe(ONBOARDING_STARTED_EVENT);
    expect(userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", event: ONBOARDING_STARTED_EVENT }),
    });
  });

  it("records a per-step STEP_VIEWED event keyed by step", async () => {
    const response = await POST(makeRequest({ event: "STEP_VIEWED", step: "services" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.event).toBe(onboardingStepViewedEvent("services"));
    expect(userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        event: onboardingStepViewedEvent("services"),
        metadata: expect.stringContaining("services"),
      }),
    });
  });

  it("rejects STEP_VIEWED without a step", async () => {
    const response = await POST(makeRequest({ event: "STEP_VIEWED" }));

    expect(response.status).toBe(400);
    expect(userEvent.create).not.toHaveBeenCalled();
  });

  it("rejects STEP_VIEWED with an unknown step", async () => {
    const response = await POST(makeRequest({ event: "STEP_VIEWED", step: "checkout" }));

    expect(response.status).toBe(400);
    expect(userEvent.create).not.toHaveBeenCalled();
  });

  it("rejects unknown progress events", async () => {
    const response = await POST(makeRequest({ event: "FUTURE_STEP" }));

    expect(response.status).toBe(400);
    expect(userEvent.create).not.toHaveBeenCalled();
  });

  it("rejects COMPLETED when the user has no address (server-side prerequisite gate)", async () => {
    addressCount.mockResolvedValue(0);

    const response = await POST(makeRequest({ event: "COMPLETED" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/address/i);
    // No COMPLETED row may be persisted when the prerequisite is unmet.
    expect(userEvent.create).not.toHaveBeenCalled();
  });

  it("persists COMPLETED once at least one address exists", async () => {
    addressCount.mockResolvedValue(2);

    const response = await POST(makeRequest({ event: "COMPLETED" }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.event).toBe(ONBOARDING_COMPLETED_EVENT);
    expect(userEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ userId: "user-1", event: ONBOARDING_COMPLETED_EVENT }),
    });
  });

  it("does not run the address prerequisite check for non-COMPLETED events", async () => {
    await POST(makeRequest({ event: "SERVICES_SKIPPED" }));
    expect(addressCount).not.toHaveBeenCalled();
  });

  it("rejects writes once the rate limit is exhausted", async () => {
    mockRateLimit.mockResolvedValueOnce({ success: false });

    const response = await POST(makeRequest({ event: "SERVICES_SKIPPED" }));

    expect(response.status).toBe(429);
    expect(userEvent.findFirst).not.toHaveBeenCalled();
    expect(userEvent.create).not.toHaveBeenCalled();
  });
});
