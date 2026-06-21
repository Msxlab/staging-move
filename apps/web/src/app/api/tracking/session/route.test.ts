import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("@/lib/db", () => ({
  prisma: {
    userSession: {
      create: vi.fn(),
      updateMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/client-ip", () => ({
  resolveClientIpFromHeaders: vi.fn(() => "203.0.113.10"),
}));

vi.mock("@/lib/tracking-consent", () => ({
  getConsentedTrackingSession: vi.fn(),
}));

import { prisma } from "@/lib/db";
import { getConsentedTrackingSession } from "@/lib/tracking-consent";
import { PATCH, POST } from "./route";

const trackingMock = getConsentedTrackingSession as unknown as Mock;
const userSessionMock = prisma.userSession as unknown as {
  create: Mock;
  updateMany: Mock;
};

function request(method: "POST" | "PATCH", body: unknown, userAgent = "Vitest") {
  return new NextRequest("https://locateflow.com/api/tracking/session", {
    method,
    headers: { "Content-Type": "application/json", "User-Agent": userAgent },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  trackingMock.mockResolvedValue({
    disabled: false,
    authSession: { userId: "user_1" },
  });
  userSessionMock.create.mockResolvedValue({ id: "session_1" });
  userSessionMock.updateMany.mockResolvedValue({ count: 1 });
});

describe("/api/tracking/session", () => {
  it("does not create sessions when analytics tracking is disabled", async () => {
    trackingMock.mockResolvedValue({ disabled: true, authSession: null });

    const response = await POST(request("POST", { browser: "Chrome" }));

    await expect(response.json()).resolves.toEqual({ sessionId: null, disabled: true });
    expect(userSessionMock.create).not.toHaveBeenCalled();
  });

  it("requires an authenticated tracking session", async () => {
    trackingMock.mockResolvedValue({ disabled: false, authSession: null });

    const response = await POST(request("POST", { browser: "Chrome" }));

    expect(response.status).toBe(401);
    expect(userSessionMock.create).not.toHaveBeenCalled();
  });

  it("sanitizes and truncates client-supplied session attributes to DB limits", async () => {
    const response = await POST(request("POST", {
      browser: " Chrome\r\nInjected ".repeat(5),
      browserVersion: "12345678901234567890-extra",
      os: "iOS\u0000".repeat(30),
      osVersion: 18,
      device: "iPhone".repeat(20),
      deviceType: "MOBILE".repeat(10),
      platform: "",
      screenResolution: "9999x9999-extra-long",
      language: "en-US-extra-long",
      country: "United States".repeat(10),
      city: "Austin".repeat(30),
      region: "Texas".repeat(30),
    }));

    expect(response.status).toBe(200);
    expect(userSessionMock.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user_1",
        ipAddress: "203.0.113.10",
        browser: expect.stringMatching(/^ChromeInjected/),
        browserVersion: "12345678901234567890",
        os: expect.stringMatching(/^iOSiOS/),
        osVersion: null,
        device: expect.stringMatching(/^iPhone/),
        deviceType: "MOBILEMOBILEMOBILEMO",
        platform: "WEB",
        screenResolution: "9999x9999-extra-long",
        language: "en-US-extr",
        country: expect.stringMatching(/^United States/),
        city: expect.stringMatching(/^Austin/),
        region: expect.stringMatching(/^Texas/),
      }),
    });
  });

  it("clamps page view updates and preserves the ownership check", async () => {
    const response = await PATCH(request("PATCH", {
      sessionId: "session_1",
      pageViews: 999_999,
    }));

    expect(response.status).toBe(200);
    expect(userSessionMock.updateMany).toHaveBeenCalledWith({
      where: { id: "session_1", userId: "user_1" },
      data: {
        lastActivity: expect.any(Date),
        pageViews: 100_000,
      },
    });
  });

  it("rejects non-string session ids before the ownership update", async () => {
    const response = await PATCH(request("PATCH", {
      sessionId: { bad: true },
      pageViews: 4,
    }));

    expect(response.status).toBe(400);
    expect(userSessionMock.updateMany).not.toHaveBeenCalled();
  });
});
