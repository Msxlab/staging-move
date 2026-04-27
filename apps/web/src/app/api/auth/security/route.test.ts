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
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  getUserSession: vi.fn(),
  hashPassword: vi.fn(() => Promise.resolve("new-hash")),
  validatePasswordPolicy: vi.fn(() => null),
}));

vi.mock("@/lib/email-service", () => ({
  sendSecurityNoticeEmail: vi.fn(() => Promise.resolve(true)),
}));

import { prisma } from "@/lib/db";
import { getUserSession } from "@/lib/user-auth";
import { sendSecurityNoticeEmail } from "@/lib/email-service";
import { POST } from "./route";

const userMock = prisma.user as unknown as { findUnique: Mock; update: Mock };
const auditLogMock = prisma.auditLog as unknown as { create: Mock };
const sendSecurityNoticeEmailMock = sendSecurityNoticeEmail as unknown as Mock;

function makeRequest(body: unknown) {
  return new NextRequest("https://locateflow.com/api/auth/security", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("auth security route — set_password", () => {
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

  it("emails the owner after an OAuth user adds an initial password", async () => {
    const response = await POST(
      makeRequest({ action: "set_password", newPassword: "Strong-Password-1!" }),
    );

    expect(response.status).toBe(200);
    expect(userMock.update).toHaveBeenCalled();
    expect(auditLogMock.create).toHaveBeenCalled();
    expect(sendSecurityNoticeEmailMock).toHaveBeenCalledTimes(1);
    const args = sendSecurityNoticeEmailMock.mock.calls[0][0];
    expect(args.userEmail).toBe("user@example.com");
    expect(args.kind).toBe("password-changed");
    expect(args.detail).toMatch(/password was added/i);
    expect(args.dedupeKey).toMatch(/^pwd-set:user_1:\d+$/);
  });

  it("rejects set_password when the account already has a password", async () => {
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
      makeRequest({ action: "set_password", newPassword: "Strong-Password-1!" }),
    );

    expect(response.status).toBe(400);
    expect(userMock.update).not.toHaveBeenCalled();
    expect(sendSecurityNoticeEmailMock).not.toHaveBeenCalled();
  });
});
