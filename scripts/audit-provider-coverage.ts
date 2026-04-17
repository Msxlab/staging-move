/**
 * Audits seed-data/providers.ts for state coverage gaps across critical utilities.
 *
 * For each state, verifies at least one active provider exists for:
 *   UTILITY_ELECTRIC, UTILITY_WATER, UTILITY_GAS, UTILITY_INTERNET
 *
 * FEDERAL-scope providers count as covering every state.
 * STATE-scope providers count only for states in their `states` array.
 *
 * Exit 1 on any gap — safe to wire into CI.
 */
import { FEDERAL_NEW, STATE_PROVIDERS } from "../packages/db/prisma/seed-data/providers";

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

  for (const p of providers) {
    if (!CRITICAL_CATEGORIES.includes(p.category as any)) continue;
    const covered = p.scope === "FEDERAL" ? US_STATES : p.states ?? [];
    for (const st of covered) coverage[p.category].add(st);
  }
  return coverage;
}

function main() {
  const all: Provider[] = [...(FEDERAL_NEW as Provider[]), ...(STATE_PROVIDERS as Provider[])];
  const coverage = collectCoverage(all);

  const gaps: Array<{ state: string; category: string }> = [];
  for (const cat of CRITICAL_CATEGORIES) {
    for (const st of US_STATES) {
      if (!coverage[cat].has(st)) gaps.push({ state: st, category: cat });
    }
  }

  console.log("═══════════════════════════════════════");
  console.log("  Provider Coverage Audit");
  console.log("═══════════════════════════════════════");
  console.log(`Total providers scanned: ${all.length}`);
  console.log(`States checked: ${US_STATES.length} × ${CRITICAL_CATEGORIES.length} = ${US_STATES.length * CRITICAL_CATEGORIES.length} cells`);
  console.log("");

  if (gaps.length === 0) {
    console.log("✅ No coverage gaps — every state has ≥1 provider in every critical utility.");
    process.exit(0);
  }

  const byCat: Record<string, string[]> = {};
  for (const g of gaps) (byCat[g.category] ??= []).push(g.state);

  console.log(`❌ ${gaps.length} coverage gaps found:\n`);
  for (const [cat, states] of Object.entries(byCat)) {
    console.log(`  ${cat}: missing in ${states.length} states`);
    console.log(`    ${states.join(", ")}`);
  }
  process.exit(1);
}

main();
