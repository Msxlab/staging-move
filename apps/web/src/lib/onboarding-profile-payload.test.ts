import { describe, expect, it } from "vitest";
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

  it("does not include legal consent fields in the profile POST payload", () => {
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

    expect(payload).not.toHaveProperty("legalConsents");
    expect(profileSchema.safeParse(payload).success).toBe(true);
  });
});
