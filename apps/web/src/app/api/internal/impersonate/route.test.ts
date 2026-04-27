import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: vi.fn(() => Promise.resolve({ id: "user_1", email: "user@example.com" })),
    },
    userLoginSession: {
      create: vi.fn(() => Promise.resolve({})),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  hashSessionToken: vi.fn(() => Promise.resolve("token-hash")),
}));

vi.mock("@/lib/internal-secrets", () => ({
  verifyInternalAuth: vi.fn(() => true),
}));

vi.mock("@/lib/runtime-config", () => ({
  getRuntimeConfigValue: vi.fn(() => Promise.resolve("https://locateflow.com")),
}));

vi.mock("@/lib/user-jwt-secret", () => ({
  getUserJwtSecretKey: vi.fn(() => new TextEncoder().encode("test-user-jwt-secret-32-characters")),
}));

import { POST } from "./route";

function makeRequest() {
  return new NextRequest("https://locateflow.com/api/internal/impersonate", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: "Bearer handoff-secret",
      "x-forwarded-for": "203.0.113.10",
    },
    body: JSON.stringify({ userId: "user_1", adminId: "admin_1", ttlMinutes: 15 }),
  });
}

describe("internal impersonation route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a handoff URL without embedding the token in query params", async () => {
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.token).toEqual(expect.any(String));
    expect(body.handoffUrl).toBe("https://locateflow.com/api/auth/impersonate-handoff");
    expect(body.handoffUrl).not.toContain("token=");
    expect(body.handoffUrl).not.toContain(encodeURIComponent(body.token));
  });
});
