import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUserSession: vi.fn(),
  generateOpaqueToken: vi.fn(() => ({ token: "verify-token", hash: "verify-hash" })),
  userFindFirst: vi.fn(),
  tokenCreate: vi.fn(),
  tokenUpdateMany: vi.fn(),
  sendEmailVerificationEmail: vi.fn(),
  rateLimit: vi.fn(),
  getRateLimitKey: vi.fn(() => "rate-key"),
}));

vi.mock("@/lib/user-auth", () => ({
  getUserSession: (...args: unknown[]) => mocks.getUserSession(...args),
  generateOpaqueToken: (...args: unknown[]) => (mocks.generateOpaqueToken as any)(...args),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findFirst: (...args: unknown[]) => mocks.userFindFirst(...args),
    },
    emailVerificationToken: {
      create: (...args: unknown[]) => mocks.tokenCreate(...args),
      updateMany: (...args: unknown[]) => mocks.tokenUpdateMany(...args),
    },
  },
}));

vi.mock("@/lib/email-service", () => ({
  sendEmailVerificationEmail: (...args: unknown[]) => mocks.sendEmailVerificationEmail(...args),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: (...args: unknown[]) => (mocks.getRateLimitKey as any)(...args),
  rateLimit: (...args: unknown[]) => mocks.rateLimit(...args),
}));

import { POST } from "./route";

function request() {
  return new NextRequest("https://locateflow.com/api/auth/resend-verification", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: "{}",
  });
}

describe("resend verification route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.rateLimit.mockResolvedValue({ success: true });
    mocks.getUserSession.mockResolvedValue({ userId: "user_1" });
    mocks.userFindFirst.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      firstName: "Person",
      emailVerifiedAt: null,
      passwordHash: "hash",
      oauthAccounts: [],
    });
    mocks.tokenCreate.mockResolvedValue({});
    mocks.tokenUpdateMany.mockResolvedValue({ count: 0 });
    mocks.sendEmailVerificationEmail.mockResolvedValue(undefined);
  });

  it("sends a single verification email for the current unverified password user", async () => {
    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(mocks.tokenCreate).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        email: "person@example.com",
        tokenHash: "verify-hash",
        expiresAt: expect.any(Date),
      },
    });
    expect(mocks.sendEmailVerificationEmail).toHaveBeenCalledWith({
      userEmail: "person@example.com",
      userName: "Person",
      verifyToken: "verify-token",
      dedupeKey: "verify:user_1:verify-hash",
    });
  });

  it("does not send email for logged-out requests", async () => {
    mocks.getUserSession.mockResolvedValue(null);

    const response = await POST(request());

    expect(response.status).toBe(401);
    expect(mocks.userFindFirst).not.toHaveBeenCalled();
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
    expect(mocks.sendEmailVerificationEmail).not.toHaveBeenCalled();
  });

  it("treats already verified or OAuth-only users as already verified", async () => {
    mocks.userFindFirst.mockResolvedValue({
      id: "user_1",
      email: "person@example.com",
      firstName: "Person",
      emailVerifiedAt: new Date("2026-04-26T12:00:00Z"),
      passwordHash: null,
      oauthAccounts: [{ id: "oauth_1" }],
    });

    const response = await POST(request());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.alreadyVerified).toBe(true);
    expect(mocks.tokenCreate).not.toHaveBeenCalled();
    expect(mocks.sendEmailVerificationEmail).not.toHaveBeenCalled();
  });
});
