/**
 * Audits provider seed coverage for state gaps across critical utilities.
 *
 * For each state, verifies at least one provider exists for:
 *   UTILITY_ELECTRIC, UTILITY_WATER, UTILITY_GAS, UTILITY_INTERNET
 *
 * FEDERAL-scope providers count as covering every state.
 * STATE-scope providers count only for states in their `states` array.
 *
 * Exit 1 on any gap.
 */
import { FEDERAL_NEW, STATE_PROVIDERS } from "../packages/db/prisma/seed-data/provider-seed";
import { sanitizeProviderSeedRecords } from "../packages/shared/src/provider-integrity";

const US_STATES = [
  "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "DC", "FL", "GA", "HI",
  "ID", "IL", "IN", "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN",
  "MS", "MO", "MT", "NE", "NV", "NH", "NJ", "NM", "NY", "NC", "ND", "OH",
  "OK", "OR", "PA", "RI", "SC", "SD", "TN", "TX", "UT", "VT", "VA", "WA",
  "WV", "WI", "WY",
];

const CRITICAL_CATEGORIES = [
  "UTILITY_ELECTRIC",
  "UTILITY_WATER",
  "UTILITY_GAS",
  "UTILITY_INTERNET",
] as const;

type Provider = { category: string; scope?: string; states?: string[] };

function collectCoverage(providers: Provider[]) {
  const coverage: Record<string, Set<string>> = {};
  for (const cat of CRITICAL_CATEGORIES) coverage[cat] = new Set();

  for (const provider of providers) {
    if (!CRITICAL_CATEGORIES.includes(provider.category as (typeof CRITICAL_CATEGORIES)[number])) continue;
    const coveredStates = provider.scope === "FEDERAL" ? US_STATES : provider.states ?? [];
    for (const state of coveredStates) {
      coverage[provider.category].add(state);
    }
  }

  return coverage;
}

function main() {
  const allProviders: Provider[] = sanitizeProviderSeedRecords([
    ...(FEDERAL_NEW as Provider[]),
    ...(STATE_PROVIDERS as Provider[]),
  ]).providers;
  const coverage = collectCoverage(allProviders);

  const gaps: Array<{ state: string; category: string }> = [];
  for (const category of CRITICAL_CATEGORIES) {
    for (const state of US_STATES) {
      if (!coverage[category].has(state)) {
        gaps.push({ state, category });
      }
    }
  }

  console.log("Provider Coverage Audit");
  console.log(`Total providers scanned: ${allProviders.length}`);
  console.log(
    `States checked: ${US_STATES.length} x ${CRITICAL_CATEGORIES.length} = ${US_STATES.length * CRITICAL_CATEGORIES.length} cells`
  );
  console.log("");

  if (gaps.length === 0) {
    console.log("No coverage gaps found.");
    process.exit(0);
  }

  const byCategory: Record<string, string[]> = {};
  for (const gap of gaps) {
    (byCategory[gap.category] ??= []).push(gap.state);
  }

  console.log(`${gaps.length} coverage gaps found:\n`);
  for (const [category, states] of Object.entries(byCategory)) {
    console.log(`  ${category}: missing in ${states.length} states`);
    console.log(`    ${states.join(", ")}`);
  }

  process.exit(1);
}

main();
