import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { NextRequest } from "next/server";
import { createAcceptedLegalConsents } from "@/lib/legal";
import { buildOnboardingProfilePayload } from "@/lib/onboarding-profile-payload";

vi.mock("@/lib/db", () => ({
  prisma: {
    user: {
      update: vi.fn(),
      findUnique: vi.fn(),
    },
    userEvent: {
      findFirst: vi.fn(),
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
    },
  },
}));

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
import { GET, POST } from "./route";

const mockUser = prisma.user as unknown as { update: Mock };
const mockUserEvent = prisma.userEvent as unknown as { findFirst: Mock; create: Mock };
const mockProfile = prisma.profile as unknown as { upsert: Mock };
const mockDataConsent = prisma.dataConsent as unknown as { findFirst: Mock };
const requireDbUserIdMock = requireDbUserId as unknown as Mock;

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
    mockUserEvent.findFirst.mockResolvedValue({
      metadata: JSON.stringify(createAcceptedLegalConsents({
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-25T12:00:00.000Z",
      })),
    });
    mockUserEvent.create.mockResolvedValue({});
    mockUser.update.mockResolvedValue({});
    mockProfile.upsert.mockResolvedValue({ id: "profile-1", userId: "user-1" });
    mockDataConsent.findFirst.mockResolvedValue(null);
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
