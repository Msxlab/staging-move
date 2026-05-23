import { describe, expect, it } from "vitest";

import {
  analyzeMigration,
  providerNameMentionsOtherState,
  type ProviderForMigration,
  type ServiceWithProvider,
} from "../migration-engine";
import type { UserChecklistProfile } from "../relocation-checklist";

const profile: UserChecklistProfile = {
  hasChildren: false,
  childrenCount: 0,
  hasPets: false,
  hasSenior: false,
  carCount: 0,
  hasDisability: false,
  needsStorage: false,
  hasMotorcycle: false,
  hasBoatRV: false,
  isImmigrant: false,
  isBusinessOwner: false,
  moveType: "PERSONAL",
};

describe("analyzeMigration", () => {
  it("does not keep state-scoped providers just because their category is often national", () => {
    const existingServices: ServiceWithProvider[] = [
      {
        id: "svc-bank",
        category: "FINANCIAL_BANK",
        providerName: "Florida Regional Bank",
        providerId: "provider-fl-bank",
        isActive: true,
        provider: {
          id: "provider-fl-bank",
          name: "Florida Regional Bank",
          slug: "florida-regional-bank",
          scope: "STATE",
          states: ["FL"],
          category: "FINANCIAL_BANK",
        },
      },
    ];
    const availableProviders: ProviderForMigration[] = [
      {
        id: "provider-ca-bank",
        name: "California Bank",
        slug: "california-bank",
        category: "FINANCIAL_BANK",
        scope: "STATE",
        states: ["CA"],
        popularityScore: 90,
      },
    ];

    const result = analyzeMigration(existingServices, "FL", "CA", availableProviders, profile);

    expect(result.keeps).toHaveLength(0);
    expect(result.switches).toHaveLength(1);
    expect(result.switches[0]?.currentService?.providerName).toBe("Florida Regional Bank");
    expect(result.switches[0]?.recommendedProvider?.name).toBe("California Bank");
  });

  it("keeps unknown-scope bank services as address-update guidance", () => {
    const result = analyzeMigration(
      [
        {
          id: "svc-bank",
          category: "FINANCIAL_BANK",
          providerName: "Unlinked Bank",
          isActive: true,
          provider: null,
        },
      ],
      "FL",
      "CA",
      [],
      profile,
    );

    expect(result.keeps).toHaveLength(1);
    expect(result.switches).toHaveLength(0);
  });
});

describe("providerNameMentionsOtherState", () => {
  it("detects provider names that embed a different state name", () => {
    expect(providerNameMentionsOtherState("Spectrum Maine", "CA")).toBe(true);
    expect(providerNameMentionsOtherState("California DMV", "CA")).toBe(false);
    expect(providerNameMentionsOtherState("Bank of America", "CA")).toBe(false);
  });
});
