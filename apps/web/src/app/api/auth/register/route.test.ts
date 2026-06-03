import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
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
  // rawPrisma: the un-extended client. The soft-delete extension hides
  // deletedAt != null rows from the wrapped `prisma` client's findUnique
  // post-check, so the register route uses rawPrisma to keep the
  // "block re-signup for soft-deleted emails" gate honest.
  rawPrisma: {
    user: {
      findUnique: vi.fn(),
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

vi.mock("@/lib/billing", () => ({
  ensureSubscriptionDefaults: vi.fn(() => Promise.resolve({ id: "sub-1" })),
}));

vi.mock("@/lib/legal-acceptance", () => ({
  normalizeAcceptedLegalConsents: vi.fn((consents) =>
    consents?.termsAccepted && consents?.disclaimerAccepted
      ? {
          termsAccepted: true,
          disclaimerAccepted: true,
          termsVersion: consents.termsVersion || "2026-03-13",
          disclaimerVersion: consents.disclaimerVersion || "2026-03-13",
          acceptedAt: consents.acceptedAt || "2026-04-27T12:00:00.000Z",
        }
      : null,
  ),
  recordLegalAcceptance: vi.fn(() => Promise.resolve()),
}));

import { prisma, rawPrisma } from "@/lib/db";
import { sendEmailVerificationEmail } from "@/lib/email-service";
import { ensureSubscriptionDefaults } from "@/lib/billing";
import { recordLegalAcceptance } from "@/lib/legal-acceptance";
import { POST } from "./route";

const userMock = prisma.user as unknown as {
  findUnique: Mock;
  create: Mock;
  update: Mock;
};
const rawUserMock = rawPrisma.user as unknown as {
  findUnique: Mock;
};
const tokenMock = prisma.emailVerificationToken as unknown as { create: Mock };
const sendEmailVerificationEmailMock = sendEmailVerificationEmail as unknown as Mock;
const ensureSubscriptionDefaultsMock = ensureSubscriptionDefaults as unknown as Mock;
const recordLegalAcceptanceMock = recordLegalAcceptance as unknown as Mock;

const validBody = {
  email: "new@example.com",
  password: "Valid-Password-2026!",
  firstName: "New",
  lastName: "User",
};

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("register route", () => {
  const OLD_QA_RESETTABLE_EMAIL = process.env.QA_RESETTABLE_ACCOUNT_EMAIL;
  const OLD_AGE_GATE = process.env.COPPA_AGE_GATE_ENABLED;

  beforeEach(() => {
    vi.clearAllMocks();
    userMock.findUnique.mockResolvedValue(null);
    rawUserMock.findUnique.mockResolvedValue(null);
    userMock.create.mockResolvedValue({ id: "user-new", email: "new@example.com" });
    tokenMock.create.mockResolvedValue({});
    delete process.env.COPPA_AGE_GATE_ENABLED;
    delete process.env.QA_RESETTABLE_ACCOUNT_EMAIL;
  });

  afterEach(() => {
    if (OLD_AGE_GATE === undefined) delete process.env.COPPA_AGE_GATE_ENABLED;
    else process.env.COPPA_AGE_GATE_ENABLED = OLD_AGE_GATE;
    if (OLD_QA_RESETTABLE_EMAIL === undefined) delete process.env.QA_RESETTABLE_ACCOUNT_EMAIL;
    else process.env.QA_RESETTABLE_ACCOUNT_EMAIL = OLD_QA_RESETTABLE_EMAIL;
  });

  it("returns 409 for an existing password account", async () => {
    rawUserMock.findUnique.mockResolvedValue({ id: "user-existing", deletedAt: null });

    const response = await POST(makeRequest({ ...validBody, email: "existing@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Account already exists.");
    expect(userMock.create).not.toHaveBeenCalled();
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it("returns 409 for an existing OAuth-only account and does not attach a password", async () => {
    rawUserMock.findUnique.mockResolvedValue({ id: "oauth-user", deletedAt: null });

    const response = await POST(makeRequest({ ...validBody, email: "oauth@example.com" }));

    expect(response.status).toBe(409);
    expect(userMock.create).not.toHaveBeenCalled();
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it("creates a new account for a new email without recording legal consent", async () => {
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
        preferredLocale: "en",
      },
    });
    expect(tokenMock.create).toHaveBeenCalled();
    expect(ensureSubscriptionDefaultsMock).toHaveBeenCalledWith("user-new");
    expect(sendEmailVerificationEmailMock).toHaveBeenCalledWith({
      userEmail: "new@example.com",
      userName: "New",
      verifyToken: "verify-token",
      locale: "en",
      dedupeKey: "verify:user-new:verify-hash",
    });
    expect(recordLegalAcceptanceMock).not.toHaveBeenCalled();
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it("auto-verifies only the single allowlisted QA account without sending a verification email", async () => {
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";
    userMock.create.mockResolvedValue({ id: "qa-user", email: "qa@example.com" });

    const response = await POST(makeRequest({ ...validBody, email: "QA@Example.com" }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.userId).toBe("qa-user");
    expect(userMock.create).toHaveBeenCalledWith({
      data: {
        email: "qa@example.com",
        passwordHash: "hashed-password",
        firstName: "New",
        lastName: "User",
        preferredLocale: "en",
        emailVerifiedAt: expect.any(Date),
      },
    });
    expect(tokenMock.create).not.toHaveBeenCalled();
    expect(sendEmailVerificationEmailMock).not.toHaveBeenCalled();
    expect(ensureSubscriptionDefaultsMock).toHaveBeenCalledWith("qa-user");
  });

  it("does not auto-verify normal users while the QA account env is configured", async () => {
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "qa@example.com";

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(201);
    expect(userMock.create).toHaveBeenCalledWith({
      data: {
        email: "new@example.com",
        passwordHash: "hashed-password",
        firstName: "New",
        lastName: "User",
        preferredLocale: "en",
      },
    });
    expect(tokenMock.create).toHaveBeenCalled();
    expect(sendEmailVerificationEmailMock).toHaveBeenCalled();
  });

  it("treats a comma-separated QA email config as disabled", async () => {
    process.env.QA_RESETTABLE_ACCOUNT_EMAIL = "new@example.com,other@example.com";

    const response = await POST(makeRequest(validBody));

    expect(response.status).toBe(201);
    expect(userMock.create).toHaveBeenCalledWith({
      data: {
        email: "new@example.com",
        passwordHash: "hashed-password",
        firstName: "New",
        lastName: "User",
        preferredLocale: "en",
      },
    });
    expect(tokenMock.create).toHaveBeenCalled();
    expect(sendEmailVerificationEmailMock).toHaveBeenCalled();
  });

  it("persists mobile legal consent during registration", async () => {
    const response = await POST(makeRequest({
      ...validBody,
      legalConsents: {
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-27T12:00:00.000Z",
      },
    }));

    expect(response.status).toBe(201);
    expect(ensureSubscriptionDefaultsMock).toHaveBeenCalledWith("user-new");
    expect(recordLegalAcceptanceMock).toHaveBeenCalledWith({
      userId: "user-new",
      request: expect.any(NextRequest),
      page: "/sign-up",
      source: "mobile_register",
      consents: {
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-27T12:00:00.000Z",
      },
    });
  });

  it("rejects incomplete mobile legal consent without creating a user", async () => {
    const response = await POST(makeRequest({
      ...validBody,
      legalConsents: {
        termsAccepted: true,
        disclaimerAccepted: false,
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("LEGAL_ACCEPTANCE_REQUIRED");
    expect(userMock.create).not.toHaveBeenCalled();
    expect(ensureSubscriptionDefaultsMock).not.toHaveBeenCalled();
    expect(recordLegalAcceptanceMock).not.toHaveBeenCalled();
  });

  it("returns 409 for a soft-deleted email instead of reviving it", async () => {
    rawUserMock.findUnique.mockResolvedValue({ id: "deleted-user", deletedAt: new Date("2026-04-01") });

    const response = await POST(makeRequest({ ...validBody, email: "deleted@example.com" }));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.error).toBe("Account already exists.");
    expect(userMock.create).not.toHaveBeenCalled();
    expect(userMock.update).not.toHaveBeenCalled();
  });

  it(
    "uses rawPrisma so the soft-delete client extension cannot hide a deleted " +
      "row and force a 500 from user.create's unique-email constraint",
    async () => {
      // Simulate the production soft-delete extension behavior: the
      // wrapped `prisma` client returns null for soft-deleted rows. The
      // raw client still returns the row.
      userMock.findUnique.mockResolvedValue(null);
      rawUserMock.findUnique.mockResolvedValue({
        id: "deleted-user",
        deletedAt: new Date("2026-04-01"),
      });

      const response = await POST(makeRequest({ ...validBody, email: "deleted@example.com" }));
      const body = await response.json();

      expect(response.status).toBe(409);
      expect(body.error).toBe("Account already exists.");
      // Regression: without the rawPrisma swap this fell through to
      // user.create and hit a P2002 unique constraint, surfacing as a
      // 500 with the user-facing message "We could not finish setting
      // up your social sign-in account." (sic, register has its own
      // path but the failure mode was the same).
      expect(userMock.create).not.toHaveBeenCalled();
      expect(rawUserMock.findUnique).toHaveBeenCalledWith({
        where: { email: "deleted@example.com" },
        select: { id: true, deletedAt: true },
      });
    },
  );

  // COPPA / minimum-age gate — inert unless COPPA_AGE_GATE_ENABLED is on.
  it("COPPA gate OFF (default): age confirmation is ignored, signup proceeds", async () => {
    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(201);
    expect(userMock.create).toHaveBeenCalled();
  });

  it("COPPA gate ON + not confirmed: 400 AGE_CONFIRMATION_REQUIRED, no user created", async () => {
    process.env.COPPA_AGE_GATE_ENABLED = "true";
    const response = await POST(makeRequest(validBody));
    const body = await response.json();
    expect(response.status).toBe(400);
    expect(body.code).toBe("AGE_CONFIRMATION_REQUIRED");
    expect(userMock.create).not.toHaveBeenCalled();
  });

  it("COPPA gate ON + confirmedAgeEligible=true: signup proceeds", async () => {
    process.env.COPPA_AGE_GATE_ENABLED = "true";
    const response = await POST(makeRequest({ ...validBody, confirmedAgeEligible: true }));
    expect(response.status).toBe(201);
    expect(userMock.create).toHaveBeenCalled();
  });

  it("COPPA gate accepts the '1' flag value too", async () => {
    process.env.COPPA_AGE_GATE_ENABLED = "1";
    const response = await POST(makeRequest(validBody));
    expect(response.status).toBe(400);
    expect(userMock.create).not.toHaveBeenCalled();
  });
});
