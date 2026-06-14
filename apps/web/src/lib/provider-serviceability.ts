import type { CoverageConfidence } from "@locateflow/shared";
import { lookupFccIsps, isIspServiceable, normalizeIspName, type FccLookupResult } from "@/lib/fcc-isp";
import {
  lookupElectricUtilities,
  isElectricUtilityServiceable,
  normalizeUtilityName,
  utilityNamesMatch,
  type ElectricLookupResult,
} from "@/lib/electric-utility";
import type { ProviderPresentationMatchLevel } from "@/lib/provider-matching";

export type ServiceabilityProvider = {
  name: string;
  category: string;
  fccServiceable?: boolean;
  utilityServiceable?: boolean;
};

export type ServiceabilitySourceGap = {
  source: "FCC_BDC" | "OPENEI_URDB";
  category: "UTILITY_INTERNET" | "UTILITY_ELECTRIC";
  name: string;
  sourceProviderId: string | null;
  evidenceUrl: string;
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
  sourceGaps: ServiceabilitySourceGap[];
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
    sourceGaps: [],
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

function hasCatalogIspMatch(providers: ServiceabilityProvider[], sourceName: string): boolean {
  const normalizedSource = normalizeIspName(sourceName);
  if (!normalizedSource) return false;
  return providers.some((provider) => {
    if (provider.category !== "UTILITY_INTERNET") return false;
    const normalizedProvider = normalizeIspName(provider.name);
    if (!normalizedProvider || normalizedProvider.length < 4 || normalizedSource.length < 4) return false;
    return normalizedProvider === normalizedSource ||
      normalizedProvider.startsWith(normalizedSource) ||
      normalizedSource.startsWith(normalizedProvider);
  });
}

function hasCatalogElectricMatch(providers: ServiceabilityProvider[], sourceName: string): boolean {
  const normalizedSource = normalizeUtilityName(sourceName);
  if (!normalizedSource) return false;
  return providers.some(
    (provider) =>
      provider.category === "UTILITY_ELECTRIC" &&
      (normalizeUtilityName(provider.name) === normalizedSource ||
        utilityNamesMatch(provider.name, sourceName)),
  );
}

export async function enrichProviderServiceability<T extends ServiceabilityProvider>(
  providers: T[],
  context: {
    latitude?: number | null;
    longitude?: number | null;
    forceCategories?: Array<"UTILITY_ELECTRIC" | "UTILITY_INTERNET">;
  },
): Promise<ServiceabilityMeta> {
  let fccLookup: FccLookupResult | null = null;
  let electricLookup: ElectricLookupResult | null = null;
  const sourceGaps: ServiceabilitySourceGap[] = [];

  const forcedCategories = new Set(context.forceCategories || []);
  const hasInternetCandidates =
    providers.some((provider) => provider.category === "UTILITY_INTERNET") ||
    forcedCategories.has("UTILITY_INTERNET");
  const hasElectricCandidates =
    providers.some((provider) => provider.category === "UTILITY_ELECTRIC") ||
    forcedCategories.has("UTILITY_ELECTRIC");

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
        for (const sourceProvider of fccLookup.providers) {
          if (!hasCatalogIspMatch(providers, sourceProvider.brandName)) {
            sourceGaps.push({
              source: "FCC_BDC",
              category: "UTILITY_INTERNET",
              name: sourceProvider.brandName,
              sourceProviderId: sourceProvider.providerId,
              evidenceUrl: fccLookup.source.url,
            });
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
        for (const utility of electricLookup.utilities) {
          if (!hasCatalogElectricMatch(providers, utility.name)) {
            sourceGaps.push({
              source: "OPENEI_URDB",
              category: "UTILITY_ELECTRIC",
              name: utility.name,
              sourceProviderId: utility.eiaId,
              evidenceUrl: electricLookup.source.url,
            });
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
    sourceGaps,
  };
}
