import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  rateLimit: vi.fn(),
  providerFindUnique: vi.fn(),
  feedbackUpsert: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireDbUserId: mocks.requireDbUserId }));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rl-key"),
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    serviceProvider: { findUnique: (...a: unknown[]) => mocks.providerFindUnique(...a) },
    recommendationFeedback: { upsert: (...a: unknown[]) => mocks.feedbackUpsert(...a) },
  },
}));

import { POST } from "./route";

function req(body: unknown) {
  return new NextRequest("https://locateflow.com/api/providers/recommendations/feedback", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/providers/recommendations/feedback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user_1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.providerFindUnique.mockResolvedValue({ id: "prov_1" });
    mocks.feedbackUpsert.mockResolvedValue({});
  });

  it("upserts a not-relevant dismissal for the (user, provider) pair", async () => {
    const res = await POST(req({ providerId: "prov_1", action: "NOT_RELEVANT" }));
    expect(res.status).toBe(200);
    expect(mocks.feedbackUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId_providerId: { userId: "user_1", providerId: "prov_1" } },
        create: expect.objectContaining({ userId: "user_1", providerId: "prov_1", action: "NOT_RELEVANT", until: null }),
        update: expect.objectContaining({ action: "NOT_RELEVANT", until: null }),
      }),
    );
  });

  it("records a snooze with an until timestamp", async () => {
    const res = await POST(req({ providerId: "prov_1", action: "SNOOZE", snoozeDays: 30 }));
    expect(res.status).toBe(200);
    const arg = mocks.feedbackUpsert.mock.calls[0][0];
    expect(arg.create.action).toBe("SNOOZE");
    expect(arg.create.until).toBeInstanceOf(Date);
  });

  it("404s for an unknown provider (no FK 500)", async () => {
    mocks.providerFindUnique.mockResolvedValue(null);
    const res = await POST(req({ providerId: "ghost" }));
    expect(res.status).toBe(404);
    expect(mocks.feedbackUpsert).not.toHaveBeenCalled();
  });

  it("rejects an invalid body", async () => {
    const res = await POST(req({ action: "NOT_RELEVANT" })); // missing providerId
    expect(res.status).toBe(400);
  });

  it("401s when unauthenticated", async () => {
    mocks.requireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await POST(req({ providerId: "prov_1" }));
    expect(res.status).toBe(401);
  });
});
