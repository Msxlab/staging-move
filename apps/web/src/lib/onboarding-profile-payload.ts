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
  isMilitary?: boolean;
  needsStorage: boolean;
  hasMotorcycle: boolean;
  hasBoatRV: boolean;
  moveType?: string;
  isBusinessOwner?: boolean;
  isImmigrant?: boolean;
  immigrationStatus?: string;
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
    isMilitary: profile.isMilitary ?? false,
    needsStorage: profile.needsStorage,
    hasMotorcycle: profile.hasMotorcycle,
    hasBoatRV: profile.hasBoatRV,
    moveType: profile.moveType || "PERSONAL",
    isBusinessOwner: profile.isBusinessOwner || false,
    isImmigrant: profile.isImmigrant || false,
    immigrationStatus: profile.immigrationStatus || "",
  };
}
