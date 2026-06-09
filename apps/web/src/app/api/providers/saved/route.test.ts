import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  requireDbUserId: vi.fn(),
  rateLimit: vi.fn(),
  savedFindMany: vi.fn(),
  savedUpsert: vi.fn(),
  savedDeleteMany: vi.fn(),
  providerFindUnique: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({ requireDbUserId: mocks.requireDbUserId }));
vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rl"),
  rateLimit: mocks.rateLimit,
}));
vi.mock("@/lib/db", () => ({
  prisma: {
    savedProvider: {
      findMany: (...a: unknown[]) => mocks.savedFindMany(...a),
      upsert: (...a: unknown[]) => mocks.savedUpsert(...a),
      deleteMany: (...a: unknown[]) => mocks.savedDeleteMany(...a),
    },
    serviceProvider: { findUnique: (...a: unknown[]) => mocks.providerFindUnique(...a) },
  },
}));

import { GET, POST, DELETE } from "./route";

function req(method: string, body?: unknown) {
  return new NextRequest("https://locateflow.com/api/providers/saved", {
    method,
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

describe("/api/providers/saved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireDbUserId.mockResolvedValue("user_1");
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.savedFindMany.mockResolvedValue([{ providerId: "a" }, { providerId: "b" }]);
    mocks.providerFindUnique.mockResolvedValue({ id: "a" });
    mocks.savedUpsert.mockResolvedValue({});
    mocks.savedDeleteMany.mockResolvedValue({ count: 1 });
  });

  it("GET returns the saved provider ids", async () => {
    const res = await GET();
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.providerIds).toEqual(["a", "b"]);
  });

  it("POST upserts a save for the (user, provider) pair", async () => {
    const res = await POST(req("POST", { providerId: "a" }));
    expect(res.status).toBe(200);
    expect(mocks.savedUpsert).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId_providerId: { userId: "user_1", providerId: "a" } } }),
    );
  });

  it("POST 404s for an unknown provider", async () => {
    mocks.providerFindUnique.mockResolvedValue(null);
    const res = await POST(req("POST", { providerId: "ghost" }));
    expect(res.status).toBe(404);
    expect(mocks.savedUpsert).not.toHaveBeenCalled();
  });

  it("DELETE removes the save", async () => {
    const res = await DELETE(req("DELETE", { providerId: "a" }));
    expect(res.status).toBe(200);
    expect(mocks.savedDeleteMany).toHaveBeenCalledWith({ where: { userId: "user_1", providerId: "a" } });
  });

  it("401s when unauthenticated", async () => {
    mocks.requireDbUserId.mockRejectedValue(new Error("UNAUTHORIZED"));
    const res = await GET();
    expect(res.status).toBe(401);
  });
});
