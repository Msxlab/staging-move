import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    userLoginSession: {
      findMany: vi.fn(() => Promise.resolve([])),
      updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
    },
    oAuthAccount: {
      findMany: vi.fn(() => Promise.resolve([])),
    },
    emailVerificationToken: {
      findFirst: vi.fn(() => Promise.resolve(null)),
    },
    passwordResetToken: {
      findFirst: vi.fn(() => Promise.resolve(null)),
      create: vi.fn(() => Promise.resolve({})),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  getUserSession: vi.fn(),
  generateOpaqueToken: vi.fn(() => ({ token: "reset-token", hash: "reset-hash" })),
  hashPassword: vi.fn(() => Promise.resolve("new-password-hash")),
  validatePasswordPolicy: vi.fn(() => null),
}));

vi.mock("@/lib/email-service", () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve(true)),
  sendSecurityNoticeEmail: vi.fn(() => Promise.resolve(true)),
}));

import { prisma } from "@/lib/db";
import { getUserSession, hashPassword } from "@/lib/user-auth";
import { sendPasswordResetEmail, sendSecurityNoticeEmail } from "@/lib/email-service";
import { POST } from "./route";

const userMock = prisma.user as unknown as { findUnique: Mock; update: Mock };
const auditLogMock = prisma.auditLog as unknown as { create: Mock };
const tokenMock = prisma.passwordResetToken as unknown as { findFirst: Mock; create: Mock };
const sendPasswordResetEmailMock = sendPasswordResetEmail as unknown as Mock;
const sendSecurityNoticeEmailMock = sendSecurityNoticeEmail as unknown as Mock;

function makeRequest(body: unknown) {
  return new NextRequest("https://locateflow.com/api/auth/security", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("auth security route - request_set_password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (getUserSession as unknown as Mock).mockResolvedValue({
      userId: "user_1",
      sessionId: "sess_1",
    });
    userMock.findUnique.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      firstName: "User",
      passwordHash: null,
      emailVerifiedAt: new Date("2026-01-01"),
      mfaEnabled: false,
      preferredLocale: "en",
      createdAt: new Date("2026-01-01"),
    });
    userMock.update.mockResolvedValue({});
    auditLogMock.create.mockResolvedValue({});
  });

  it("emails the owner a secure set-password link for an OAuth-only account", async () => {
    const response = await POST(
      makeRequest({ action: "request_set_password" }),
    );

    expect(response.status).toBe(200);
    expect(userMock.update).not.toHaveBeenCalled();
    expect(tokenMock.create).toHaveBeenCalledWith({
      data: {
        userId: "user_1",
        tokenHash: "reset-hash",
        expiresAt: expect.any(Date),
      },
    });
    expect(auditLogMock.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "SET_PWD_REQ" }),
    }));
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith({
      userEmail: "user@example.com",
      userName: "User",
      resetToken: "reset-token",
      mode: "set-password",
      locale: "en",
      dedupeKey: "pwreset:user_1:reset-hash",
    });
  });

  it("rejects request_set_password when the account already has a password", async () => {
    userMock.findUnique.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      firstName: "User",
      passwordHash: "existing-hash",
      emailVerifiedAt: new Date("2026-01-01"),
      mfaEnabled: false,
      preferredLocale: "en",
      createdAt: new Date("2026-01-01"),
    });

    const response = await POST(
      makeRequest({ action: "request_set_password" }),
    );

    expect(response.status).toBe(400);
    expect(userMock.update).not.toHaveBeenCalled();
    expect(tokenMock.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("sets a password directly for a verified OAuth-only account", async () => {
    const response = await POST(
      makeRequest({ action: "set_password", newPassword: "Strong-Password-1!" }),
    );

    expect(response.status).toBe(200);
    expect(hashPassword).toHaveBeenCalledWith("Strong-Password-1!");
    expect(userMock.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { passwordHash: "new-password-hash" },
    });
    expect(auditLogMock.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: "SET_PWD_DONE" }),
    }));
    expect(tokenMock.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
    expect(sendSecurityNoticeEmailMock).toHaveBeenCalledWith(expect.objectContaining({
      userEmail: "user@example.com",
      kind: "password-set",
      dedupeKey: "pwd-set:user_1",
    }));
  });
});
