// Provider/ZIP matching helpers.
//
// Pure utilities (ZIP↔state lookup, JSON parsing) live in @locateflow/shared
// so mobile can reuse them. This file re-exports them for callers that still
// import from "@/lib/provider-matching", and adds the in-memory tiered matcher
// used by the legacy JSON-string path.
//
// New code should prefer the DB-indexed path: query ServiceProviderCoverage
// rows directly via Prisma (see apps/web/src/app/api/providers/route.ts).

export {
  safeJsonArray,
  normalizeZip,
  normalizeZipRule,
  zipToState,
  resolveEffectiveState,
  expandCoverageRows,
  type ProviderScope,
  type CoverageRow,
} from "@locateflow/shared";

import { getProviderCoverageMetadata, type ProviderCoveragePolygon } from "@locateflow/db";
import { safeJsonArray, normalizeZip, normalizeZipRule, resolveEffectiveState } from "@locateflow/shared";

export interface ProviderCoverageLike {
  scope: string;
  states: string[] | string;
  zipCodes?: string[] | string | null;
  coverageModel?: "state" | "zip_prefix" | "polygon" | "live_address";
}

export type ZipMatchLevel = "exact" | "prefix" | "polygon" | "state" | "live_address";

export interface ProviderMatchResult<T> {
  effectiveState?: string;
  providers: T[];
  zipMatchLevel: ZipMatchLevel;
}

interface ProviderMatchOptions {
  state?: string | null;
  zip?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

type ResolvedZipMatchLevel = ZipMatchLevel | "none";

function isFiniteCoordinate(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function pointInPolygon(latitude: number, longitude: number, polygon: ProviderCoveragePolygon): boolean {
  const { points } = polygon;
  if (points.length < 3) return false;

  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i]!.longitude;
    const yi = points[i]!.latitude;
    const xj = points[j]!.longitude;
    const yj = points[j]!.latitude;
    const spansLatitude = yi > latitude !== yj > latitude;

    if (!spansLatitude) continue;

    const intersectionLongitude = ((xj - xi) * (latitude - yi)) / (yj - yi) + xi;
    if (longitude < intersectionLongitude) {
      inside = !inside;
    }
  }

  return inside;
}

function resolvePolygonCoverageMatch(
  slug: string | null | undefined,
  latitude: number | null | undefined,
  longitude: number | null | undefined
): boolean | null {
  if (!slug || !isFiniteCoordinate(latitude) || !isFiniteCoordinate(longitude)) {
    return null;
  }

  const metadata = getProviderCoverageMetadata(slug);
  const polygons = metadata?.polygons;
  if (!polygons || polygons.length === 0) {
    return null;
  }

  return polygons.some((polygon) => pointInPolygon(latitude, longitude, polygon));
}

function isStateEligible(provider: ProviderCoverageLike, effectiveState?: string): boolean {
  if (!effectiveState) return true;
  if (provider.scope === "FEDERAL") return true;
  const states = safeJsonArray(provider.states);
  return states.includes(effectiveState);
}

function getExactZipMatches<T extends ProviderCoverageLike>(providers: T[], normalizedZip: string): T[] {
  return providers.filter((provider) => {
    const zipRules = safeJsonArray(provider.zipCodes);
    return zipRules.some((rule) => normalizeZipRule(rule) === normalizedZip);
  });
}

function getPrefixZipMatches<T extends ProviderCoverageLike>(providers: T[], normalizedZip: string): T[] {
  return providers.filter((provider) => {
    const zipRules = safeJsonArray(provider.zipCodes)
      .map((rule) => normalizeZipRule(rule))
      .filter((rule) => rule.length >= 3 && rule.length < normalizedZip.length);

    return zipRules.some((rule) => normalizedZip.startsWith(rule));
  });
}

function getUnrestrictedProviders<T extends ProviderCoverageLike>(providers: T[]): T[] {
  return providers.filter((provider) => safeJsonArray(provider.zipCodes).length === 0);
}

export function matchProvidersByCoverage<T extends ProviderCoverageLike>(
  providers: T[],
  options: ProviderMatchOptions
): ProviderMatchResult<T> {
  const effectiveState = resolveEffectiveState(options.state, options.zip);
  const normalizedZip = normalizeZip(options.zip);
  const stateEligibleProviders = providers.filter((provider) => isStateEligible(provider, effectiveState));

  if (!normalizedZip) {
    return {
      effectiveState,
      providers: stateEligibleProviders,
      zipMatchLevel: "state",
    };
  }

  const exactMatches = getExactZipMatches(stateEligibleProviders, normalizedZip);
  if (exactMatches.length > 0) {
    return {
      effectiveState,
      providers: exactMatches,
      zipMatchLevel: "exact",
    };
  }

  const prefixMatches = getPrefixZipMatches(stateEligibleProviders, normalizedZip);
  if (prefixMatches.length > 0) {
    return {
      effectiveState,
      providers: prefixMatches,
      zipMatchLevel: "prefix",
    };
  }

  const polygonMatches = getUnrestrictedProviders(stateEligibleProviders).filter(
    (provider) => provider.coverageModel === "polygon"
  );
  if (polygonMatches.length > 0) {
    return {
      effectiveState,
      providers: [...polygonMatches, ...getUnrestrictedProviders(stateEligibleProviders).filter((provider) => provider.coverageModel !== "polygon")],
      zipMatchLevel: "polygon",
    };
  }

  const stateMatches = getUnrestrictedProviders(stateEligibleProviders).filter(
    (provider) => provider.coverageModel !== "live_address"
  );
  if (stateMatches.length > 0) {
    return {
      effectiveState,
      providers: [...stateMatches, ...getUnrestrictedProviders(stateEligibleProviders).filter((provider) => provider.coverageModel === "live_address")],
      zipMatchLevel: "state",
    };
  }

  return {
    effectiveState,
    providers: getUnrestrictedProviders(stateEligibleProviders),
    zipMatchLevel: "live_address",
  };
}

// -----------------------------------------------------------------------------
// DB-indexed path: tier providers once Prisma has pre-filtered them via
// ServiceProviderCoverage. Caller pulls the candidate set + coverage rows with
// a single indexed query, then this helper picks the best tier (exact → prefix
// → state) among those candidates.

export interface ProviderWithCoverages {
  id: string;
  slug?: string | null;
  scope: string;
  coverageModel?: "state" | "zip_prefix" | "polygon" | "live_address";
  coverages: Array<{
    state: string | null;
    zipPrefix: string | null;
    zipExact: string | null;
  }>;
}

function resolveProviderMatchLevelFromDb<T extends ProviderWithCoverages>(
  provider: T,
  options: ProviderMatchOptions
): ResolvedZipMatchLevel {
  const effectiveState = resolveEffectiveState(options.state, options.zip);
  const normalizedZip = normalizeZip(options.zip);

  let hasPrefix = false;
  let hasStateOnly = provider.scope === "FEDERAL" && provider.coverages.length === 0;

  for (const cov of provider.coverages) {
    if (normalizedZip && cov.zipExact && cov.zipExact === normalizedZip) {
      return "exact";
    }
    if (
      normalizedZip &&
      cov.zipPrefix &&
      cov.zipPrefix.length < normalizedZip.length &&
      normalizedZip.startsWith(cov.zipPrefix)
    ) {
      hasPrefix = true;
    }
    if (!cov.zipExact && !cov.zipPrefix && cov.state && cov.state === effectiveState) {
      hasStateOnly = true;
    }
  }

  if (hasPrefix) return "prefix";
  if (provider.coverageModel === "polygon") {
    const polygonMatch = resolvePolygonCoverageMatch(provider.slug, options.latitude, options.longitude);
    if (polygonMatch === true) return "polygon";
    if (polygonMatch === false) return "none";
    return "polygon";
  }
  if (provider.coverageModel === "live_address") return "live_address";
  if (hasStateOnly) return "state";
  return "state";
}

export function getProviderMatchLevelFromDb<T extends ProviderWithCoverages>(
  provider: T,
  options: ProviderMatchOptions
): ZipMatchLevel {
  const normalizedZip = normalizeZip(options.zip);
  const hasCoordinates = isFiniteCoordinate(options.latitude) && isFiniteCoordinate(options.longitude);

  if (!normalizedZip && !hasCoordinates) {
    return "state";
  }

  const matchLevel = resolveProviderMatchLevelFromDb(provider, options);
  return matchLevel === "none" ? "state" : matchLevel;
}

export function tierProvidersFromDb<T extends ProviderWithCoverages>(
  providers: T[],
  options: ProviderMatchOptions
): ProviderMatchResult<T> {
  const effectiveState = resolveEffectiveState(options.state, options.zip);
  const normalizedZip = normalizeZip(options.zip);
  const hasCoordinates = isFiniteCoordinate(options.latitude) && isFiniteCoordinate(options.longitude);

  if (!normalizedZip && !hasCoordinates) {
    return { effectiveState, providers, zipMatchLevel: "state" };
  }

  const exact: T[] = [];
  const prefix: T[] = [];
  const polygon: T[] = [];
  const stateOnly: T[] = [];
  const liveAddress: T[] = [];

  for (const provider of providers) {
    const matchLevel = resolveProviderMatchLevelFromDb(provider, options);

    if (matchLevel === "none") {
      continue;
    }

    if (matchLevel === "exact") {
      exact.push(provider);
      continue;
    }

    if (matchLevel === "prefix") {
      prefix.push(provider);
      continue;
    }

    if (matchLevel === "polygon") {
      polygon.push(provider);
      continue;
    }

    if (matchLevel === "live_address") {
      liveAddress.push(provider);
      continue;
    }

    stateOnly.push(provider);
  }

  const matchedProviders = [...exact, ...prefix, ...polygon, ...stateOnly, ...liveAddress];
  if (exact.length > 0) {
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "exact" };
  }
  if (prefix.length > 0) {
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "prefix" };
  }
  if (polygon.length > 0) {
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "polygon" };
  }
  if (stateOnly.length > 0) {
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "state" };
  }
  if (liveAddress.length > 0) {
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "live_address" };
  }
  return { effectiveState, providers: matchedProviders, zipMatchLevel: "state" };
}
