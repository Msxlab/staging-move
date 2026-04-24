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
