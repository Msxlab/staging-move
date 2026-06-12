// Provider/ZIP matching helpers.
//
// Pure utilities (ZIP↔state lookup, JSON parsing) live in @locateflow/shared
// so mobile can reuse them. This file re-exports them for callers that still
// import from "@/lib/provider-matching", and adds the DB-indexed tiered matcher
// used by the providers API: query ServiceProviderCoverage rows directly via
// Prisma (see apps/web/src/app/api/providers/route.ts), then tier the
// candidates (exact → prefix → polygon → state → live_address).

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

import { getProviderCoverageMetadata, type ProviderCoverageModel, type ProviderCoveragePolygon } from "@locateflow/db";
import {
  normalizeZip,
  resolveEffectiveState,
  mapCoverageMatchToConfidence,
  type CoverageConfidence,
} from "@locateflow/shared";

export type ZipMatchLevel = "exact" | "prefix" | "polygon" | "state" | "live_address";
export type ProviderPresentationMatchLevel = ZipMatchLevel | "available_at_address" | "unknown";

export interface ProviderMatchResult<T> {
  effectiveState?: string;
  providers: T[];
  zipMatchLevel: ZipMatchLevel;
  coverageConfidence: CoverageConfidence;
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

// -----------------------------------------------------------------------------
// DB-indexed path: tier providers once Prisma has pre-filtered them via
// ServiceProviderCoverage. Caller pulls the candidate set + coverage rows with
// a single indexed query, then this helper picks the best tier (exact → prefix
// → state) among those candidates.

export interface ProviderWithCoverages {
  id: string;
  slug?: string | null;
  scope: string;
  coverageModel?: ProviderCoverageModel | null;
  coverages: Array<{
    state: string | null;
    zipPrefix: string | null;
    zipExact: string | null;
  }>;
}

function getEffectiveProviderCoverageModel<T extends ProviderWithCoverages>(
  provider: T,
): ProviderCoverageModel | undefined {
  return provider.coverageModel || getProviderCoverageMetadata(provider.slug)?.coverageModel;
}

function resolveProviderMatchLevelFromDb<T extends ProviderWithCoverages>(
  provider: T,
  options: ProviderMatchOptions
): ResolvedZipMatchLevel {
  const effectiveState = resolveEffectiveState(options.state, options.zip);
  const normalizedZip = normalizeZip(options.zip);
  const coverageModel = getEffectiveProviderCoverageModel(provider);

  let hasPrefix = false;
  let hasZipScopedCoverage = false;
  let hasStateCoverage = provider.scope === "FEDERAL" && provider.coverages.length === 0;
  let hasAnyStateCoverage = false;
  let hasMatchingStateCoverage = provider.scope === "FEDERAL" && provider.coverages.length === 0;

  for (const cov of provider.coverages) {
    const matchesEffectiveState = !effectiveState || !cov.state || cov.state === effectiveState;
    if (cov.state) {
      hasAnyStateCoverage = true;
      if (matchesEffectiveState) {
        hasMatchingStateCoverage = true;
      }
    }
    if (cov.zipExact || cov.zipPrefix) {
      hasZipScopedCoverage = true;
    }
    if (matchesEffectiveState && normalizedZip && cov.zipExact && cov.zipExact === normalizedZip) {
      return "exact";
    }
    if (
      matchesEffectiveState &&
      normalizedZip &&
      cov.zipPrefix &&
      cov.zipPrefix.length < normalizedZip.length &&
      normalizedZip.startsWith(cov.zipPrefix)
    ) {
      hasPrefix = true;
    }
    if (!cov.zipExact && !cov.zipPrefix && cov.state && matchesEffectiveState) {
      hasStateCoverage = true;
    }
  }

  if (hasPrefix) return "prefix";
  if (effectiveState && provider.scope !== "FEDERAL" && provider.coverages.length === 0) return "none";
  if (effectiveState && provider.scope !== "FEDERAL" && hasAnyStateCoverage && !hasMatchingStateCoverage) return "none";
  if (hasZipScopedCoverage && normalizedZip && !hasStateCoverage) return "none";
  if (hasZipScopedCoverage && !hasMatchingStateCoverage) return "none";
  if (coverageModel === "polygon") {
    const polygonMatch = resolvePolygonCoverageMatch(provider.slug, options.latitude, options.longitude);
    if (polygonMatch === true) return "polygon";
    if (polygonMatch === false) return "none";
    // polygonMatch === null: no coordinates or no polygon metadata, so we
    // genuinely can't confirm coverage. Surface it as an address check rather
    // than optimistically claiming a polygon match the user can't rely on.
    return "live_address";
  }
  if (coverageModel === "live_address") return "live_address";
  return "state";
}

export function getProviderMatchLevelFromDb<T extends ProviderWithCoverages>(
  provider: T,
  options: ProviderMatchOptions
): ZipMatchLevel {
  const effectiveState = resolveEffectiveState(options.state, options.zip);
  const normalizedZip = normalizeZip(options.zip);
  const hasCoordinates = isFiniteCoordinate(options.latitude) && isFiniteCoordinate(options.longitude);

  if (!effectiveState && !normalizedZip && !hasCoordinates) {
    return "state";
  }

  const matchLevel = resolveProviderMatchLevelFromDb(provider, options);
  return matchLevel === "none" ? "state" : matchLevel;
}

export function getProviderPresentationMatchLevelFromDb<T extends ProviderWithCoverages>(
  provider: T,
  options: ProviderMatchOptions
): ProviderPresentationMatchLevel {
  const effectiveState = resolveEffectiveState(options.state, options.zip);
  const normalizedZip = normalizeZip(options.zip);
  const hasCoordinates = isFiniteCoordinate(options.latitude) && isFiniteCoordinate(options.longitude);

  if (!effectiveState && !normalizedZip && !hasCoordinates) {
    return "state";
  }

  const matchLevel = resolveProviderMatchLevelFromDb(provider, options);
  return matchLevel === "none" ? "unknown" : matchLevel;
}

export function getProviderCoverageConfidenceFromDb<T extends ProviderWithCoverages>(
  provider: T,
  options: ProviderMatchOptions
): CoverageConfidence {
  const matchLevel = resolveProviderMatchLevelFromDb(provider, options);
  const coverageModel = getEffectiveProviderCoverageModel(provider);
  if (matchLevel === "none") return "UNKNOWN";
  return mapCoverageMatchToConfidence(matchLevel, {
    scope: provider.scope,
    coverageModel,
    requiresAddressCheck: coverageModel === "live_address",
    requiresPolygonCheck: coverageModel === "polygon",
  });
}

export function tierProvidersFromDb<T extends ProviderWithCoverages>(
  providers: T[],
  options: ProviderMatchOptions
): ProviderMatchResult<T> {
  const effectiveState = resolveEffectiveState(options.state, options.zip);
  const normalizedZip = normalizeZip(options.zip);
  const hasCoordinates = isFiniteCoordinate(options.latitude) && isFiniteCoordinate(options.longitude);

  if (!effectiveState && !normalizedZip && !hasCoordinates) {
    return { effectiveState, providers, zipMatchLevel: "state", coverageConfidence: "STATE_LEVEL" };
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
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "exact", coverageConfidence: "EXACT_ZIP" };
  }
  if (prefix.length > 0) {
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "prefix", coverageConfidence: "ZIP_PREFIX" };
  }
  if (polygon.length > 0) {
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "polygon", coverageConfidence: "MAPPED_SERVICE_AREA" };
  }
  if (stateOnly.length > 0) {
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "state", coverageConfidence: "STATE_LEVEL" };
  }
  if (liveAddress.length > 0) {
    return { effectiveState, providers: matchedProviders, zipMatchLevel: "live_address", coverageConfidence: "ADDRESS_CHECK_REQUIRED" };
  }
  return { effectiveState, providers: matchedProviders, zipMatchLevel: "state", coverageConfidence: "UNKNOWN" };
}
