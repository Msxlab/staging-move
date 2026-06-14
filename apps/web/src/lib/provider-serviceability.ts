import type { CoverageConfidence } from "@locateflow/shared";
import { lookupFccIsps, isIspServiceable, normalizeIspName, type FccIspResult, type FccLookupResult } from "@/lib/fcc-isp";
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
  fccProviderId?: string | null;
  fccMaxDownloadMbps?: number | null;
  fccMaxUploadMbps?: number | null;
  fccTechnologyCodes?: number[];
  fccTechnologyLabel?: InternetTechnologyLabel | string | null;
  fccQualityBand?: InternetQualityBand | string | null;
  utilityServiceable?: boolean;
};

export type InternetTechnologyLabel =
  | "fiber"
  | "cable"
  | "copper_dsl"
  | "fixed_wireless"
  | "satellite"
  | "mixed"
  | "unknown";

export type InternetQualityBand = "excellent" | "strong" | "standard" | "limited" | "unknown";

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

function findFccProviderMatch(result: FccLookupResult, providerName: string): FccIspResult | null {
  if (result.status !== "ok") return null;
  const normalizedProvider = normalizeIspName(providerName);
  if (!normalizedProvider || normalizedProvider.length < 4) return null;
  return result.providers.find((sourceProvider) => {
    const normalizedSource = normalizeIspName(sourceProvider.brandName);
    if (!normalizedSource || normalizedSource.length < 4) return false;
    return (
      normalizedProvider === normalizedSource ||
      normalizedProvider.startsWith(normalizedSource) ||
      normalizedSource.startsWith(normalizedProvider)
    );
  }) || null;
}

export function classifyInternetTechnology(codes: number[] | null | undefined): InternetTechnologyLabel {
  const unique = new Set((codes || []).filter((code) => Number.isFinite(code)));
  if (unique.size === 0) return "unknown";
  if (unique.has(50)) return unique.size === 1 ? "fiber" : "mixed";
  if (unique.has(40)) return unique.size === 1 ? "cable" : "mixed";
  if ([70, 71, 72].some((code) => unique.has(code))) return unique.size === 1 ? "fixed_wireless" : "mixed";
  if ([60, 61].some((code) => unique.has(code))) return unique.size === 1 ? "satellite" : "mixed";
  if (unique.has(10)) return unique.size === 1 ? "copper_dsl" : "mixed";
  return "unknown";
}

export function classifyInternetQuality(input: {
  maxDownloadMbps?: number | null;
  maxUploadMbps?: number | null;
  technologyCodes?: number[] | null;
}): InternetQualityBand {
  const technology = classifyInternetTechnology(input.technologyCodes);
  const down = typeof input.maxDownloadMbps === "number" ? input.maxDownloadMbps : 0;
  const up = typeof input.maxUploadMbps === "number" ? input.maxUploadMbps : 0;
  if (technology === "fiber" || down >= 1000 || up >= 500) return "excellent";
  if (technology === "cable" || down >= 300 || up >= 50) return "strong";
  if (technology === "fixed_wireless" || down >= 100 || up >= 20) return "standard";
  if (technology === "satellite" || technology === "copper_dsl" || down > 0 || up > 0) return "limited";
  return "unknown";
}

function attachFccServiceability(provider: ServiceabilityProvider, sourceProvider: FccIspResult | null) {
  provider.fccServiceable = true;
  provider.fccProviderId = sourceProvider?.providerId ?? null;
  provider.fccMaxDownloadMbps = sourceProvider?.maxDownloadMbps ?? null;
  provider.fccMaxUploadMbps = sourceProvider?.maxUploadMbps ?? null;
  provider.fccTechnologyCodes = sourceProvider?.technologyCodes ?? [];
  provider.fccTechnologyLabel = classifyInternetTechnology(sourceProvider?.technologyCodes ?? []);
  provider.fccQualityBand = classifyInternetQuality({
    maxDownloadMbps: sourceProvider?.maxDownloadMbps ?? null,
    maxUploadMbps: sourceProvider?.maxUploadMbps ?? null,
    technologyCodes: sourceProvider?.technologyCodes ?? [],
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
            attachFccServiceability(provider, findFccProviderMatch(fccLookup, provider.name));
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
