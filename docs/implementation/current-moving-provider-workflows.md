# Current Moving And Provider Workflows

This document describes the current LocateFlow product behavior. It does not describe Family, Pro, KYC, Plaid, USPS connectors, provider connectors, partner APIs, provider account linking, or automatic address-change execution.

## Provider Trust

Provider records are directory listings by default.

- User-facing label: listed provider.
- Data posture: unverified directory data unless a future source-backed validation path proves otherwise.
- Add-provider behavior: manual/local service tracking only.
- Availability posture: availability may vary by address.
- Required caveat: confirm details and availability with the official provider before acting.

Do not use verified, official, guaranteed, or available at your address unless the system has explicit source-backed evidence.

## ZIP And Coverage Confidence

Coverage confidence is ordered as:

1. Exact ZIP.
2. ZIP prefix.
3. Mapped service area.
4. State-level listing.
5. National or federal listing.
6. Address check required.
7. Unknown.

ZIP and state matching are confidence signals, not proof of service. Exact ZIP and ZIP prefix matches should rank above state-level and national listings for address-sensitive categories. National listings should not hide local utilities, municipal services, transit agencies, or other local providers.

The current app does not ship all US ZIP codes to web or mobile clients. Provider matching uses server/API-side provider fields, generated coverage rows, and static coverage metadata where available.

## Move Tasks And Transition Guidance

The move transition classifier now feeds persistent move tasks. These tasks are current-product workflow records inside LocateFlow; they do not update provider accounts or execute address changes outside LocateFlow.

Supported move task actions:

- Stop old service.
- Start destination service.
- Transfer service.
- Update address.
- Verify availability.
- Compare providers.
- Find replacement.
- Cancel or close.
- Government update.
- Requote insurance.
- Forward mail.
- No action.

Each task includes a reason, confidence, caveats, suggested next step, local effect, and provider candidates when relevant.

Move task statuses:

- Suggested.
- Accepted.
- In progress.
- Completed.
- Dismissed.
- Reopened.

Task completion can update LocateFlow local state where appropriate:

- Stop or cancel tasks can mark an existing local service inactive.
- Start, shop, or find replacement tasks can create a destination service record when the user selects a listed or custom provider.
- Transfer tasks can create a destination service record and mark the old service inactive when the user confirms.
- Update-address, government, insurance, mail, and verify tasks record local completion only.

Task completion never means LocateFlow updated an external provider account. Web and mobile must ask for confirmation before applying local effects.

## Custom Providers

Users can create private custom providers for local or personal services that are not in the global provider catalog.

Examples:

- Dentist.
- Law office.
- Physical therapy center.
- Local gym.
- Local utility.
- Local daycare.
- Local storage or parking provider.

Custom providers are private user records by default. They are user-added, unverified, and manual tracking only. Admin can review, link to a global provider, mark as local-only reviewed, reject, or flag as a promotion candidate, but promotion to the global catalog still requires source review.

## Examples

### PSE&G New Jersey To Texas

Expected guidance:

- Stop old PSE&G service at the New Jersey address.
- Find/start destination electric service in Texas.
- Compare providers if multiple Texas electric candidates exist.
- Confirm availability with the official provider or state marketplace.

The system must not claim PSE&G can transfer to Texas unless coverage data supports it.

### Same-State Utility Move

Same-state does not prove utility continuity.

- Exact ZIP or strong mapped coverage: possible transfer plus verify availability.
- State-level only: verify availability.
- No destination candidate: find replacement manually through official sources.

### Internet Or Cable

Internet/cable is address-sensitive.

- Address-check-required listings should show verify availability.
- National brands should not outrank local high-confidence candidates.
- User should confirm serviceability at the exact destination address.

### Insurance Interstate Move

Insurance should show requote/update guidance.

- Auto, renters, homeowners, and health coverage can change by address or state.
- No provider-side update is executed by LocateFlow.

### Bank Or Credit Card

Default guidance is update address.

- Do not recommend switching providers unless the account is explicitly local-only.
- Treat this as manual account maintenance.

### No Provider Candidate

Guidance should be find replacement with manual research.

- Use official state/provider sources.
- Do not invent provider recommendations.

### Many Provider Candidates

Guidance should be compare providers.

- Sort by coverage confidence first for address-sensitive categories.
- Show caveats and recommendation reasons.

## Provider Expansion Process

Provider expansion is source-first, state-by-state, and category-by-category.

Run:

```bash
pnpm audit:providers:readiness
```

Review:

- Missing critical state/category cells.
- Broad-only critical coverage.
- Duplicate-domain buckets.
- Missing logo and phone candidates.
- Generic or marketing-heavy descriptions.
- Split, merge, or cross-link candidates.

Use official sources only: state public utility commissions, FCC broadband data/maps, official state DMV/voter/toll/transit pages, official provider websites/contact pages, and approved licensed logo sources.

## Surface Requirements

Web, mobile, and admin must use the same product meaning:

- Provider records are listed/unverified unless source-backed validation exists.
- User-added providers are private custom records.
- Coverage confidence is a signal, not proof.
- Move tasks are manual workflow items.
- Completing a task updates LocateFlow only.
- External provider accounts are never updated by this workflow.
