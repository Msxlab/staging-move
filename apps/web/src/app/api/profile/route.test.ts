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
}));

import { prisma } from "@/lib/db";
import { POST } from "./route";

const mockUser = prisma.user as unknown as { update: Mock };
const mockUserEvent = prisma.userEvent as unknown as { findFirst: Mock; create: Mock };
const mockProfile = prisma.profile as unknown as { upsert: Mock };

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
    mockUserEvent.findFirst.mockResolvedValue(null);
    mockUserEvent.create.mockResolvedValue({});
    mockUser.update.mockResolvedValue({});
    mockProfile.upsert.mockResolvedValue({ id: "profile-1", userId: "user-1" });
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
      createAcceptedLegalConsents(),
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
    expect(upsertArg.create).not.toHaveProperty("moveType");
    expect(upsertArg.create).not.toHaveProperty("isImmigrant");
    expect(upsertArg.create).not.toHaveProperty("businessType");
    expect(upsertArg.create).not.toHaveProperty("sensitiveOptIn");
  });

  it("persists legal acknowledgement fields accepted by the current schema", async () => {
    const payload = buildOnboardingProfilePayload(
      {
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
      },
      createAcceptedLegalConsents({
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-25T12:00:00.000Z",
      }),
    );

    const response = await POST(makeRequest(payload));

    expect(response.status).toBe(200);
    expect(mockUserEvent.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: "user-1",
        event: "LEGAL_CONSENT_ACCEPTED",
        page: "/api/profile",
        metadata: JSON.stringify({
          termsAccepted: true,
          disclaimerAccepted: true,
          termsVersion: "2026-03-13",
          disclaimerVersion: "2026-03-13",
          acceptedAt: "2026-04-25T12:00:00.000Z",
        }),
      }),
    });
  });

  it("does not duplicate legal acknowledgement rows for the same current versions", async () => {
    mockUserEvent.findFirst.mockResolvedValue({
      metadata: JSON.stringify({
        termsAccepted: true,
        disclaimerAccepted: true,
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-25T12:00:00.000Z",
      }),
    });
    const payload = buildOnboardingProfilePayload(
      {
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
      },
      createAcceptedLegalConsents({
        termsVersion: "2026-03-13",
        disclaimerVersion: "2026-03-13",
        acceptedAt: "2026-04-26T12:00:00.000Z",
      }),
    );

    const response = await POST(makeRequest(payload));

    expect(response.status).toBe(200);
    expect(mockUserEvent.create).not.toHaveBeenCalled();
  });

  it("still rejects unknown root and legal fields when callers bypass the sanitizer", async () => {
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
});
