import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  verifyInternalAuth: vi.fn(),
  rateLimitLogCreate: vi.fn(),
}));

vi.mock("@/lib/internal-secrets", () => ({
  verifyInternalAuth: (...args: unknown[]) => mocks.verifyInternalAuth(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    rateLimitLog: {
      create: (...args: unknown[]) => mocks.rateLimitLogCreate(...args),
    },
  },
}));

import { POST } from "./route";

function request(body: unknown, authorization = "Bearer internal-secret") {
  return new NextRequest("https://app.locateflow.com/api/internal/rate-limit-log", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization,
    },
    body: JSON.stringify(body),
  });
}

describe("internal rate-limit log route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.verifyInternalAuth.mockReturnValue(true);
    mocks.rateLimitLogCreate.mockResolvedValue({ id: "log-1" });
  });

  it("preserves internal secret validation", async () => {
    mocks.verifyInternalAuth.mockReturnValue(false);

    const response = await POST(request({
      endpoint: "/api/login",
      count: 1,
      windowStart: "2026-01-01T00:00:00.000Z",
      windowEnd: "2026-01-01T00:01:00.000Z",
    }));

    expect(response.status).toBe(401);
    expect(mocks.rateLimitLogCreate).not.toHaveBeenCalled();
  });

  it("records a valid payload with normalized defaults", async () => {
    const response = await POST(request({
      endpoint: "/api/account/delete",
      count: 3,
      windowStart: "2026-01-01T00:00:00.000Z",
      windowEnd: "2026-01-01T00:10:00.000Z",
    }));

    expect(response.status).toBe(200);
    expect(mocks.rateLimitLogCreate).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ipAddress: "anonymous",
        endpoint: "/api/account/delete",
        count: 3,
        blocked: true,
        windowStart: new Date("2026-01-01T00:00:00.000Z"),
        windowEnd: new Date("2026-01-01T00:10:00.000Z"),
      }),
    });
  });

  it.each([
    ["non-api endpoint", { endpoint: "/admin/login", count: 1, windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:01:00.000Z" }],
    ["float count", { endpoint: "/api/login", count: 1.5, windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:01:00.000Z" }],
    ["oversized count", { endpoint: "/api/login", count: 100001, windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-01T00:01:00.000Z" }],
    ["invalid date", { endpoint: "/api/login", count: 1, windowStart: "not-a-date", windowEnd: "2026-01-01T00:01:00.000Z" }],
    ["reversed window", { endpoint: "/api/login", count: 1, windowStart: "2026-01-01T00:02:00.000Z", windowEnd: "2026-01-01T00:01:00.000Z" }],
    ["oversized window", { endpoint: "/api/login", count: 1, windowStart: "2026-01-01T00:00:00.000Z", windowEnd: "2026-01-03T00:00:00.000Z" }],
  ])("rejects %s", async (_name, body) => {
    const response = await POST(request(body));

    expect(response.status).toBe(400);
    expect(mocks.rateLimitLogCreate).not.toHaveBeenCalled();
  });
});
