import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { BILLING_PLAN_DEFINITIONS } from "@locateflow/shared";

/**
 * FREE-CONTRACT (consumer-free pivot, owner decision 2026-06-23).
 *
 * LocateFlow is now positioned as 100% free, forever — every feature included,
 * gated only by fair-use/abuse caps, funded by affiliate/referral commissions.
 * This file replaces the former paid-ladder copy contract: it pins the FREE
 * voice on the user-facing web surfaces and forbids "upgrade to Individual/Pro"
 * paywall language in the dossier/pricing copy.
 *
 * The paid-ladder ENTITLEMENT CONSTANTS in @locateflow/shared are deliberately
 * preserved (dormant) so the pivot stays reversible via CONSUMER_FREE_DEFAULT —
 * the test still asserts they exist, but no longer requires them to surface as
 * things-to-buy in consumer copy.
 */

const PAYWALL_PATTERNS: RegExp[] = [
  /upgrade to (?:the )?(?:individual|family|pro)\b/i,
  /requires? (?:the )?(?:individual|family|pro) plan/i,
  /part of the pro plan/i,
  /\bsubscribe to (?:individual|family|pro)\b/i,
];

function findRepoRoot(start = process.cwd()) {
  let current = start;
  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, "pnpm-workspace.yaml"))) return current;
    current = path.dirname(current);
  }
  throw new Error("Unable to locate repository root.");
}

const REPO_ROOT = findRepoRoot();

function readRepoFile(...segments: string[]) {
  return readFileSync(path.join(REPO_ROOT, ...segments), "utf8");
}

function readJson<T>(...segments: string[]): T {
  return JSON.parse(readRepoFile(...segments)) as T;
}

function expectAbsent(text: string, patterns: Array<string | RegExp>, label: string) {
  const hits = patterns
    .map((pattern) => {
      if (typeof pattern === "string") return text.includes(pattern) ? pattern : null;
      return pattern.test(text) ? String(pattern) : null;
    })
    .filter(Boolean);
  expect(hits, `${label} contains paywall/stale literals: ${hits.join(", ")}`).toEqual([]);
}

describe("consumer-free pricing + affiliate contract", () => {
  it("keeps the dormant paid-ladder entitlement constants intact (pivot is reversible)", () => {
    // We did NOT remove the billing infra — these constants must still exist so
    // CONSUMER_FREE_DEFAULT=false restores the paid ladder without a code change.
    expect(BILLING_PLAN_DEFINITIONS.FREE_TRIAL.priceLabel).toBe("Free");
    for (const plan of ["INDIVIDUAL", "FAMILY", "PRO"] as const) {
      expect(BILLING_PLAN_DEFINITIONS[plan].primaryBillingInterval).toBe("YEAR");
      expect(typeof BILLING_PLAN_DEFINITIONS[plan].yearlyPriceLabel).toBe("string");
    }
  });

  it("renders the free, everything-included pricing layout (no buy ladder)", () => {
    const pricing = readRepoFile(
      "apps",
      "web",
      "src",
      "components",
      "marketing",
      "pricing-section.tsx",
    );
    // The consumer-free layout exists and leads with free.
    expect(pricing).toContain("ConsumerFreePricing");
    expect(pricing).toContain("LocateFlow is free for your whole move");
    expect(pricing).toContain("No subscription, no credit card");
    expect(pricing).toContain("Everything included");
    expect(pricing).toContain("Get started free");
  });

  it("uses free voice (no upgrade/paywall language) in the web pricing i18n copy", () => {
    const en = readJson<{ pricing: Record<string, string> }>(
      "apps",
      "web",
      "src",
      "i18n",
      "messages",
      "en.json",
    );
    const es = readJson<{ pricing: Record<string, string> }>(
      "apps",
      "web",
      "src",
      "i18n",
      "messages",
      "es.json",
    );

    // The new free voice is present in both locales.
    expect(en.pricing.title).toContain("free");
    expect(es.pricing.title.toLowerCase()).toContain("gratis");
    expect(en.pricing.free_headline).toContain("100% free, forever");
    expect(es.pricing.free_headline.toLowerCase()).toContain("gratis");
    expect(en.pricing.why_free_title).toBe("Why is it free?");
    expect(es.pricing.why_free_title).toContain("gratis");

    // The user-facing FREE plan + dossier copy says everything-included, not "upgrade".
    const freeCopy = [
      en.pricing.subtitle,
      en.pricing.plan_free_description,
      en.pricing.plan_free_feature_4,
      es.pricing.subtitle,
      es.pricing.plan_free_description,
      es.pricing.plan_free_feature_4,
    ].join("\n");
    expect(freeCopy).toMatch(/included|forever|incluid/i);
    expectAbsent(freeCopy, PAYWALL_PATTERNS, "free pricing i18n copy");
    // The old "Upgrade when LocateFlow saves you money" subtitle must be gone.
    expectAbsent([en.pricing.subtitle, es.pricing.subtitle].join("\n"), [
      "Upgrade when LocateFlow",
      "Actualiza cuando LocateFlow",
    ], "pricing subtitle");
  });

  it("keeps the dossier-preview unlock copy free, not a paywall to Individual/Pro", () => {
    const en = readJson<{ dashboard: Record<string, string> }>(
      "apps",
      "web",
      "src",
      "i18n",
      "messages",
      "en.json",
    );
    const es = readJson<{ dashboard: Record<string, string> }>(
      "apps",
      "web",
      "src",
      "i18n",
      "messages",
      "es.json",
    );
    const copy = [
      en.dashboard.dossier_preview_unlock_title,
      en.dashboard.dossier_preview_unlock_body,
      en.dashboard.dossier_preview_unlock_cta,
      es.dashboard.dossier_preview_unlock_title,
      es.dashboard.dossier_preview_unlock_body,
      es.dashboard.dossier_preview_unlock_cta,
    ].join("\n");

    // Still talks about the FULL dossier (the feature is real + included)...
    expect(copy).toMatch(/full Home Dossier|Home Dossier completo|dossier completo/i);
    // ...but never frames it as a paid upgrade.
    expectAbsent(copy, PAYWALL_PATTERNS, "dossier preview copy");
    expectAbsent(copy, [
      "full report and PDF",
      "Unlock the full Home Dossier + PDF",
      /PDF export unlocks? with Individual/i,
    ], "dossier preview copy");
  });

  it("ships an FTC affiliate disclosure and places it on affiliate surfaces", () => {
    const disclosure = readRepoFile(
      "apps",
      "web",
      "src",
      "components",
      "affiliate",
      "affiliate-disclosure.tsx",
    );
    expect(disclosure).toContain("may earn a commission");
    expect(disclosure).toContain("at no extra cost to you");
    expect(disclosure).toContain("never affects our rankings");

    // It is actually rendered where provider/mover/affiliate links appear.
    const surfaces = [
      readRepoFile("apps", "web", "src", "app", "(app)", "providers", "providers-client.tsx"),
      readRepoFile(
        "apps",
        "web",
        "src",
        "app",
        "(app)",
        "moving",
        "plan",
        "[id]",
        "moving-plan-detail-client.tsx",
      ),
    ].join("\n");
    expect(surfaces).toContain("<AffiliateDisclosure");

    // Legal pages reflect "free, affiliate-funded" + carry the disclosure,
    // flagged for human/counsel review.
    for (const page of ["refund", "billing-policy"] as const) {
      const legal = readRepoFile("apps", "web", "src", "app", page, "page.tsx");
      expect(legal).toContain("AffiliateDisclosure");
      expect(legal).toContain("LEGAL REVIEW REQUIRED");
    }
  });

  it("leads with free on the home + pricing pages and drops the Pro-plan dossier pitch", () => {
    const surfaces = {
      home: readRepoFile("apps", "web", "src", "app", "page.tsx"),
      pricingPage: readRepoFile("apps", "web", "src", "app", "pricing", "page.tsx"),
      whyFree: readRepoFile("apps", "web", "src", "app", "why-free", "page.tsx"),
      dossierShowcase: readRepoFile(
        "apps",
        "web",
        "src",
        "components",
        "marketing",
        "dossier-showcase.tsx",
      ),
    };
    const text = Object.entries(surfaces)
      .map(([name, value]) => `--- ${name} ---\n${value}`)
      .join("\n");

    // Free is the lead message somewhere on these pages.
    expect(text).toMatch(/100% free, forever|free for your whole move|free because/i);
    // No hardcoded "part of the Pro plan" pitch left on the dossier showcase.
    expectAbsent(surfaces.dossierShowcase, ["part of the Pro plan"], "dossier showcase");
    // And no standalone "Pro" foil badge on the demo card: the showcase is an
    // ungated homepage surface, so a bare "Pro" pill on a row would read as a
    // paywall on a free feature. Match the JSX badge text exactly (a literal
    // >Pro< between tags), not the prose "Pro plan" mentions elsewhere.
    expect(
      />\s*Pro\s*</.test(surfaces.dossierShowcase),
      'dossier showcase renders a standalone "Pro" badge — relabel it (e.g. "Included") under the free model',
    ).toBe(false);
  });

  it("keeps the marketing dossier demo wired to the source scene matrix", () => {
    const dossierShowcase = readRepoFile(
      "apps",
      "web",
      "src",
      "components",
      "marketing",
      "dossier-showcase.tsx",
    );

    expect((dossierShowcase.match(/lf-dossier-scene-card/g) ?? []).length).toBeGreaterThanOrEqual(
      2,
    );
    for (const variant of [
      "sun",
      "cloud",
      "rain",
      "snow",
      "storm",
      "fog",
      "wind",
      "heat",
      "cold",
    ]) {
      expect(dossierShowcase).toContain(`variant: "${variant}"`);
    }
  });

  it("keeps the neutral app canvas with source paper accents and white web surfaces", () => {
    const globals = readRepoFile("apps", "web", "src", "styles", "globals.css");
    const aurora = readRepoFile("apps", "web", "src", "styles", "aurora.css");
    const tokens = readRepoFile("apps", "web", "src", "styles", "_tokens.generated.css");

    expect(tokens).toMatch(/--bg:\s*#F8FAFC;/);
    expect(globals).toMatch(/\.light\s*\{[\s\S]*--lf-source-paper-bg:\s*#EFEADF;/);
    expect(globals).toMatch(/\.light\s*\{[\s\S]*--lf-app-bg:\s*#F8FAFC;/);
    expect(globals).toMatch(/\.light\s*\{[\s\S]*--lf-app-chrome-bg-strong:\s*#FFFFFF;/);
    expect(globals).toMatch(/\.light\s*\{[\s\S]*--lf-app-panel-bg:\s*#FFFFFF;/);
    expect(globals).toMatch(/\.light\s*\{[\s\S]*--lf-app-panel-bg-strong:\s*#FFFFFF;/);
    expect(globals).toMatch(/\.light \.lf-app-shell \.bg-background\\\/55[\s\S]*background-color:\s*var\(--lf-app-panel-bg\);/);
    expect(globals).toMatch(/\.light \.app-shell-backdrop\s*\{[\s\S]*background:\s*none;[\s\S]*opacity:\s*0;/);
    expect(globals).toMatch(/\.lf-app-shell\[data-lf-theme="light"\]\s*\{[\s\S]*background:\s*var\(--lf-app-bg,\s*#F8FAFC\) !important;/);
    expect(globals).toMatch(/\.lf-app-shell\[data-lf-theme="light"\] \.app-shell-backdrop\s*\{[\s\S]*background:\s*none !important;[\s\S]*opacity:\s*0 !important;/);
    expect(aurora).toMatch(/\.light \.lf-aurora\s*\{[\s\S]*--background:\s*210 40% 98\.04%;/);
    expect(aurora).toMatch(/\.light \.lf-aurora\s*\{[\s\S]*--au-base:\s*#F8FAFC;/);
    expect(aurora).toMatch(/\.light \.lf-aurora \.lf-app-shell \.bg-background\\\/55[\s\S]*background-color:\s*var\(--lf-app-panel-bg,\s*#FFFFFF\);/);
    expect(globals).not.toContain("#F8F5EE 46%");
    expect(globals).not.toContain("--lf-app-bg: #F8F5EE");
    expect(globals).not.toContain("--lf-app-bg: #EFEADF");
    expect(globals).not.toContain("#DEDCD3");
    expect(globals).not.toContain("#D4D2C8");
    expect(globals).not.toContain("--lf-app-bg: var(--bg)");
    expect(globals).not.toContain("color-mix(in srgb, var(--bg) 18%, #FFFFFF 82%)");
    expect(globals).not.toContain("--lf-app-bg: #FAF7F0");
    expect(globals).not.toContain("--lf-app-bg: #F8F4EC");
  });
});
