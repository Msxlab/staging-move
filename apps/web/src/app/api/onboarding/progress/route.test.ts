import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { ONBOARDING_SERVICES_SKIPPED_EVENT } from "@/lib/onboarding-progress";

vi.mock("@/lib/db", () => ({
  prisma: {
    userEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user-1")),
}));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const userEvent = prisma.userEvent as unknown as { findFirst: Mock; create: Mock };

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

  it("rejects unknown progress events", async () => {
    const response = await POST(makeRequest({ event: "FUTURE_STEP" }));

    expect(response.status).toBe(400);
    expect(userEvent.create).not.toHaveBeenCalled();
  });
});
