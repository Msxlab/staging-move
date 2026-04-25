import { describe, expect, it } from "vitest";
import { createAcceptedLegalConsents } from "@/lib/legal";
import { profileSchema } from "@/lib/validators";
import { buildOnboardingProfilePayload } from "./onboarding-profile-payload";

describe("buildOnboardingProfilePayload", () => {
  it("strips UI-only onboarding fields before profile POST", () => {
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
        moveType: "BUSINESS",
        isImmigrant: true,
        immigrationStatus: "VISA",
        isBusinessOwner: true,
        businessType: "LLC",
        isMilitary: true,
        sensitiveOptIn: true,
      } as any,
      createAcceptedLegalConsents(),
    );

    expect(payload).not.toHaveProperty("moveType");
    expect(payload).not.toHaveProperty("isImmigrant");
    expect(payload).not.toHaveProperty("immigrationStatus");
    expect(payload).not.toHaveProperty("isBusinessOwner");
    expect(payload).not.toHaveProperty("businessType");
    expect(payload).not.toHaveProperty("isMilitary");
    expect(payload).not.toHaveProperty("sensitiveOptIn");
    expect(profileSchema.safeParse(payload).success).toBe(true);
  });

  it("strips browser-only legal metadata before profile POST", () => {
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
      {
        ...createAcceptedLegalConsents({
          termsVersion: "2026-03-13",
          disclaimerVersion: "2026-03-13",
          acceptedAt: "2026-04-25T12:00:00.000Z",
        }),
        source: "browser",
        ipAddress: "203.0.113.1",
        userAgent: "Browser UA",
      } as any,
    );

    expect(payload.legalConsents).toEqual({
      termsAccepted: true,
      disclaimerAccepted: true,
      termsVersion: "2026-03-13",
      disclaimerVersion: "2026-03-13",
      acceptedAt: "2026-04-25T12:00:00.000Z",
    });
    expect(payload.legalConsents).not.toHaveProperty("source");
    expect(payload.legalConsents).not.toHaveProperty("ipAddress");
    expect(payload.legalConsents).not.toHaveProperty("userAgent");
    expect(profileSchema.safeParse(payload).success).toBe(true);
  });
});
