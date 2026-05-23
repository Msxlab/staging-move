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
  carCount: 1,
  hasDisability: false,
  needsStorage: false,
  hasMotorcycle: false,
  hasBoatRV: false,
  isImmigrant: false,
  isBusinessOwner: false,
  moveType: "PERSONAL",
};

describe("analyzeMigration", () => {
  it("switches state-scoped banks when their catalog scope does not cover the destination", () => {
    const services: ServiceWithProvider[] = [
      {
        id: "svc-bank",
        category: "FINANCIAL_BANK",
        providerName: "Florida Community Bank",
        providerId: "fl-bank",
        isActive: true,
        provider: {
          id: "fl-bank",
          name: "Florida Community Bank",
          slug: "fl-bank",
          category: "FINANCIAL_BANK",
          scope: "STATE",
          states: ["FL"],
        },
      },
    ];
    const providers: ProviderForMigration[] = [
      {
        id: "ca-bank",
        name: "California Credit Union",
        slug: "ca-bank",
        category: "FINANCIAL_BANK",
        scope: "STATE",
        states: ["CA"],
        popularityScore: 90,
      },
    ];

    const analysis = analyzeMigration(services, "FL", "CA", providers, profile);

    expect(analysis.keeps).toHaveLength(0);
    expect(analysis.switches).toHaveLength(1);
    expect(analysis.switches[0]?.recommendedProvider?.name).toBe("California Credit Union");
  });

  it("keeps unknown-scope bank services as address-update guidance", () => {
    const analysis = analyzeMigration(
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

    expect(analysis.keeps).toHaveLength(1);
    expect(analysis.switches).toHaveLength(0);
  });
});

describe("providerNameMentionsOtherState", () => {
  it("detects provider names that embed a different state name", () => {
    expect(providerNameMentionsOtherState("Spectrum Maine", "CA")).toBe(true);
    expect(providerNameMentionsOtherState("California DMV", "CA")).toBe(false);
    expect(providerNameMentionsOtherState("Bank of America", "CA")).toBe(false);
  });
});
