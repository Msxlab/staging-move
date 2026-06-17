import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { Prisma } from "@locateflow/db";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  pushUpsert: vi.fn(),
  pushDeleteMany: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: () => mocks.requireDbUserId(),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: () => "rate-key",
  rateLimit: (...args: unknown[]) => mocks.rateLimit(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    pushDevice: {
      upsert: (...args: unknown[]) => mocks.pushUpsert(...args),
      deleteMany: (...args: unknown[]) => mocks.pushDeleteMany(...args),
    },
  },
}));

import { DELETE, POST } from "./route";

const TOKEN = "ExponentPushToken[abcdefghijklmnopqrstuvwxyz]";

function postRequest(body: unknown) {
  return new NextRequest("https://app.locateflow.com/api/push/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("push register route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user-1");
    mocks.pushUpsert.mockResolvedValue({ id: "device-1" });
    mocks.pushDeleteMany.mockResolvedValue({ count: 1 });
    mocks.rateLimit.mockResolvedValue({ success: true });
  });

  it("registers a token for the current user via upsert", async () => {
    const response = await POST(postRequest({ token: TOKEN, platform: "ios", deviceName: "iPhone" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "device-1" });
    expect(mocks.pushUpsert).toHaveBeenCalledWith({
      where: { token: TOKEN },
      update: { userId: "user-1", platform: "ios", deviceName: "iPhone", lastSeenAt: expect.any(Date) },
      create: { userId: "user-1", token: TOKEN, platform: "ios", deviceName: "iPhone" },
    });
  });

  it("reassigns a reused device's token to the current user instead of rejecting", async () => {
    // Push tokens are per-device: when a device that previously belonged to
    // another user signs in, the registration must move the token to the new
    // user (the upsert update sets userId), not return 409.
    const response = await POST(postRequest({ token: TOKEN, platform: "android", deviceName: "Pixel" }));

    expect(response.status).toBe(200);
    expect(mocks.pushUpsert).toHaveBeenCalledWith({
      where: { token: TOKEN },
      update: expect.objectContaining({ userId: "user-1", platform: "android", deviceName: "Pixel" }),
      create: expect.objectContaining({ userId: "user-1", token: TOKEN }),
    });
  });

  it("returns 409 only when a concurrent insert loses the unique race", async () => {
    mocks.pushUpsert.mockRejectedValueOnce(
      new Prisma.PrismaClientKnownRequestError("unique", { code: "P2002", clientVersion: "test" }),
    );

    const response = await POST(postRequest({ token: TOKEN, platform: "ios" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Push token registration conflict");
  });

  it("does not let unregister requests delete another user's token", async () => {
    const response = await DELETE(postRequest({ token: TOKEN }));

    expect(response.status).toBe(200);
    expect(mocks.pushDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", token: TOKEN } });
  });

  it("rejects registration once the rate limit is exhausted", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ success: false });

    const response = await POST(postRequest({ token: TOKEN, platform: "ios" }));

    expect(response.status).toBe(429);
    expect(mocks.pushUpsert).not.toHaveBeenCalled();
  });
});
