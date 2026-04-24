import { describe, expect, it } from "vitest";

import { classifyMoveServiceTransition } from "../move-transition-classifier";

describe("classifyMoveServiceTransition", () => {
  it("does not claim PSE&G can transfer from New Jersey to Texas", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        id: "service-pseg",
        category: "UTILITY_ELECTRIC",
        providerId: "pseg",
        providerName: "PSE&G",
      },
      currentProvider: {
        id: "pseg",
        name: "PSE&G",
        category: "UTILITY_ELECTRIC",
        scope: "STATE",
        states: ["NJ"],
      },
      originAddress: { state: "NJ", zip: "07102" },
      destinationAddress: { state: "TX", zip: "78701" },
      destinationProviderCandidates: [
        {
          id: "txu",
          name: "TXU Energy",
          category: "UTILITY_ELECTRIC",
          scope: "STATE",
          states: ["TX"],
          coverageConfidence: "STATE_LEVEL",
          popularityScore: 80,
        },
        {
          id: "reliant",
          name: "Reliant Energy",
          category: "UTILITY_ELECTRIC",
          scope: "STATE",
          states: ["TX"],
          coverageConfidence: "STATE_LEVEL",
          popularityScore: 70,
        },
      ],
    });

    expect(plan.oldProviderAction).toBe("STOP_SERVICE");
    expect(plan.actionType).toBe("SHOP_PROVIDER");
    expect(plan.taskEffectType).toBe("CREATE_DESTINATION_SERVICE");
    expect(plan.addressContext).toBe("NEW_ADDRESS");
    expect(plan.actionLabel).toBe("Compare providers");
    expect(plan.secondaryActions).toContain("VERIFY_AVAILABILITY");
    expect(plan.userFacingCopy).not.toContain("PSE&G can transfer");
    expect(plan.caveats.join(" ")).toContain("Manual guidance only");
  });

  it("recommends transfer or availability verification for a same-state exact ZIP match", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        category: "UTILITY_ELECTRIC",
        providerId: "pseg",
        providerName: "PSE&G",
      },
      originAddress: { state: "NJ", zip: "07102" },
      destinationAddress: { state: "NJ", zip: "07030" },
      destinationProviderCandidates: [
        {
          id: "pseg",
          name: "PSE&G",
          category: "UTILITY_ELECTRIC",
          coverageConfidence: "EXACT_ZIP",
        },
      ],
    });

    expect(["TRANSFER_SERVICE", "VERIFY_AVAILABILITY"]).toContain(plan.actionType);
    expect(plan.destinationProviderCandidates[0]?.coverageConfidence).toBe("EXACT_ZIP");
    expect([plan.actionType, ...plan.secondaryActions]).toContain(
      "VERIFY_AVAILABILITY",
    );
  });

  it("uses verification for same-state utilities with only state-level coverage", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        category: "UTILITY_WATER",
        providerId: "water",
        providerName: "Metro Water",
      },
      originAddress: { state: "CA", zip: "94103" },
      destinationAddress: { state: "CA", zip: "94122" },
      destinationProviderCandidates: [
        {
          id: "water",
          name: "Metro Water",
          category: "UTILITY_WATER",
          coverageConfidence: "STATE_LEVEL",
        },
      ],
    });

    expect(plan.actionType).toBe("VERIFY_AVAILABILITY");
    expect(plan.confidence).toBe("LOW");
  });

  it("requires address verification for internet providers", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        category: "UTILITY_INTERNET",
        providerName: "Fiber Co",
      },
      destinationAddress: { state: "TX", zip: "78759" },
      destinationProviderCandidates: [
        {
          id: "fiber",
          name: "Fiber Co",
          category: "UTILITY_INTERNET",
          coverageConfidence: "ADDRESS_CHECK_REQUIRED",
          requiresAddressCheck: true,
        },
      ],
    });

    expect(plan.actionType).toBe("VERIFY_AVAILABILITY");
    expect(plan.destinationProviderCandidates[0]?.requiresAddressCheck).toBe(true);
  });

  it("treats bank and credit card moves as address updates", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        category: "FINANCIAL_CREDIT_CARD",
        providerName: "Example Card",
      },
      originAddress: { state: "NJ" },
      destinationAddress: { state: "TX" },
    });

    expect(plan.actionType).toBe("UPDATE_ADDRESS");
    expect(plan.taskEffectType).toBe("MARK_ADDRESS_UPDATED");
    expect(plan.confidence).toBe("HIGH");
  });

  it("treats interstate insurance moves as requote actions", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        category: "FINANCIAL_INSURANCE_AUTO",
        providerName: "Example Insurance",
      },
      originAddress: { state: "NJ" },
      destinationAddress: { state: "TX" },
    });

    expect(plan.actionType).toBe("INSURANCE_REQUOTE");
    expect(plan.secondaryActions).toContain("UPDATE_ADDRESS");
    expect(plan.confidence).toBe("HIGH");
  });

  it("uses find replacement when no destination candidate exists", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        category: "UTILITY_GAS",
        providerName: "Old Gas",
      },
      originAddress: { state: "NJ" },
      destinationAddress: { state: "TX" },
      destinationProviderCandidates: [],
    });

    expect(plan.oldProviderAction).toBe("STOP_SERVICE");
    expect(plan.actionType).toBe("FIND_REPLACEMENT");
  });

  it("keeps national providers from overriding stronger local utility candidates", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        category: "UTILITY_ELECTRIC",
        providerName: "Old Electric",
      },
      originAddress: { state: "NJ" },
      destinationAddress: { state: "TX", zip: "78701" },
      destinationProviderCandidates: [
        {
          id: "national",
          name: "National Electric Brand",
          category: "UTILITY_ELECTRIC",
          scope: "FEDERAL",
          coverageConfidence: "NATIONAL_OR_FEDERAL",
          popularityScore: 999,
        },
        {
          id: "local",
          name: "Local Exact Electric",
          category: "UTILITY_ELECTRIC",
          scope: "STATE",
          coverageConfidence: "EXACT_ZIP",
          popularityScore: 10,
        },
      ],
    });

    expect(plan.actionType).toBe("START_SERVICE");
    expect(plan.destinationProviderCandidates[0]?.name).toBe("Local Exact Electric");
  });

  it("treats user-added dentists as private local provider records", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        category: "HEALTHCARE_DENTIST",
        providerName: "Neighborhood Dental",
        customProviderId: "custom-dentist",
        customProviderType: "DENTAL",
      },
      currentProvider: {
        id: "custom-dentist",
        name: "Neighborhood Dental",
        category: "HEALTHCARE_DENTIST",
        trustStatus: "USER_CUSTOM",
        providerType: "DENTAL",
      },
      originAddress: { state: "NJ", zip: "07102" },
      destinationAddress: { state: "TX", zip: "78701" },
    });

    expect(plan.actionType).toBe("FIND_REPLACEMENT");
    expect(plan.taskEffectType).toBe("CREATE_DESTINATION_SERVICE");
    expect(plan.caveats.join(" ")).toContain("User-added providers are private");
  });

  it("treats local gyms as cancel or close candidates on interstate moves", () => {
    const plan = classifyMoveServiceTransition({
      service: {
        category: "FITNESS_GYM",
        providerName: "Corner Gym",
        customProviderId: "custom-gym",
        customProviderType: "GYM",
      },
      currentProvider: {
        id: "custom-gym",
        name: "Corner Gym",
        category: "FITNESS_GYM",
        trustStatus: "USER_CUSTOM",
        providerType: "GYM",
      },
      originAddress: { state: "NJ" },
      destinationAddress: { state: "TX" },
    });

    expect(plan.actionType).toBe("CANCEL_OR_CLOSE");
    expect(plan.taskEffectType).toBe("CLOSE_OLD_SERVICE");
    expect(plan.addressContext).toBe("OLD_ADDRESS");
  });
});
