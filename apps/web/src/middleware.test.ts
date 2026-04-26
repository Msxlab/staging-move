import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/ip-rules", () => ({
  checkIPAccess: vi.fn(() => Promise.resolve({ blocked: false })),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true, resetAt: Date.now() + 60_000 })),
}));

vi.mock("@/lib/user-jwt-secret", () => ({
  tryGetUserJwtSecretKey: vi.fn(() => null),
}));

import middleware from "./middleware";

function request(url: string, init?: any) {
  return new NextRequest(url, init);
}

describe("web middleware auth boundaries", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects protected pages to sign-in when no session cookie remains", async () => {
    const response = await middleware(request("https://locateflow.com/dashboard"));

    expect(response.status).toBe(307);
    expect(response.headers.get("location")).toBe("https://locateflow.com/sign-in?redirect=%2Fdashboard");
  });

  it("lets logout reach the route without a session so it stays idempotent", async () => {
    const response = await middleware(
      request("https://locateflow.com/api/auth/logout", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{}",
      }),
    );

    expect(response.status).toBe(200);
    expect(response.headers.get("x-middleware-next")).toBe("1");
  });
});
