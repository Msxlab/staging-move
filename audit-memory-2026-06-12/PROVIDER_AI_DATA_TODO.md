# Provider / AI / Data Audit TODO

Source rule for this pass: code-first audit. Do not rely on prior reports as evidence.

## Findings

- [x] Serviceability enrichment parity
  - Problem: FCC internet and OpenEI electric address-level confirmations are applied in `/api/providers/recommendations`, but not consistently in `/api/providers`, `/api/providers/[id]`, or `/api/providers/compare`.
  - Impact: recommendation cards can say a provider is available at the address while provider list/detail/compare still show weaker catalog-only confidence.
  - Proposed fix: create a shared server-side enrichment helper and call it only when coordinates and matching candidate categories exist. Keep graceful degradation and caching.

- [x] Mobile provider detail coverage context
  - Problem: mobile provider detail sends only `state` to `/api/providers/[id]`; it does not send `zip`, `lat`, or `lng`.
  - Impact: mobile detail loses ZIP/polygon/address precision that mobile list and web detail already have.
  - Proposed fix: include zip/coordinates in the mobile detail address type and request params; extend the API route to consume them.

- [x] Coverage match `none` fallback
  - Problem: `getProviderMatchLevelFromDb()` maps internal `none` to `state`, while `getProviderCoverageConfidenceFromDb()` maps the same `none` to `UNKNOWN`.
  - Impact: direct consumers such as detail/compare can display too-optimistic state-level coverage for a provider that does not match the chosen address.
  - Proposed fix: expose/return `unknown` for unmatched direct presentation paths and add regression tests.

- [x] FCC route regression tests
  - Problem: electric serviceability is mocked and tested in the recommendations route, but FCC internet serviceability is only unit-tested at the module level.
  - Impact: the internet dataset could stop flowing into recommendation results without a route-level test catching it.
  - Proposed fix: add FCC route tests mirroring the electric tests.

## Verified

- Main provider seed path includes `STATE_PROVIDER_EXPANSIONS` via `provider-seed.ts`; the new catalog expansion is wired into `seed-master.ts`.
- Focused tests passed: provider matching, FCC, electric, recommendations route, providers route.
- Implemented a shared provider serviceability helper for FCC/OpenEI enrichment across recommendation, list, detail, and compare paths.
- Added a broad public provider-detail rate limit before serviceability lookup to reduce coordinate-spam/external-API abuse without affecting normal use.
- Verified after implementation:
  - Web focused Vitest: 59 passed.
  - Shared focused Vitest: 61 passed.
  - TypeScript: web, shared, mobile passed.
  - `git diff --check` passed.
