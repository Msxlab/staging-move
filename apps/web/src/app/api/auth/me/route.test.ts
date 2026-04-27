import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  destroyUserSession: vi.fn(),
  userFindFirst: vi.fn(),
  getRateLimitKey: vi.fn(() => "auth:me:optional:127.0.0.1"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true, resetAt: Date.now() + 60_000 })),
}));

vi.mock("@/lib/user-auth", () => ({
  getUserSession: (...args: unknown[]) => mocks.getUserSession(...args),
  destroyUserSession: (...args: unknown[]) => mocks.destroyUserSession(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: { findFirst: (...args: unknown[]) => mocks.userFindFirst(...args) },
  },
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: (request: unknown, prefix: unknown) => (mocks.getRateLimitKey as any)(request, prefix),
  rateLimit: (key: unknown, config: unknown) => (mocks.rateLimit as any)(key, config),
}));

import { GET } from "./route";

function request(path: string) {
  return new NextRequest(`https://locateflow.com${path}`);
}

describe("/api/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUserSession.mockResolvedValue(null);
    mocks.userFindFirst.mockResolvedValue(null);
    mocks.rateLimit.mockResolvedValue({ success: true, resetAt: Date.now() + 60_000 });
  });

  it("returns quiet logged-out state for optional auth checks", async () => {
    const response = await GET(request("/api/auth/me?optional=1"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ authenticated: false, user: null });
    expect(mocks.rateLimit).toHaveBeenCalledWith("auth:me:optional:127.0.0.1", {
      limit: 200,
      windowSeconds: 60,
      failClosed: false,
    });
  });

  it("keeps normal logged-out checks as 401", async () => {
    const response = await GET(request("/api/auth/me"));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toMatchObject({ error: "Unauthorized", user: null });
    expect(mocks.rateLimit).not.toHaveBeenCalled();
  });

  it("rate limits optional auth checks without failing closed on Redis availability", async () => {
    mocks.rateLimit.mockResolvedValueOnce({ success: false, resetAt: Date.now() + 60_000 });

    const response = await GET(request("/api/auth/me?optional=1"));
    const body = await response.json();

    expect(response.status).toBe(429);
    expect(body.error).toBe("Too many requests. Please try again later.");
  });

  it("returns a quiet logged-out state for optional checks when the session user no longer exists", async () => {
    getUserSessionMock.mockResolvedValue({ userId: "user_1" });
    userFindUniqueMock.mockResolvedValue(null);

    const response = await GET(makeRequest("/api/auth/me?optional=true"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({ authenticated: false, user: null });
  });
});
