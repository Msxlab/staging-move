# Briefing Typecheck Fix Handoff - 2026-06-16

Backlinks: [[../02_ACTIVE_EXPERIMENTS]], [[../experiments/QA_EXP1_COMMAND_CENTER_DEPENDABILITY]]

## Scope

- Approved fix: resolve web typecheck/lint failure in `apps/web/src/components/dashboard/move-briefing-card.tsx`.
- Guardrails: no deploy, push, migration, package install, or unrelated e2e fixes.

## Fix

- Narrowed the rendered briefing branch from `if (!parsed) return null;` to `if (!data || !parsed) return null;`.
- This preserves behavior while proving to TypeScript that `briefingTelemetryForState(data)` receives a non-null `BriefingFetchState`.
- Confirmed `briefingTelemetry` is live: it feeds `buildAiBriefingActionClickedMetadata({ briefingMode })` for `ai_briefing_action_clicked`.

## Full gate results

- `pnpm --filter @locateflow/web exec tsc --noEmit`
  - Result: PASS.
  - Output: engine warning only, `wanted node 22.x`, current `v24.13.0` / pnpm `9.15.0`.
- `pnpm --filter @locateflow/web lint`
  - Result: PASS.
  - Output: engine warning only, then `@locateflow/web@0.1.0 lint ... tsc --noEmit`.

## E2E triage

Earlier run: `pnpm --filter @locateflow/web e2e -- --project=chromium tests/e2e/public-pages.spec.ts`.

Result was 3 passed / 6 failed. I did not fix or rerun unrelated e2e here.

Conclusion: failures look pre-existing/environmental or test-expectation drift, not introduced by Phase-1 default-control behavior.

- Sign-in, sign-up, pricing, and unauthenticated dashboard redirect failures timed out in `page.goto(..., waitUntil: "load")`. The saved Playwright snapshots show the expected pages had rendered: sign-in form, sign-up form, pricing page, and dashboard redirect to sign-in. That indicates the dev server was responding and the UI content existed, but the Playwright harness never observed the `load` event within 30s.
- `robots.txt` failure is local/noindex behavior: `robots.ts` returns a block-indexing response for noindex/localhost-like environments, producing `User-Agent: *` and `Disallow: /` with no sitemap. The spec expects production-like `User-agent` casing and `Sitemap:`.
- FAQ JSON-LD failure is also noindex-related/test drift: `layout.tsx` renders sitewide `SiteSchemas` only when `BLOCK_INDEXING` is false, while the spec expects Organization and WebSite schemas. The FAQ page itself owns FAQ/Breadcrumb JSON-LD separately.
- The failed public/SEO routes do not depend on `ux_ai_briefing_experience_v1`, `ux_trust_copy_v1`, or `ux_onboarding_teaser_v1`, and those flags default to control/off.

## Recommendation

Leave public e2e fixes for a separate approval. Likely next steps are to make public page navigations wait for `domcontentloaded` or a visible locator, and to split production-indexing SEO expectations from localhost/noindex expectations.
