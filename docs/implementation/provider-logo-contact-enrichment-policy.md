# Provider Logo And Contact Enrichment Policy

LocateFlow provider records are listed directory entries for manual tracking. This policy keeps logo, phone, source, and coverage enrichment source-backed without implying official status, partnership, or address-level availability.

## Current Product Rules

- Treat every ordinary provider record as a listed provider, not an official or verified provider.
- Do not display "official", "verified", "partner", or "available at your address" unless a future schema-backed validation workflow supports that exact claim.
- Missing logos are not production blockers. Show the category fallback icon and copy such as "Logo unavailable; category icon shown."
- Missing phone numbers are quality backlog items, not permission to scrape random directories.
- Coverage confidence is a ranking signal only. Users must confirm availability with the provider before acting.
- User-created providers stay private to the owning user. They must not be promoted to the global catalog without explicit source review.

## Approved Sources

Use these sources first:

- Official provider website or contact page.
- Official provider media kit or brand assets page for logos, only when usage is permitted.
- State regulator, public utility commission, public service commission, or official agency page for utilities and government-adjacent providers.
- Official state DMV, voter, tax, toll, transit, and benefit agency pages.
- Licensed logo/contact data provider only after legal and budget review.

Do not use:

- Google image results.
- Random favicon scrapers.
- SEO/business directories as proof.
- Unsourced social media avatars.
- User-created provider data as global provider truth.

## Review Metadata Workflow

Until schema support exists, capture review context in governance notes or issue metadata where available:

- `sourceUrl`: official URL used.
- `sourceType`: official_site, regulator, media_kit, licensed_logo_provider, state_agency, or other approved source.
- `lastCheckedAt`: review date.
- `reviewedBy`: admin/operator id when available.
- `reviewOutcome`: missing_contact, missing_logo, duplicate_domain, broad_coverage, source_validation_needed, or approved_for_future_update.

Schema-backed source metadata is deferred to `provider-source-metadata`.

## No-Cost First Phase

- Derive canonical domains from existing website URLs for audit display only.
- Keep governance queues for missing phone, missing logo, duplicate domain, broad coverage, and source validation candidates.
- Prioritize missing contact review by provider popularity and criticality when the queue supports it.
- Keep fallback category icons on user-facing surfaces.
- Add neutral user-facing caveats instead of stronger trust claims.

## Future Paid Or Data-Heavy Phase

These require dedicated review before implementation:

- Brandfetch, Clearbit-like, or other licensed logo APIs.
- Geocoding, parcel, or utility territory polygon data.
- State PUC/PSC structured feeds that need ingestion jobs.
- Bounce/contact validation services.
- Schema migrations for `sourceUrl`, `sourceType`, `lastCheckedAt`, verification status, logo license, canonical domain, or territory polygons.

## Required Copy

Safe copy:

- "Listed provider"
- "Provider listing"
- "Unverified directory data"
- "Manual tracking only"
- "Confirm availability with the provider before acting."
- "Logo unavailable; category icon shown."

Avoid copy:

- "Official provider"
- "Verified provider"
- "LocateFlow partner"
- "Available at your address"
- "We updated your provider account"
