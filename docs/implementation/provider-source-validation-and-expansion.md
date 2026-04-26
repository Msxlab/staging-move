# Provider Source Validation And Expansion

This process keeps provider expansion inside the current product. It does not add provider connectors, account linking, partner APIs, or automatic address-change execution.

## Operating Posture

- Treat provider records as listed and unverified until an approved source-validation path proves otherwise.
- Use provider coverage as a confidence signal, not as proof of address-level availability.
- Keep category fallback icons until an official or licensed logo source is approved.
- Do not bulk-add random providers from search results or SEO directories.

## Source Types

Preferred sources:

- State public utility commissions for electric, gas, water, telecom, and utility service-territory research.
- FCC broadband data/maps for internet/cable availability research.
- Official state DMV, voter, toll, transit, and agency pages for government and transportation tasks.
- Official provider websites/contact pages for canonical domains and phone/contact validation.
- Licensed brand/logo sources only when logo use is allowed.

Do not use generic SEO pages, reseller directories, or search snippets as proof.

## State-By-State Review

1. Run `pnpm audit:providers:readiness`.
2. Open `docs/generated/provider-readiness-gap-report.md`.
3. Review missing critical state/category cells first.
4. Review broad-only critical coverage next, especially utilities and internet/cable.
5. Review duplicate-domain buckets before adding more records.
6. Validate official source URLs before adding or changing providers.
7. Keep records listed/unverified unless source metadata storage has been approved.

## Repeatable Expansion Pipeline

Use this workflow for each state or national category pass. The goal is coverage quality, not raw count growth.

1. Create an inventory row for each coverage bucket:
   - DMV / state government / tax / voter / benefits.
   - Electric, gas, water, sewer, and municipal utility.
   - Internet, mobile, cable, and phone.
   - Banks, credit unions, credit cards, fintech, and loans.
   - Renters, auto, home, health, flood, pet, and life insurance.
   - Postal, shipping, mailbox, and package services.
   - Home services, moving, storage, security, and parking.
   - Pharmacy, telehealth, doctors, dentists, veterinary, and senior care.
   - Retail, grocery, delivery, subscriptions, wellness, and other address-relevant accounts.
2. Prefer official provider, regulator, or state agency sources. Record the source URL in review notes when a source is used.
3. Normalize candidates before adding them:
   - `name`: consumer-facing brand or agency name.
   - `slug`: lowercase, stable, hyphenated identity; do not change existing slugs unless merging duplicates.
   - `category`: precise backend category, such as `FINANCIAL_CREDIT_CARD` or `HEALTHCARE_PHARMACY`.
   - `description`: neutral service description; no partnership, sync, or activation claims.
   - `scope`: `FEDERAL` for national listings, `STATE` with `states` for state-specific listings.
   - `tags`: short search terms that help discovery without keyword stuffing.
4. Add national/manual directory records to `packages/db/prisma/seed-data/providers.ts`.
5. Add state-scoped coverage candidates to `packages/db/prisma/seed-data/state-provider-catalog.ts` when they are part of state completeness work and have a safe `seedRecord`.
6. Keep separate entries only when users would reasonably track them as separate services, such as a bank account and the same brand's credit-card product. Otherwise, prefer one identity.
7. Run dedupe and coverage checks before shipping:
   - `pnpm audit:providers`
   - `pnpm audit:providers:coverage`
   - `pnpm audit:providers:state-completeness`
8. Treat all new rows as listed/unverified/manual-tracking until a future schema-backed verification workflow exists.

## Logo And Contact Rules

- Missing logo is not a blocker; use the category fallback icon.
- A logo must not imply official partnership.
- Do not scrape random logos.
- Do not import logos from search-result image URLs, favicon scrapers, or unsourced brand-asset mirrors.
- A logo can be considered only when the source is an official provider site, government/provider media kit, or licensed brand asset source and the license allows product display.
- A phone number should come from an official provider page, state agency page, or approved licensed dataset.
- Contact validation should record the canonical domain, contact URL, phone source, redirect chain if relevant, and checked date in the review notes.
- If source URL, logo license, last checked date, or verification status must be stored, that is a schema decision.

## User-Created Provider Contact Review

User-created providers are private to the user and are not global catalog data.

Admin review can mark a user-created provider as reviewed, needs review, rejected, linked to a listed provider, or promotion candidate. Promotion to the global catalog still requires source validation.

Review priorities:

1. Provider name or notes look like spam, abusive content, or unsafe HTML.
2. Provider is attached to active move tasks or services.
3. Provider appears to duplicate a listed provider.
4. Provider has enough official contact detail to become a future source-review candidate.

Do not expose one user's private provider to another user. Do not copy a user-created provider into the global catalog without approved source review.

## Stale Data SLA Proposal

Until verification metadata exists in schema, these are operational review targets, not enforced product claims:

- Critical utilities, DMV, voter, toll/transit, and government task records: review every 90 days.
- Internet/cable, insurance, and high-impact local services: review every 180 days.
- Financial, shopping, subscriptions, and national account providers: review every 365 days.
- Broken domain, duplicate-domain conflict, missing phone, promotion candidate, broad coverage, or address-check-required provider: review before showing as high confidence.

## Missing Logo Report

Run `pnpm audit:providers` or `pnpm audit:providers:readiness` and review:

- `docs/generated/provider-seed-audit.md`
- `docs/generated/provider-readiness-gap-report.md`

Current expected posture:

- Missing logos are quality warnings, not production blockers.
- Category fallback icons remain the default unless an official/licensed source is approved.
- Logo presence does not change trust status or imply partnership.

## Cleanup Backlog Shape

Use the generated report to build review slices:

- Missing critical category for a state.
- Broad state/federal coverage in an address-sensitive category.
- Duplicate domain across unrelated categories.
- Missing phone or contact path.
- Generic or marketing-heavy description.
- Provider that may need category split, service-territory split, merge, or cross-link.

Every cleanup slice should include the source used, the proposed change, and the user-facing risk it reduces.
