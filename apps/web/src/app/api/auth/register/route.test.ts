import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    emailVerificationToken: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/user-auth", () => ({
  hashPassword: vi.fn(() => Promise.resolve("hashed-password")),
  validatePasswordPolicy: vi.fn(() => null),
  generateOpaqueToken: vi.fn(() => ({ token: "verify-token", hash: "verify-hash" })),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/email-service", () => ({
  sendEmailVerificationEmail: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/legal-acceptance", () => ({
  normalizeAcceptedLegalConsents: vi.fn((consents) => consents || null),
  recordLegalAcceptance: vi.fn(() => Promise.resolve()),
}));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const userMock = prisma.user as unknown as {
  findUnique: Mock;
  create: Mock;
  update: Mock;
};
const tokenMock = prisma.emailVerificationToken as unknown as { create: Mock };

const validBody = {
  email: "new@example.com",
  password: "Valid-Password-2026!",
  firstName: "New",
  lastName: "User",
  legalConsents: {
    termsAccepted: true,
    disclaimerAccepted: true,
    termsVersion: "2026-03-13",
    disclaimerVersion: "2026-03-13",
    acceptedAt: "2026-04-25T12:00:00.000Z",
  },
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("register route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    userMock.findUnique.mockResolvedValue(null);
    userMock.create.mockResolvedValue({ id: "user-new", email: "new@example.com" });
    tokenMock.create.mockResolvedValue({});
  });

  it("returns 409 for an existing password account", async () => {
    userMock.findUnique.mockResolvedValue({ id: "user-existing", deletedAt: null });

    const response = await POST(makeRequest({ ...validBody, email: "existing@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Account already exists.");
    expect(userMock.create).not.toHaveBeenCalled();
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it("returns 409 for an existing OAuth-only account and does not attach a password", async () => {
    userMock.findUnique.mockResolvedValue({ id: "oauth-user", deletedAt: null });

    const response = await POST(makeRequest({ ...validBody, email: "oauth@example.com" }));

    expect(response.status).toBe(409);
    expect(userMock.create).not.toHaveBeenCalled();
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it("creates a new account for a new email", async () => {
    const response = await POST(makeRequest(validBody));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.userId).toBe("user-new");
    expect(userMock.create).toHaveBeenCalledWith({
      data: {
        email: "new@example.com",
        passwordHash: "hashed-password",
        firstName: "New",
        lastName: "User",
      },
    });
    expect(tokenMock.create).toHaveBeenCalled();
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it("returns 409 for a soft-deleted email instead of reviving it", async () => {
    userMock.findUnique.mockResolvedValue({ id: "deleted-user", deletedAt: new Date("2026-04-01") });

    const response = await POST(makeRequest({ ...validBody, email: "deleted@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Account already exists.");
    expect(userMock.create).not.toHaveBeenCalled();
    expect(userMock.update).not.toHaveBeenCalled();
  });
});
