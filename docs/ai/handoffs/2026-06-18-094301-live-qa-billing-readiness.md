# Live QA + Billing Readiness Handoff

Date: 2026-06-18
Branch: `codex/product-brain-hygiene`

## Scope

Started the recommended next action from the Product Brain: live QA and billing readiness checks after the Dokploy cron fix, annual-first pricing, free-tier preview, CTA/a11y work, and mobile OTA.

No source-code fix was made in this pass.

## Completed Checks

### Live health

- `https://locateflow.com/api/health` returned `200`.
- `https://locateflow.com/api/ready` returned `200`.
- `https://admin.locateflow.com/api/healthz` returned `200`.
- `https://locateflow.com` returned `200`.
- `https://locateflow.com/pricing` returned `200`.

### Live public web QA in Chrome

Verified public pages:

- `/`
- `/pricing`
- `/faq`
- `/how-it-works`
- `/contact`
- `/about`
- not-found route

Observed:

- Public home/pricing render annual-first pricing: Individual `$24/year`, Family `$39/year`, Pro `$59/year`.
- Public pricing headline renders `Start with 14 days free`.
- Public acquisition endpoint `/api/acquisition/public-trial-campaign` returns `INDIVIDUAL90` as a compatibility code with `trialDays: 14`, `$24/year`, and monthly paid offer `$4.99/month`.
- No public-page DOM hit for stale `3 months`, `90 days`, `$3.99`, or `Unlimited addresses`.
- No nested `<a><button>` found on the checked public pages.
- Pricing billing toggle is a segmented `role="group"` control with `aria-pressed`.
- Annual is selected by default; switching to monthly shows `$4.99/month`, `$7.99/month`, and `$11.99/month`.
- FAQ page has FAQPage JSON-LD.
- Robots.txt is served and contains `User-Agent` records.

Screenshot evidence:

- `C:\Users\Windows\AppData\Local\Temp\locateflow-live-qa-20260618-0558\home-cli.png`
- `C:\Users\Windows\AppData\Local\Temp\locateflow-live-qa-20260618-0558\pricing-cli.png`
- `C:\Users\Windows\AppData\Local\Temp\locateflow-live-qa-20260618-0558\sign-in-cli.png`

### Logged-in dashboard structural QA

Chrome was already authenticated at `/dashboard`; to avoid recording possible customer or account PII, the pass only collected boolean/structural signals and did not save dashboard screenshots or raw dashboard body text.

Observed:

- `/dashboard` rendered without auth redirect.
- Move Command Center text was present.
- Briefing text was present.
- Home Dossier text was present.
- No stale pricing text matched `3 months`, `90 days`, `$3.99`, or `Unlimited addresses`.

Bug found:

- Logged-in dashboard still renders 4 nested `<a><button>` CTA instances:
  - `/moving/new` -> `Plan a Move`
  - `/addresses/new` -> `Add Address`
  - `/moving/new` -> `Plan a Move`
  - `/moving/new` -> `Plan a Move`
- Likely source surfaces:
  - `apps/web/src/app/(app)/dashboard/move-command-center.tsx`
  - `apps/web/src/app/(app)/dashboard/dashboard-client.tsx`

This should become a small CTA accessibility follow-up. Do not fix it without explicit approval.

### Local tests

Passed:

- `pnpm verify:typecheck`
  - Passed.
  - Local warning only: repo wants Node `22.x`; shell was Node `v24.13.0`.
- `pnpm --filter @locateflow/web test -- src/app/api/addresses/[id]/dossier/route.test.ts src/app/api/addresses/[id]/dossier/pdf/route.test.ts src/app/api/moving/route.test.ts src/app/api/moving/migration/route.test.ts src/app/api/move-tasks/route.test.ts src/app/api/acquisition/public-trial-campaign/route.test.ts src/lib/pricing-free-tier-contract.test.ts src/lib/billing.test.ts src/components/marketing/pricing-section.test.tsx`
  - 9 files passed.
  - 78 tests passed.
- `pnpm --filter @locateflow/mobile test -- src/lib/subscription-visible-plans.test.ts src/lib/home-dossier.test.ts src/lib/subscription-app-review.test.ts`
  - 3 files passed.
  - 112 tests passed.
- `pnpm --filter @locateflow/admin test -- src/lib/billing-metrics.test.ts src/app/api/billing/route.test.ts src/app/api/subscriptions/route.test.ts`
  - 3 files passed.
  - 24 tests passed.
- Live public Chromium e2e:
  - `PLAYWRIGHT_BASE_URL=https://locateflow.com pnpm --filter @locateflow/web e2e -- tests/e2e/public-pages.spec.ts --project=chromium`
  - 9 tests passed.
- Live public Chromium accessibility:
  - `PLAYWRIGHT_BASE_URL=https://locateflow.com pnpm --filter @locateflow/web e2e -- tests/e2e/accessibility.spec.ts --project=chromium`
  - 8 tests passed.
  - Home, pricing, sign-in, and sign-up passed serious/critical a11y checks in light and dark mode.

Failed / needs triage:

- Wider web slice:
  - `pnpm --filter @locateflow/web test -- src/lib/pricing-free-tier-contract.test.ts src/lib/billing.test.ts src/lib/subscription-copy-regression.test.ts src/app/api/acquisition/public-trial-campaign/route.test.ts src/app/api/addresses/[id]/dossier/route.test.ts src/app/api/addresses/[id]/dossier/pdf/route.test.ts src/app/api/moving/route.test.ts src/app/api/moving/migration/route.test.ts src/app/api/move-tasks/route.test.ts src/components/marketing/pricing-section.test.tsx src/components/dashboard/home-dossier.test.tsx`
  - 9 files passed, 2 files failed.
  - 152 tests passed, 2 tests failed.
- `apps/web/src/lib/subscription-copy-regression.test.ts`
  - Fails because the test expects old `role="tablist"` source text, but current implementation uses `role="group"` with `aria-pressed`.
  - This appears to be a stale test expectation, not a live UX regression.
- `apps/web/src/components/dashboard/home-dossier.test.tsx`
  - Fails because the test expects the old nine locked insight rows including `Radon`, `Drinking water`, and `Air quality`.
  - Current free preview implementation shows a limited preview row set and upgrade CTA.
  - This appears to be a stale test expectation, not a live product regression.
- Live public all-project Playwright:
  - Chromium page tests passed.
  - WebKit browser launch failed because `C:\Users\Windows\AppData\Local\ms-playwright\webkit-2287\Playwright.exe` is not installed.
  - No browser install was performed.

## Blocked / Not Completed

- Full logged-in dashboard QA with account data was not completed because the currently authenticated Chrome session may contain real account/customer data. A dedicated QA account is needed.
- Free-tier enforcement live network checks were not performed against production because they require a known free QA account and could otherwise touch real account data.
- Home Dossier free preview live network payload was not inspected in production for the same reason.
- Mobile OTA on-device QA was not completed because no approved device/emulator session was available in this pass.
- Stripe Dashboard price object verification was not completed. A Stripe tab was open, but the read-only browser claim timed out; no Stripe write was performed.
- App Store Connect and Google Play subscription price verification were not completed. Store tabs were open, but no read/write dashboard verification was performed in this pass.

## Guardrails

- No application source code was modified.
- No deploy was performed.
- No feature flag was enabled.
- No migration was created or applied.
- No Stripe, Apple, Google Play, or production data write was performed.
- No secrets, credentials, tokens, private keys, `.env`, customer PII, or production data were read or stored.

## Recommended Next Actions

1. Approve a small source follow-up to fix logged-in dashboard nested CTA instances by converting remaining `<Link><Button>` to `<Button asChild><Link>`.
2. Approve a test-only cleanup to update stale pricing and Home Dossier test expectations to the current accepted UX:
   - pricing uses `role="group"` + `aria-pressed`;
   - free Home Dossier preview is limited and does not render the old nine locked rows.
3. Run live logged-in QA with a dedicated free QA account, then verify:
   - free dossier endpoint returns only preview subset;
   - AI briefing returns `entitled:false`;
   - moving plan create, move-task mutation, and provider migration are blocked for free.
4. Owner or approved operator should verify Stripe Dashboard, App Store Connect, and Google Play price objects/tiers manually with no writes unless separately approved.
