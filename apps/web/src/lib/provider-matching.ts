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

import { safeJsonArray, normalizeZip, normalizeZipRule, resolveEffectiveState } from "@locateflow/shared";

export interface ProviderCoverageLike {
  scope: string;
  states: string[] | string;
  zipCodes?: string[] | string | null;
}

export type ZipMatchLevel = "exact" | "prefix" | "state";

export interface ProviderMatchResult<T> {
  effectiveState?: string;
  providers: T[];
  zipMatchLevel: ZipMatchLevel;
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
  options: { state?: string | null; zip?: string | null }
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

  return {
    effectiveState,
    providers: getUnrestrictedProviders(stateEligibleProviders),
    zipMatchLevel: "state",
  };
}

// -----------------------------------------------------------------------------
// DB-indexed path: tier providers once Prisma has pre-filtered them via
// ServiceProviderCoverage. Caller pulls the candidate set + coverage rows with
// a single indexed query, then this helper picks the best tier (exact → prefix
// → state) among those candidates.

export interface ProviderWithCoverages {
  id: string;
  scope: string;
  coverages: Array<{
    state: string | null;
    zipPrefix: string | null;
    zipExact: string | null;
  }>;
}

export function tierProvidersFromDb<T extends ProviderWithCoverages>(
  providers: T[],
  options: { state?: string | null; zip?: string | null }
): ProviderMatchResult<T> {
  const effectiveState = resolveEffectiveState(options.state, options.zip);
  const normalizedZip = normalizeZip(options.zip);

  if (!normalizedZip) {
    return { effectiveState, providers, zipMatchLevel: "state" };
  }

  const exact: T[] = [];
  const prefix: T[] = [];
  const stateOnly: T[] = [];

  for (const provider of providers) {
    let hasExact = false;
    let hasPrefix = false;
    let hasStateOnly = provider.scope === "FEDERAL" && provider.coverages.length === 0;

    for (const cov of provider.coverages) {
      if (cov.zipExact && cov.zipExact === normalizedZip) {
        hasExact = true;
        break;
      }
      if (cov.zipPrefix && cov.zipPrefix.length < normalizedZip.length && normalizedZip.startsWith(cov.zipPrefix)) {
        hasPrefix = true;
      }
      if (!cov.zipExact && !cov.zipPrefix && cov.state && cov.state === effectiveState) {
        hasStateOnly = true;
      }
    }

    if (hasExact) exact.push(provider);
    else if (hasPrefix) prefix.push(provider);
    else if (hasStateOnly) stateOnly.push(provider);
  }

  if (exact.length > 0) return { effectiveState, providers: exact, zipMatchLevel: "exact" };
  if (prefix.length > 0) return { effectiveState, providers: prefix, zipMatchLevel: "prefix" };
  return { effectiveState, providers: stateOnly, zipMatchLevel: "state" };
}
