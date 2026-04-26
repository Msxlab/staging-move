import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
    passwordResetToken: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  generateOpaqueToken: vi.fn(() => ({ token: "reset-token", hash: "reset-hash" })),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/email-service", () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve(true)),
}));

import { prisma } from "@/lib/db";
import { sendPasswordResetEmail } from "@/lib/email-service";
import { GENERIC_FORGOT_PASSWORD_MESSAGE, POST } from "./route";

const userMock = prisma.user as unknown as { findUnique: Mock };
const tokenMock = prisma.passwordResetToken as unknown as { create: Mock };
const sendPasswordResetEmailMock = sendPasswordResetEmail as unknown as Mock;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/password/reset/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function expectGenericSuccess(response: Response) {
  const body = await response.json();
  expect(response.status).toBe(200);
  expect(body).toEqual({ success: true, message: GENERIC_FORGOT_PASSWORD_MESSAGE });
}

describe("password reset request route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenMock.create.mockResolvedValue({});
    sendPasswordResetEmailMock.mockResolvedValue(true);
  });

  it("sends a password reset email for an existing password user", async () => {
    userMock.findUnique.mockResolvedValue({
      id: "user-password",
      email: "alice@example.com",
      firstName: "Alice",
      passwordHash: "hash",
      emailVerifiedAt: null,
      oauthAccounts: [],
    });

    const response = await POST(makeRequest({ email: "Alice@Example.com" }));

    await expectGenericSuccess(response);
    expect(tokenMock.create).toHaveBeenCalledWith({
      data: {
        userId: "user-password",
        tokenHash: "reset-hash",
        expiresAt: expect.any(Date),
      },
    });
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({
      userEmail: "alice@example.com",
      userName: "Alice",
      resetToken: "reset-token",
      mode: "reset",
      dedupeKey: "pwreset:user-password:reset-hash",
    });
  });

  it("returns generic success and sends nothing for an unknown email", async () => {
    userMock.findUnique.mockResolvedValue(null);

    const response = await POST(makeRequest({ email: "missing@example.com" }));

    await expectGenericSuccess(response);
    expect(tokenMock.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("sends a set-password link for a verified OAuth-only user", async () => {
    userMock.findUnique.mockResolvedValue({
      id: "user-oauth",
      email: "oauth@example.com",
      firstName: "Olivia",
      passwordHash: null,
      emailVerifiedAt: new Date("2026-04-26T12:00:00Z"),
      oauthAccounts: [{ id: "oauth-1", provider: "google" }],
    });

    const response = await POST(makeRequest({ email: "oauth@example.com" }));

    await expectGenericSuccess(response);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: "oauth@example.com",
        mode: "set-password",
      }),
    );
  });

  it("safely skips an OAuth-only user without a verified email", async () => {
    userMock.findUnique.mockResolvedValue({
      id: "user-oauth-unverified",
      email: "oauth-unverified@example.com",
      firstName: "Una",
      passwordHash: null,
      emailVerifiedAt: null,
      oauthAccounts: [{ id: "oauth-2", provider: "google" }],
    });

    const response = await POST(makeRequest({ email: "oauth-unverified@example.com" }));

    await expectGenericSuccess(response);
    expect(tokenMock.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });
});
