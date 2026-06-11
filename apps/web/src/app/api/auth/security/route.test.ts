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
      updateMany: vi.fn(() => Promise.resolve({ count: 0 })),
      create: vi.fn(() => Promise.resolve({})),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  getUserSession: vi.fn(),
  generateOpaqueToken: vi.fn(() => ({ token: "reset-token", hash: "reset-hash" })),
}));

vi.mock("@/lib/email-service", () => ({
  sendPasswordResetEmail: vi.fn(() => Promise.resolve(true)),
}));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { sendPasswordResetEmail } from "@/lib/email-service";
import { POST } from "./route";

const userMock = prisma.user as unknown as { findUnique: Mock; update: Mock };
const auditLogMock = prisma.auditLog as unknown as { create: Mock };
const tokenMock = prisma.passwordResetToken as unknown as {
  findFirst: Mock;
  updateMany: Mock;
  create: Mock;
};
const sendPasswordResetEmailMock = sendPasswordResetEmail as unknown as Mock;

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
    // Prior unused setup/reset links are superseded before a new one is issued.
    expect(tokenMock.updateMany).toHaveBeenCalledWith({
      where: { userId: "user_1", usedAt: null },
      data: { usedAt: expect.any(Date) },
    });
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

  it("does not send a new link when an unused link was issued recently", async () => {
    tokenMock.findFirst.mockResolvedValue({ id: "token_recent" });

    const response = await POST(
      makeRequest({ action: "request_set_password" }),
    );

    expect(response.status).toBe(200);
    expect(tokenMock.create).not.toHaveBeenCalled();
    expect(tokenMock.updateMany).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });

  it("rejects the legacy session-only set_password action", async () => {
    const response = await POST(
      makeRequest({ action: "set_password", newPassword: "Strong-Password-1!" }),
    );

    // The session-only password write was removed (SCOPE W-01/M-01). The action
    // no longer matches the discriminated union and is a validation error.
    expect(response.status).toBe(400);
    expect(userMock.update).not.toHaveBeenCalled();
    expect(tokenMock.create).not.toHaveBeenCalled();
    expect(sendPasswordResetEmailMock).not.toHaveBeenCalled();
  });
});
