import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

const mocks = vi.hoisted(() => ({
  emailVerificationTokenFindUnique: vi.fn(),
  emailVerificationTokenUpdateMany: vi.fn(),
  userFindFirst: vi.fn(),
  userUpdate: vi.fn(),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    emailVerificationToken: {
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    user: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(async (fn: any) =>
      fn({
        emailVerificationToken: { updateMany: mocks.emailVerificationTokenUpdateMany },
        user: { update: mocks.userUpdate },
      }),
    ),
  },
}));

vi.mock("@/lib/user-auth", () => ({
  hashOpaqueToken: vi.fn(() => "verify-hash"),
}));

vi.mock("@/lib/email-service", () => ({
  sendWelcomeEmail: vi.fn(() => Promise.resolve(true)),
}));

import { prisma } from "@/lib/db";
import { sendWelcomeEmail } from "@/lib/email-service";
import { POST } from "./route";

const tokenMock = prisma.emailVerificationToken as unknown as {
  findUnique: Mock;
  updateMany: Mock;
};
const userMock = prisma.user as unknown as {
  findFirst: Mock;
  update: Mock;
};
const sendWelcomeEmailMock = sendWelcomeEmail as unknown as Mock;

function makeRequest(token = "verify-token") {
  return new NextRequest("http://localhost/api/auth/verify-email", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ token }),
  });
}

describe("verify-email route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tokenMock.findUnique.mockImplementation((...args: unknown[]) =>
      mocks.emailVerificationTokenFindUnique(...args),
    );
    tokenMock.updateMany.mockImplementation((...args: unknown[]) =>
      mocks.emailVerificationTokenUpdateMany(...args),
    );
    userMock.findFirst.mockImplementation((...args: unknown[]) =>
      mocks.userFindFirst(...args),
    );
    userMock.update.mockImplementation((...args: unknown[]) =>
      mocks.userUpdate(...args),
    );
    mocks.emailVerificationTokenFindUnique.mockResolvedValue({
      id: "evt_1",
      userId: "user_1",
      email: "new@example.com",
      tokenHash: "verify-hash",
      expiresAt: new Date(Date.now() + 60_000),
      consumedAt: null,
    });
    mocks.emailVerificationTokenUpdateMany.mockResolvedValue({ count: 1 });
    mocks.userUpdate.mockResolvedValue({});
    mocks.userFindFirst.mockResolvedValue({
      id: "user_1",
      email: "new@example.com",
      firstName: "New",
    });
    sendWelcomeEmailMock.mockResolvedValue(true);
  });

  it("marks the token used, verifies the user, and sends welcome once", async () => {
    const response = await POST(makeRequest());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toEqual({ success: true });
    expect(mocks.emailVerificationTokenUpdateMany).toHaveBeenCalledWith({
      where: {
        id: "evt_1",
        consumedAt: null,
        expiresAt: { gt: expect.any(Date) },
      },
      data: { consumedAt: expect.any(Date) },
    });
    expect(mocks.userUpdate).toHaveBeenCalledWith({
      where: { id: "user_1" },
      data: { emailVerifiedAt: expect.any(Date) },
    });
    expect(sendWelcomeEmailMock).toHaveBeenCalledWith({
      email: "new@example.com",
      firstName: "New",
      dedupeKey: "welcome:user_1",
    });
  });

  it("does not send welcome for an invalid or already consumed token", async () => {
    mocks.emailVerificationTokenFindUnique.mockResolvedValue(null);

    const response = await POST(makeRequest());

    expect(response.status).toBe(400);
    expect(sendWelcomeEmailMock).not.toHaveBeenCalled();
  });
});
