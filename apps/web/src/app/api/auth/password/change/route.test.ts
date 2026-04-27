import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  requireDbUserId: vi.fn(),
  verifyPassword: vi.fn(),
  hashPassword: vi.fn(() => Promise.resolve("new-hash")),
  validatePasswordPolicy: vi.fn(() => null),
  destroyAllUserSessions: vi.fn(() => Promise.resolve()),
  createUserSession: vi.fn(() => Promise.resolve()),
  generateFingerprint: vi.fn(() => Promise.resolve("fp")),
}));

vi.mock("@/lib/rate-limit", () => ({
  resolveClientIP: vi.fn(() => "127.0.0.1"),
}));

vi.mock("@/lib/email-service", () => ({
  sendSecurityNoticeEmail: vi.fn(() => Promise.resolve(true)),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId, verifyPassword } from "@/lib/user-auth";
import { sendSecurityNoticeEmail } from "@/lib/email-service";
import { PATCH } from "./route";

const userMock = prisma.user as unknown as { findUnique: Mock; update: Mock };
const sendSecurityNoticeEmailMock = sendSecurityNoticeEmail as unknown as Mock;

function makeRequest() {
  return new NextRequest("https://locateflow.com/api/auth/password/change", {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      currentPassword: "Current-Password-1!",
      newPassword: "New-Password-2!",
    }),
  });
}

describe("password change route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (requireDbUserId as unknown as Mock).mockResolvedValue("user_1");
    (verifyPassword as unknown as Mock).mockResolvedValue(true);
    userMock.findUnique.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      firstName: "User",
      passwordHash: "old-hash",
    });
    userMock.update.mockResolvedValue({});
  });

  it("emails the owner after a successful password change", async () => {
    const response = await PATCH(makeRequest());

    expect(response.status).toBe(200);
    expect(userMock.update).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { passwordHash: "new-hash" },
    });
    expect(sendSecurityNoticeEmailMock).toHaveBeenCalledTimes(1);
    const args = sendSecurityNoticeEmailMock.mock.calls[0][0];
    expect(args.userEmail).toBe("user@example.com");
    expect(args.userName).toBe("User");
    expect(args.kind).toBe("password-changed");
    expect(args.dedupeKey).toMatch(/^pwd-changed:user_1:\d+$/);
    expect(args.occurredAt).toBeInstanceOf(Date);
  });

  it("does not email when current password is wrong", async () => {
    (verifyPassword as unknown as Mock).mockResolvedValue(false);

    const response = await PATCH(makeRequest());

    expect(response.status).toBe(403);
    expect(userMock.update).not.toHaveBeenCalled();
    expect(sendSecurityNoticeEmailMock).not.toHaveBeenCalled();
  });

  it("does not email or update when the account has no password to change", async () => {
    userMock.findUnique.mockResolvedValue({
      id: "user_1",
      email: "user@example.com",
      firstName: "User",
      passwordHash: null,
    });

    const response = await PATCH(makeRequest());

    expect(response.status).toBe(400);
    expect(userMock.update).not.toHaveBeenCalled();
    expect(sendSecurityNoticeEmailMock).not.toHaveBeenCalled();
  });
});
