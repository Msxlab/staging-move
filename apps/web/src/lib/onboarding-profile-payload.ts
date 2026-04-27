export interface OnboardingProfileState {
  firstName: string;
  lastName: string;
  ageRange?: string;
  familyStatus: string;
  hasChildren: boolean;
  childrenCount: number;
  hasPets: boolean;
  petTypes: string[];
  carCount: number;
  hasSenior: boolean;
  hasDisability: boolean;
  needsStorage: boolean;
  hasMotorcycle: boolean;
  hasBoatRV: boolean;
}

export function buildOnboardingProfilePayload(
  profile: OnboardingProfileState,
) {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    ageRange: profile.ageRange || "",
    familyStatus: profile.familyStatus,
    hasChildren: profile.hasChildren,
    childrenCount: profile.childrenCount,
    hasPets: profile.hasPets,
    petTypes: Array.isArray(profile.petTypes) ? profile.petTypes : [],
    carCount: profile.carCount,
    hasSenior: profile.hasSenior,
    hasDisability: profile.hasDisability,
    needsStorage: profile.needsStorage,
    hasMotorcycle: profile.hasMotorcycle,
    hasBoatRV: profile.hasBoatRV,
  };
}
