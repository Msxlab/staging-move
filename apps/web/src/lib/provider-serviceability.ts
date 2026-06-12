import type { CoverageConfidence } from "@locateflow/shared";
import { lookupFccIsps, isIspServiceable, type FccLookupResult } from "@/lib/fcc-isp";
import {
  lookupElectricUtilities,
  isElectricUtilityServiceable,
  type ElectricLookupResult,
} from "@/lib/electric-utility";
import type { ProviderPresentationMatchLevel } from "@/lib/provider-matching";

export type ServiceabilityProvider = {
  name: string;
  category: string;
  fccServiceable?: boolean;
  utilityServiceable?: boolean;
};

export type ServiceabilityMeta = {
  fcc: {
    status: FccLookupResult["status"] | "skipped" | "not_configured" | "gated";
    confirmedCount: number;
    blockGeoid: string | null;
  };
  electric: {
    status: ElectricLookupResult["status"] | "skipped" | "not_configured" | "gated";
    confirmedCount: number;
    utilityCount: number;
  };
};

export function providerServiceabilityGatedMeta(providers: ServiceabilityProvider[]): ServiceabilityMeta {
  const hasInternetCandidates = providers.some((provider) => provider.category === "UTILITY_INTERNET");
  const hasElectricCandidates = providers.some((provider) => provider.category === "UTILITY_ELECTRIC");
  return {
    fcc: {
      status: hasInternetCandidates ? "gated" : "skipped",
      confirmedCount: 0,
      blockGeoid: null,
    },
    electric: {
      status: hasElectricCandidates ? "gated" : "skipped",
      confirmedCount: 0,
      utilityCount: 0,
    },
  };
}

export function hasConfirmedProviderServiceability(provider: ServiceabilityProvider): boolean {
  return provider.fccServiceable === true || provider.utilityServiceable === true;
}

export function applyProviderServiceabilityMatchLevel(
  provider: ServiceabilityProvider,
  matchLevel: ProviderPresentationMatchLevel,
): ProviderPresentationMatchLevel {
  return hasConfirmedProviderServiceability(provider) ? "available_at_address" : matchLevel;
}

export function applyProviderServiceabilityConfidence(
  provider: ServiceabilityProvider,
  confidence: CoverageConfidence,
): CoverageConfidence {
  return hasConfirmedProviderServiceability(provider) ? "AVAILABLE_AT_ADDRESS" : confidence;
}

export async function enrichProviderServiceability<T extends ServiceabilityProvider>(
  providers: T[],
  context: { latitude?: number | null; longitude?: number | null },
): Promise<ServiceabilityMeta> {
  let fccLookup: FccLookupResult | null = null;
  let electricLookup: ElectricLookupResult | null = null;

  const hasInternetCandidates = providers.some((provider) => provider.category === "UTILITY_INTERNET");
  const hasElectricCandidates = providers.some((provider) => provider.category === "UTILITY_ELECTRIC");

  if (hasInternetCandidates) {
    try {
      fccLookup = await lookupFccIsps({
        latitude: context.latitude,
        longitude: context.longitude,
      });
      if (fccLookup.status === "ok") {
        for (const provider of providers) {
          if (provider.category !== "UTILITY_INTERNET") continue;
          if (isIspServiceable(fccLookup, provider.name)) {
            provider.fccServiceable = true;
          }
        }
      }
    } catch {
      fccLookup = null;
    }
  }

  if (hasElectricCandidates) {
    try {
      electricLookup = await lookupElectricUtilities({
        latitude: context.latitude,
        longitude: context.longitude,
      });
      if (electricLookup.status === "ok") {
        for (const provider of providers) {
          if (provider.category !== "UTILITY_ELECTRIC") continue;
          if (isElectricUtilityServiceable(electricLookup, provider.name)) {
            provider.utilityServiceable = true;
          }
        }
      }
    } catch {
      electricLookup = null;
    }
  }

  return {
    fcc: {
      status: fccLookup?.status || (hasInternetCandidates ? "not_configured" : "skipped"),
      confirmedCount: providers.filter((provider) => provider.fccServiceable === true).length,
      blockGeoid: fccLookup?.blockGeoid || null,
    },
    electric: {
      status: electricLookup?.status || (hasElectricCandidates ? "not_configured" : "skipped"),
      confirmedCount: providers.filter((provider) => provider.utilityServiceable === true).length,
      utilityCount: electricLookup?.status === "ok" ? electricLookup.utilities.length : 0,
    },
  };
}
