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
});
