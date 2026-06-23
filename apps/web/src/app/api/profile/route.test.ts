import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { createAcceptedLegalConsents } from "@/lib/legal";
import { buildOnboardingProfilePayload } from "@/lib/onboarding-profile-payload";

vi.mock("@/lib/db", () => {
  const prisma: any = {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    userEvent: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
    },
    profile: {
      upsert: vi.fn(),
    },
    dataConsent: {
      findFirst: vi.fn(),
    },
    address: {
      findFirst: vi.fn(),
      count: vi.fn(),
    },
    service: {
      count: vi.fn(),
    },
    movingPlan: {
      count: vi.fn(),
    },
    // Interactive transaction: run the callback with the prisma mock as the tx
    // client so the wrapped user.update + profile.upsert hit the mocked
    // delegates. Tests can override to assert rollback.
    $transaction: vi.fn((cb: (tx: any) => unknown) => cb(prisma)),
  };
  return { prisma };
});

vi.mock("@/lib/auth", () => ({
  requireDbUserId: vi.fn(() => Promise.resolve("user-1")),
}));

vi.mock("@/lib/rate-limit", () => ({
  getRateLimitKey: vi.fn(() => "rate-key"),
  rateLimit: vi.fn(() => Promise.resolve({ success: true })),
}));

vi.mock("@/lib/billing", () => ({
  buildUnifiedEntitlementSnapshot: vi.fn(() => ({ isActive: true })),
  findSubscriptionForEntitlement: vi.fn(() => Promise.resolve(null)),
}));

import { prisma } from "@/lib/db";
import { requireDbUserId } from "@/lib/auth";
import { findSubscriptionForEntitlement } from "@/lib/billing";
import { GET, POST } from "./route";

const mockUser = prisma.user as unknown as { update: Mock; findUnique: Mock };
const mockUserEvent = prisma.userEvent as unknown as { findFirst: Mock; findMany: Mock; create: Mock };
const mockProfile = prisma.profile as unknown as { upsert: Mock };
const mockDataConsent = prisma.dataConsent as unknown as { findFirst: Mock };
const mockAddress = prisma.address as unknown as { count: Mock };
const mockService = (prisma as any).service as { count: Mock };
const mockMovingPlan = (prisma as any).movingPlan as { count: Mock };
const requireDbUserIdMock = requireDbUserId as unknown as Mock;
const findSubscriptionForEntitlementMock = findSubscriptionForEntitlement as unknown as Mock;
const transactionMock = (prisma as unknown as { $transaction: Mock }).$transaction;

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/api/profile", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("profile route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Restore the default $transaction implementation wiped by clearAllMocks.
    transactionMock.mockImplementation((cb: (tx: any) => unknown) => cb(prisma));
    mockUserEvent.findFirst.mockResolvedValue({
      metadata: JSON.stringify(createAcceptedLegalConsents({
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-25T12:00:00.000Z",
      })),
    });
    mockUserEvent.create.mockResolvedValue({});
    mockUser.update.mockResolvedValue({});
    mockUser.findUnique.mockResolvedValue({
      id: "user-1",
      email: "taylor@example.com",
      firstName: "Taylor",
      lastName: "Mover",
      profile: null,
    });
    mockUserEvent.findMany.mockResolvedValue([]);
    mockAddress.count.mockResolvedValue(0);
    mockService.count.mockResolvedValue(0);
    mockMovingPlan.count.mockResolvedValue(0);
    mockProfile.upsert.mockResolvedValue({ id: "profile-1", userId: "user-1" });
    mockDataConsent.findFirst.mockResolvedValue(null);
    findSubscriptionForEntitlementMock.mockResolvedValue(null);
    requireDbUserIdMock.mockResolvedValue("user-1");
  });

  it("returns a stable 401 for unauthenticated profile reads", async () => {
    requireDbUserIdMock.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns a stable 401 for unauthenticated profile writes", async () => {
    requireDbUserIdMock.mockRejectedValueOnce(new Error("UNAUTHORIZED"));

    const response = await POST(makeRequest({}));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("strips raw billing purchase tokens from profile reads", async () => {
    findSubscriptionForEntitlementMock.mockResolvedValue({
      id: "sub-1",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "PLAY_STORE",
      purchaseToken: "raw-play-token",
      purchaseTokenEncrypted: "enc_v1:encrypted-play-token",
      purchaseTokenHash: "hashed-play-token",
    });

    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.subscription).toMatchObject({
      id: "sub-1",
      plan: "INDIVIDUAL",
      status: "ACTIVE",
      provider: "PLAY_STORE",
    });
    expect(body.subscription).not.toHaveProperty("purchaseToken");
    expect(body.subscription).not.toHaveProperty("purchaseTokenEncrypted");
    expect(body.subscription).not.toHaveProperty("purchaseTokenHash");
  });

  it("accepts the real onboarding step-0 payload for a new user", async () => {
    const payload = buildOnboardingProfilePayload(
      {
        firstName: "Taylor",
        lastName: "Mover",
        ageRange: "",
        familyStatus: "SINGLE",
        hasChildren: false,
        childrenCount: 0,
        hasPets: true,
        petTypes: ["DOG"],
        carCount: 1,
        hasSenior: false,
        hasDisability: false,
        needsStorage: true,
        hasMotorcycle: false,
        hasBoatRV: false,
      },
    );

    const response = await POST(makeRequest(payload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.profile).toEqual({ id: "profile-1", userId: "user-1" });
    expect(mockProfile.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "user-1" },
        create: expect.objectContaining({
          userId: "user-1",
          familyStatus: "SINGLE",
          needsStorage: true,
        }),
      }),
    );
    const upsertArg = mockProfile.upsert.mock.calls[0][0];
    expect(upsertArg.create).toEqual(expect.objectContaining({
      moveType: "PERSONAL",
      isBusinessOwner: false,
      isImmigrant: false,
      immigrationStatus: null,
      isMilitary: false,
    }));
    expect(upsertArg.create).not.toHaveProperty("businessType");
    expect(upsertArg.create).not.toHaveProperty("sensitiveOptIn");
  });

  it("persists isMilitary to the Profile when sensitive consent is on file", async () => {
    mockDataConsent.findFirst.mockResolvedValue({
      id: "consent_1",
      category: "SENSITIVE",
      granted: true,
    });
    const payload = buildOnboardingProfilePayload({
      firstName: "Taylor",
      lastName: "Mover",
      ageRange: "",
      familyStatus: "SINGLE",
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      petTypes: [],
      carCount: 0,
      hasSenior: false,
      hasDisability: false,
      isMilitary: true,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
    });

    const response = await POST(makeRequest(payload));

    expect(response.status).toBe(200);
    const upsertArg = mockProfile.upsert.mock.calls[0][0];
    expect(upsertArg.create).toMatchObject({ isMilitary: true });
    expect(upsertArg.update).toMatchObject({ isMilitary: true });
  });

  it("requires sensitive consent before saving isMilitary=true", async () => {
    mockDataConsent.findFirst.mockResolvedValue(null);
    const response = await POST(makeRequest({
      firstName: "Taylor",
      lastName: "Mover",
      familyStatus: "SINGLE",
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      petTypes: [],
      carCount: 0,
      hasSenior: false,
      hasDisability: false,
      isMilitary: true,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
      moveType: "PERSONAL",
      isBusinessOwner: false,
      isImmigrant: false,
      immigrationStatus: "",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SENSITIVE_CONSENT_REQUIRED");
    expect(mockProfile.upsert).not.toHaveBeenCalled();
  });

  it("rejects profile save until the onboarding legal gate is accepted", async () => {
    mockUserEvent.findFirst.mockResolvedValue(null);
    const payload = buildOnboardingProfilePayload({
      firstName: "Taylor",
      lastName: "Mover",
      ageRange: "",
      familyStatus: "SINGLE",
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      petTypes: [],
      carCount: 0,
      hasSenior: false,
      hasDisability: false,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
    });

    const response = await POST(makeRequest(payload));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toContain("Terms of Use");
    expect(body.code).toBe("LEGAL_ACCEPTANCE_REQUIRED");
    expect(mockProfile.upsert).not.toHaveBeenCalled();
  });

  it("records valid mobile fallback legal consent before saving the profile", async () => {
    mockUserEvent.findFirst.mockResolvedValue(null);
    const accepted = createAcceptedLegalConsents({
      termsVersion: "2026-03-13",
      disclaimerVersion: "2026-03-13",
      acceptedAt: "2026-04-27T12:00:00.000Z",
    });
    const payload = {
      ...buildOnboardingProfilePayload({
        firstName: "Taylor",
        lastName: "Mover",
        ageRange: "",
        familyStatus: "SINGLE",
        hasChildren: false,
        childrenCount: 0,
        hasPets: false,
        petTypes: [],
        carCount: 0,
        hasSenior: false,
        hasDisability: false,
        needsStorage: false,
        hasMotorcycle: false,
        hasBoatRV: false,
      }),
      legalConsents: accepted,
    };

    const response = await POST(makeRequest(payload));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.legalConsents).toEqual(accepted);
    expect(mockUserEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        event: "LEGAL_CONSENT_ACCEPTED",
        page: "/onboarding",
      }),
    });
    expect(mockProfile.upsert).toHaveBeenCalled();
  });

  it("does not create legal acknowledgement rows while saving profile", async () => {
    const payload = buildOnboardingProfilePayload({
      firstName: "Taylor",
      lastName: "Mover",
      ageRange: "",
      familyStatus: "SINGLE",
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      petTypes: [],
      carCount: 0,
      hasSenior: false,
      hasDisability: false,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
    });

    const response = await POST(makeRequest(payload));

    expect(response.status).toBe(200);
    expect(mockUserEvent.create).not.toHaveBeenCalled();
  });

  it("still rejects unknown root fields when callers bypass the sanitizer", async () => {
    const response = await POST(makeRequest({
      firstName: "Taylor",
      lastName: "Mover",
      familyStatus: "SINGLE",
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      petTypes: [],
      carCount: 0,
      hasSenior: false,
      hasDisability: false,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
      moveType: "BUSINESS",
      isBusinessOwner: true,
      unexpectedRootField: true,
      legalConsents: {
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-25T12:00:00.000Z",
        source: "browser",
      },
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Validation failed");
    expect(mockProfile.upsert).not.toHaveBeenCalled();
  });

  // 4.5 atomicity: the user.update + profile.upsert run in one transaction, so a
  // failure on the second write (upsert) rolls back the first (the name update).
  it("rolls back the user-name update when the profile upsert fails mid-transaction", async () => {
    let userNamePersisted = false;
    mockUser.update.mockImplementation(async () => {
      userNamePersisted = true;
      return {};
    });
    mockProfile.upsert.mockImplementation(async () => {
      throw new Error("UPSERT_FAILED");
    });
    // Emulate atomicity: if the callback rejects, the prior write is not durable.
    transactionMock.mockImplementation(async (cb: (tx: any) => unknown) => {
      try {
        return await cb(prisma);
      } catch (err) {
        userNamePersisted = false; // rolled back with the failed upsert
        throw err;
      }
    });

    const payload = buildOnboardingProfilePayload({
      firstName: "Taylor",
      lastName: "Mover",
      ageRange: "",
      familyStatus: "SINGLE",
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      petTypes: [],
      carCount: 0,
      hasSenior: false,
      hasDisability: false,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
    });

    const response = await POST(makeRequest(payload));
    const body = await response.json();

    // Original step-specific 500 message is preserved.
    expect(response.status).toBe(500);
    expect(body.error).toBe("Failed to save profile");
    // The user.update was attempted mid-sequence, then rolled back with the
    // failed profile upsert — no partial write survives.
    expect(mockUser.update).toHaveBeenCalled();
    expect(mockProfile.upsert).toHaveBeenCalled();
    expect(userNamePersisted).toBe(false);
  });

  it("requires sensitive consent before saving sensitive profile fields", async () => {
    const response = await POST(makeRequest({
      firstName: "Taylor",
      lastName: "Mover",
      familyStatus: "SINGLE",
      hasChildren: false,
      childrenCount: 0,
      hasPets: false,
      petTypes: [],
      carCount: 0,
      hasSenior: false,
      hasDisability: true,
      needsStorage: false,
      hasMotorcycle: false,
      hasBoatRV: false,
      moveType: "PERSONAL",
      isBusinessOwner: false,
      isImmigrant: false,
      immigrationStatus: "",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.code).toBe("SENSITIVE_CONSENT_REQUIRED");
    expect(mockProfile.upsert).not.toHaveBeenCalled();
  });
});
