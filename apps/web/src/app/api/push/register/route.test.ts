import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  pushFindUnique: vi.fn(),
  pushCreate: vi.fn(),
  pushUpdate: vi.fn(),
  pushDeleteMany: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  requireDbUserId: () => mocks.requireDbUserId(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    pushDevice: {
      findUnique: (...args: unknown[]) => mocks.pushFindUnique(...args),
      create: (...args: unknown[]) => mocks.pushCreate(...args),
      update: (...args: unknown[]) => mocks.pushUpdate(...args),
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
    mocks.pushFindUnique.mockResolvedValue(null);
    mocks.pushCreate.mockResolvedValue({ id: "device-1" });
    mocks.pushUpdate.mockResolvedValue({ id: "device-1" });
    mocks.pushDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("creates a new token for the current user", async () => {
    const response = await POST(postRequest({ token: TOKEN, platform: "ios", deviceName: "iPhone" }));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ id: "device-1" });
    expect(mocks.pushCreate).toHaveBeenCalledWith({
      data: { userId: "user-1", token: TOKEN, platform: "ios", deviceName: "iPhone" },
    });
    expect(mocks.pushUpdate).not.toHaveBeenCalled();
  });

  it("updates metadata when the token already belongs to the current user", async () => {
    mocks.pushFindUnique.mockResolvedValue({ id: "device-1", userId: "user-1" });

    const response = await POST(postRequest({ token: TOKEN, platform: "android", deviceName: "Pixel" }));

    expect(response.status).toBe(200);
    expect(mocks.pushUpdate).toHaveBeenCalledWith({
      where: { id: "device-1" },
      data: expect.objectContaining({ platform: "android", deviceName: "Pixel" }),
    });
    expect(mocks.pushCreate).not.toHaveBeenCalled();
  });

  it("rejects cross-user token takeover attempts", async () => {
    mocks.pushFindUnique.mockResolvedValue({ id: "device-1", userId: "user-2" });

    const response = await POST(postRequest({ token: TOKEN, platform: "ios" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Push token already registered");
    expect(mocks.pushCreate).not.toHaveBeenCalled();
    expect(mocks.pushUpdate).not.toHaveBeenCalled();
  });

  it("does not let unregister requests delete another user's token", async () => {
    const response = await DELETE(postRequest({ token: TOKEN }));

    expect(response.status).toBe(200);
    expect(mocks.pushDeleteMany).toHaveBeenCalledWith({ where: { userId: "user-1", token: TOKEN } });
  });
});
