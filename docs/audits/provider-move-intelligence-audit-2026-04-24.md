# Provider Move Intelligence Audit - 2026-04-24

## 1. Scope And Guardrails

This audit covers the current service provider and moving logic only. It does not design or implement Family, Pro, KYC, Plaid, USPS connectors, provider connectors, partner APIs, automatic provider account linking, or automatic address-change execution.

Audited areas:

- `ServiceProvider` and `ServiceProviderCoverage` schema.
- Provider seed, import, export, coverage generation, matching, and recommendations.
- Web, mobile, and admin provider surfaces.
- Moving plan, service, reminder, checklist, migration, and state-rule logic.
- Current gaps in move-address transition behavior and provider recommendation trust.

Validation boundary:

- This audit inspected repository code and local provider audit outputs.
- No live production database, official provider source, FCC/PUC dataset, object storage bucket, or third-party provider account was queried.
- Provider records should be treated as listed and unverified unless a future official-source validation path proves otherwise.

## 2. Executive Verdict

Provider matching is deterministic and rule-based. There is no ML model in the current provider recommendation or moving migration logic.

The provider system has useful structure: providers have categories, broad scope, state and ZIP JSON fields, generated coverage rows, and recommendation metadata. The matching code can distinguish exact ZIP, ZIP prefix, polygon, state-level, federal/national, and live-address-check models in parts of the web provider API.

The current data is not reliable enough for address-level availability claims. The seed/catalog has broad federal and state records, no official verification metadata, no stored last-checked/source fields, no exact ZIP coverage rows in the current generated coverage audit, many missing phones/logos, and many generic or marketing-heavy descriptions from the earlier product-readiness audit.

Moving logic is partially useful but too coarse. The migration engine uses provider scope, provider `states`, category heuristics, and popularity. It does not use generated `ServiceProviderCoverage` rows, exact ZIP, ZIP prefix, polygon checks, live-address-required metadata, deregulated-market logic, or official service-territory proof. It can therefore say "transfer" or "available in the new state" when the safest user action should be "verify availability" or "find/start a destination provider."

Destination-address changes do not create durable tasks today. The app computes checklists and migration recommendations dynamically, but there is no persistent task model for move service transitions beyond `Reminder` records tied to services.

## 3. Evidence Map

Schema and data:

- `packages/db/prisma/schema.prisma:310` - `Service` includes `providerId`, `providerName`, `migrationAction`, `previousServiceId`, and service reminders.
- `packages/db/prisma/schema.prisma:370` - `MovingPlan` links origin/destination addresses and move dates but has no task relation.
- `packages/db/prisma/schema.prisma:437` - `Reminder` exists, but it is service-specific rather than a general move task model.
- `packages/db/prisma/schema.prisma:463` - `StateRule` stores DMV, voter, utility, tax, insurance, and common provider information.
- `packages/db/prisma/schema.prisma:481` - `ServiceProvider` stores name, category, description, website, phone, logo, scope, states, ZIPs, tags, popularity, and active/version fields.
- `packages/db/prisma/schema.prisma:526` - `ServiceProviderCoverage` stores provider, state, ZIP prefix, and exact ZIP.
- `packages/db/prisma/seed-data/provider-seed.ts:1` - current seed composition merges federal/state providers, expansions, overrides, and sanitizer output.
- `packages/db/src/provider-coverage.ts:13` - `rebuildProviderCoverage` regenerates provider coverage rows from the provider catalog.
- `packages/shared/src/provider-coverage.ts:140` - `expandCoverageRows` expands state and ZIP JSON into `ServiceProviderCoverage` rows.
- `packages/db/src/provider-coverage-metadata.ts:1` - in-code metadata supports `state`, `zip_prefix`, `polygon`, and `live_address` models, but this is not schema-backed verification metadata.

Provider APIs and matching:

- `apps/web/src/lib/provider-matching.ts:123` - in-memory matching checks exact ZIP, prefix, polygon, state, and live-address-required metadata.
- `apps/web/src/lib/provider-matching.ts:204` - database matching checks exact ZIP, prefix, federal/state rows, polygon metadata, and live-address-required metadata.
- `apps/web/src/lib/provider-matching.ts:258` - provider tiering orders exact, prefix, polygon, state, and live-address buckets.
- `apps/web/src/app/api/providers/route.ts:31` - provider list API filters by category, scope, search, tags, state, ZIP, and active status, then returns coverage metadata and match levels.
- `apps/web/src/app/api/providers/[id]/route.ts:23` - provider detail API returns provider data and alternatives but does not return the same coverage confidence details as the list API.
- `apps/web/src/app/api/providers/recommendations/route.ts:1` - recommendation API combines user profile, addresses, services, moving plan, provider coverage metadata, state rules, and community popularity.
- `packages/shared/src/recommendation-engine.ts:471` - `scoreProviders` uses deterministic scoring signals.

Moving, services, and checklist logic:

- `apps/web/src/app/api/moving/route.ts:42` - moving plan creation creates a plan and optional destination address; it does not persist move tasks.
- `apps/web/src/app/api/moving/[id]/route.ts:44` - moving plan update allows status/date fields only, not destination address replacement.
- `apps/web/src/app/api/moving/migration/route.ts:1` - migration analysis fetches origin services and all providers, then calls `analyzeMigration`.
- `packages/shared/src/migration-engine.ts:18` - migration actions are currently `TRANSFER`, `SWITCH`, `NEW`, `CANCEL`, and `KEEP`.
- `packages/shared/src/migration-engine.ts:166` - migration provider choice uses category, provider scope, provider states, and popularity.
- `packages/shared/src/migration-engine.ts:193` - migration analysis classifies services using scope/state/category heuristics.
- `packages/shared/src/migration-engine.ts:441` - migration task templates can be generated in memory, but there is no durable task model using them today.
- `packages/shared/src/relocation-checklist.ts:147` - checklist generation is client-side/shared logic based on move profile, destination state, move date, and completed categories.
- `packages/shared/src/relocation-checklist.ts:279` - task templates are generated as data objects, not persisted tasks.
- `apps/web/src/app/(app)/dashboard/dashboard-client.tsx:231` and `apps/web/src/app/(app)/services/services-client.tsx:98` - web clients generate checklist items dynamically.
- `apps/web/src/app/(app)/moving/[id]/page.tsx:41` - moving detail fetches migration analysis dynamically.

Provider UI and admin surfaces:

- `apps/web/src/app/(app)/providers/providers-client.tsx` - web provider list/search/filter UI.
- `apps/web/src/app/(app)/providers/[id]/detail-client.tsx` - web provider detail and add-service action.
- `apps/mobile/app/providers/index.tsx` - mobile provider list and recommendations.
- `apps/mobile/app/providers/[id].tsx` - mobile provider detail and add-service action.
- `apps/mobile/src/components/provider/ProviderCard.tsx` - mobile provider card labels.
- `apps/admin/src/app/api/providers/route.ts:50` - admin provider list, create, and CSV import API.
- `apps/admin/src/app/api/providers/[id]/route.ts:53` - admin provider detail, edit, delete API.
- `apps/admin/src/app/api/providers/bulk/route.ts:6` - admin provider bulk actions.
- `apps/admin/src/app/(admin)/providers/page.tsx:181` - admin CSV import/export UI.
- `apps/admin/src/app/(admin)/providers/[id]/page.tsx:153` - admin provider detail.
- `apps/admin/src/app/(admin)/providers/[id]/edit/page.tsx:184` - admin provider edit scope/states/ZIP controls.

## 4. Part 1 Questions Answered

### 4.1 Is provider matching rule-based or ML-based?

Provider matching is rule-based. No model inference, embeddings, trained ranking model, or learned scoring appears in the provider matching, recommendation, or migration code paths.

The deterministic matching path is:

- Filter active providers by query/category/scope/state/tags.
- Resolve destination state and ZIP.
- Attach static/in-code coverage metadata when present.
- Tier providers by exact ZIP, ZIP prefix, polygon, state/federal, or live-address-required metadata.
- Score recommendations with explicit weights for category urgency, move phase, popularity, coverage match level, state rules, existing service de-duplication, and profile tags.

### 4.2 What fields are used for ranking and recommendations?

Recommendation ranking uses:

- Provider category.
- Provider popularity score.
- Provider display order.
- Provider scope.
- Provider active status.
- Provider states and generated coverage rows.
- Coverage metadata such as model, note, source URL, and address/polygon check flags.
- Coverage match level: exact ZIP, ZIP prefix, polygon, state, or live-address-required.
- User profile fields such as move type and tags.
- Destination state and ZIP from request, address, or moving plan.
- Current services by provider name/category/provider ID.
- Moving phase derived from move date.
- State rules for destination state.
- Community popularity from existing local services.

The strongest scoring signals today are category urgency and move-phase/category relevance. Coverage confidence exists, but its scoring influence is small compared with urgency, essential-category, popularity, and state-rule boosts.

### 4.3 How does the system choose providers for a destination ZIP/state today?

For the provider list and recommendation APIs:

1. Resolve an effective state from `state` query, ZIP prefix, selected address, or moving plan.
2. Include providers that are `FEDERAL` or have coverage rows in the effective state.
3. If a ZIP is present, tier matches by exact ZIP, ZIP prefix, polygon metadata, state-level/federal, and live-address-required metadata.
4. Sort by display order, popularity, and recommendation score depending on route.

For moving migration analysis:

1. Fetch active services at the origin address.
2. Fetch all active providers.
3. Treat a provider as destination-compatible if it is `FEDERAL` or its JSON `states` include the destination state.
4. Pick the best same-category candidate by state-specific status and popularity.

Important difference: migration analysis does not currently use `ServiceProviderCoverage` rows, ZIP match tiers, polygon metadata, or live-address-required metadata.

### 4.4 Does the system distinguish exact ZIP, ZIP prefix, polygon, state-level, federal/national, live address check required, and unknown/unverified?

Partially.

The provider list/recommendation code can distinguish:

- Exact ZIP from `ServiceProviderCoverage.zipExact`.
- ZIP prefix from `ServiceProviderCoverage.zipPrefix`.
- Polygon from in-code metadata.
- State-level from state coverage rows or scope/state matching.
- Federal/national from `scope = FEDERAL`.
- Live address check required from in-code metadata.

Limitations:

- The schema does not store verification status, source, or last checked date.
- The current coverage audit reports no exact ZIP rows.
- Polygon/live-address metadata is code-level metadata, not a durable verified source.
- The provider detail APIs and UI do not consistently expose all confidence levels.
- Migration analysis collapses all destination coverage down to broad federal/state availability.
- Unknown/unverified is a real data-trust status, but it is not a first-class provider field.

### 4.5 Does the system produce tasks when a moving destination changes?

No durable tasks are produced when the moving destination changes.

The current system produces dynamic outputs:

- Checklist items are generated in memory from `generateChecklist`.
- Migration recommendations are generated on demand from `/api/moving/migration`.
- Migration task templates can be generated in memory by `generateMigrationTasks`, but there is no route that persists them as move tasks.
- The database has `Reminder`, but it is tied to `Service`, not a general moving task/checklist/action model.

### 4.6 If yes, what tasks?

There are no persisted move transition tasks.

Current dynamic checklist templates include moving-related categories such as utilities, internet, insurance, old utilities, medical records, school records, DMV, voter registration, tax agency, and mail forwarding. These items are generic checklist entries, not provider-specific transition tasks.

Current migration recommendations categorize origin services into:

- Keep/update-address style actions.
- Transfer to same provider in the new state.
- Switch to a different provider.
- Add missing destination service.
- Cancel old local service.

The wording and action taxonomy are coarser than the desired move service transition plan.

### 4.7 If no, what is the safest repo-native way to add task generation?

The safest first step is a pure shared classifier that returns proposed transition actions without writing new database rows.

Recommended sequence:

1. Add a pure function in `packages/shared` that accepts current service, origin address, destination address, same-category destination providers, state rules, and provider coverage match levels.
2. Return non-persistent action proposals using the action taxonomy in this audit.
3. Add unit tests for categories, same-state/interstate moves, exact ZIP, ZIP prefix, state-level, national address-sensitive, and no-candidate cases.
4. Expose proposals through the existing moving migration API as read-only data.
5. Update UI copy to say "recommended next step" and "confirm with the provider."
6. Only after product approval, decide whether to persist these as reminders, checklist items, or a new task model.

This avoids schema changes and avoids implying that the app can execute address changes.

### 4.8 Does adding a provider mean only local tracking, or does the UI imply account connection/address update?

Adding a provider creates or associates a local service record. It does not connect to a provider account, update an address with the provider, or execute a transfer.

Risky implication points:

- Provider detail screens use "Add as my service," which is mostly accurate but should keep "manual tracking" visible.
- Moving detail screens use action words such as transfer/update/switch. These are useful, but they can imply real provider-side execution unless caveated.
- Migration analysis can say a provider is available in a state based only on broad state/federal logic.

### 4.9 Where can ranking overstate national/state providers over local official providers?

Risk areas:

- Federal providers pass state filtering broadly.
- State-scoped providers can be treated as destination-compatible without address-level coverage.
- Coverage confidence weights are smaller than urgency, essential-category, popularity, and state-rule boosts.
- Migration analysis sorts destination candidates by state-specific status and popularity, not coverage confidence.
- National address-sensitive categories such as internet, trash, moving, home services, and local delivery can be treated too broadly.
- Existing-service de-duplication removes exact provider-name matches, but it does not distinguish "same provider should be an update/transfer task" from "same provider should not be recommended as new."

### 4.10 What data is missing to make recommendations reliable?

Missing data:

- Official source URL per provider record.
- Verification status and last checked timestamp.
- Contact verification status.
- Logo source/licensing status.
- Service territory confidence.
- Exact ZIP or address-level service availability for address-sensitive categories.
- Utility market rules such as deregulated retail choice vs municipal/co-op monopoly service.
- Provider/service territory split where a brand serves multiple regions or categories.
- Clear category-specific transition rules.
- User feedback labels, such as "recommended provider was useful," "provider served my address," or "started service successfully."

Without this data, recommendations should remain advisory and caveated.

## 5. Current Provider User Experience And Misunderstanding Risks

### 5.1 Web

Web users can search providers, filter by category, view recommendations, open details, and add providers as services. Current risk is that broad coverage labels and add-service flows may feel more authoritative than the data supports.

Truthful posture:

- Provider is a listed directory record.
- Availability may vary by address.
- Adding a provider means manual service tracking.
- User should confirm with the official provider before acting.

### 5.2 Mobile

Mobile users can browse providers, view provider cards/details, open website/phone actions, and add providers as services. Current labels such as "Nationwide," "State Coverage," and community reliability can overstate certainty for address-sensitive categories.

Truthful posture:

- Category fallback icons are safer than unlicensed logos.
- "Nationwide" should mean broad listing scope, not guaranteed address availability.
- Community signals should not be presented as provider reliability proof.

### 5.3 Admin

Admin users can create, edit, import, export, bulk update, activate/deactivate, delete, and inspect providers and coverage rows.

Operational gaps:

- No source/verification fields.
- No stale data queue.
- No official-vs-listed status.
- No review workflow for high-impact category/scope/coverage changes.
- Limited CSV export compared with full provider data.
- Bulk category/status/score changes can affect matching and ranking without the same step-up as delete.

## 6. Proposed Move Service Transition Plan

This plan uses current concepts first. It does not require provider connectors or automatic address changes.

### 6.1 Action Vocabulary

- `STOP_SERVICE`: end or schedule end of old service at the origin address.
- `START_SERVICE`: create or schedule new service at the destination address.
- `TRANSFER_SERVICE`: same provider appears likely to support destination service, but user must confirm.
- `UPDATE_ADDRESS`: update billing/contact/mailing address with an existing provider.
- `VERIFY_AVAILABILITY`: confirm service availability with the provider before relying on it.
- `SHOP_PROVIDER`: compare multiple destination candidates before choosing.
- `FIND_REPLACEMENT`: no strong destination candidate exists; user needs manual research.
- `CANCEL_OR_CLOSE`: cancel a local membership/account or close a location-specific service.
- `GOVERNMENT_UPDATE`: complete a government/state update such as DMV or voter registration.
- `INSURANCE_REQUOTE`: update insurer and requote policy for the new address/state.
- `MAIL_FORWARDING`: set mail forwarding or mailing address update; no USPS connector implied.
- `NO_ACTION`: no immediate move action identified.

### 6.2 Decision Matrix

| Scenario | Recommended action | Notes |
|---|---|---|
| Same provider covers destination exact ZIP | `TRANSFER_SERVICE` + `VERIFY_AVAILABILITY` | Exact ZIP is the strongest current catalog signal, but still requires user confirmation unless official validation exists. |
| Same provider covers destination ZIP prefix | `VERIFY_AVAILABILITY` + possible `TRANSFER_SERVICE` | Prefix is useful but not address-proof. |
| Same provider covers destination state only | `VERIFY_AVAILABILITY`; maybe `TRANSFER_SERVICE` for low-risk categories | State-wide coverage is too broad for utilities, internet, trash, transit, and local services. |
| Same provider is national/federal but address-sensitive | `VERIFY_AVAILABILITY`; maybe `UPDATE_ADDRESS` for account/billing | National brands should not outrank local utilities or imply address eligibility. |
| Same provider does not cover destination | `STOP_SERVICE` or `CANCEL_OR_CLOSE` + `FIND_REPLACEMENT` or `START_SERVICE` | Use category and destination candidates to decide replacement path. |
| Destination has one strong local provider candidate | `START_SERVICE` + `VERIFY_AVAILABILITY` | Strong means high coverage confidence, not just high popularity. |
| Destination has many provider candidates | `SHOP_PROVIDER` | Show why candidates are suggested and sort by coverage confidence first. |
| Destination has no provider candidate | `FIND_REPLACEMENT` | Recommend official-source manual lookup, not random web data. |
| Same-state move | `UPDATE_ADDRESS`, `TRANSFER_SERVICE`, or `VERIFY_AVAILABILITY` depending on category and coverage | Same state is not enough for utilities, internet, trash, transit, or municipal services. |
| Interstate move | `STOP_SERVICE`, `START_SERVICE`, `GOVERNMENT_UPDATE`, `INSURANCE_REQUOTE`, `UPDATE_ADDRESS` | Interstate moves need state-specific government and insurance steps. |
| Financial bank/credit card | `UPDATE_ADDRESS` | Usually not service-territory based; do not recommend replacement unless account is local-only. |
| Insurance | `INSURANCE_REQUOTE` + `UPDATE_ADDRESS` | Address and state can change premium/eligibility. |
| Government/DMV/voter | `GOVERNMENT_UPDATE` | Use official state pages and state rules. |
| Internet/cable | `VERIFY_AVAILABILITY`, `TRANSFER_SERVICE`, `SHOP_PROVIDER`, or `FIND_REPLACEMENT` | Address-specific; broad national listing is not enough. |
| Electric/gas/water/trash | `STOP_SERVICE` old + `START_SERVICE` destination; sometimes `SHOP_PROVIDER` | Utility territories are local/address-sensitive. |
| Subscription/shopping | `UPDATE_ADDRESS` | Usually no destination provider search needed. |
| Local membership/service | `CANCEL_OR_CLOSE` or `FIND_REPLACEMENT` | Examples: gym, local parking, HOA, local delivery, local membership. |

### 6.3 Category-Specific Guidance

Financial/bank/credit card:

- Default action: `UPDATE_ADDRESS`.
- Do not suggest switching providers unless the service is explicitly local-only.

Insurance:

- Default actions: `INSURANCE_REQUOTE` and `UPDATE_ADDRESS`.
- Interstate move should be high priority because coverage and rates can change.

Government/DMV/voter:

- Default action: `GOVERNMENT_UPDATE`.
- Use destination state rules and official state links.

Internet/cable:

- Default action: `VERIFY_AVAILABILITY`.
- If same provider exact/prefix coverage exists, propose possible `TRANSFER_SERVICE`.
- If multiple candidates exist, propose `SHOP_PROVIDER`.

Electric/gas/water/trash:

- Default actions: `STOP_SERVICE` for origin and `START_SERVICE` for destination.
- If deregulated market data exists in the future, use `SHOP_PROVIDER`.
- If municipal/co-op utility is identified, use `START_SERVICE` with that provider and verification caveat.

Subscription/shopping:

- Default action: `UPDATE_ADDRESS`.
- No automatic provider connection implied.

Local membership/service:

- Default action: `CANCEL_OR_CLOSE` or `FIND_REPLACEMENT`.
- Same-state moves still require local verification.

## 7. Concrete Move Examples

### 7.1 PSE&G In New Jersey To Texas

Input:

- Current provider: PSE&G.
- Current category: electric utility.
- Origin: New Jersey.
- Destination: Texas.

Expected current-product transition plan:

1. `STOP_SERVICE`: schedule PSE&G stop/close at the old New Jersey address.
2. `FIND_REPLACEMENT`: find destination electric service using official local/state utility sources.
3. `START_SERVICE`: start destination electric service once the correct provider is identified.
4. `SHOP_PROVIDER`: if the Texas ZIP is in a deregulated retail-choice area, compare retail electric providers.
5. `START_SERVICE`: if the destination is served by a municipal/co-op or non-choice utility, start service with that utility.
6. Always show: "Confirm availability with the official provider."

What the current code likely does:

- `packages/shared/src/migration-engine.ts:193` would classify the PSE&G service as `SWITCH` if PSE&G is a state provider and does not include Texas in its `states`.
- `packages/shared/src/migration-engine.ts:166` would choose a same-category destination provider by category, state inclusion/federal scope, and popularity.
- It would not know whether the Texas ZIP is deregulated, municipal/co-op, or served by a specific delivery utility.
- It would not produce durable tasks.

Required improvement:

- The migration engine should return stop/start/shop/verify actions with a coverage-confidence reason rather than implying a clean provider transfer.

### 7.2 Same-State Move

Same-state moves should not automatically imply service continuity.

Examples:

- Bank or credit card: `UPDATE_ADDRESS`.
- Health/renters/auto insurance: `INSURANCE_REQUOTE` or `UPDATE_ADDRESS`, depending on policy type.
- Electric/gas/water/trash: `VERIFY_AVAILABILITY`; often `STOP_SERVICE` at origin and `START_SERVICE` at destination.
- Internet/cable: `VERIFY_AVAILABILITY`; same provider may transfer only if it serves the exact destination address.
- Local gym/parking/membership: `CANCEL_OR_CLOSE` or `FIND_REPLACEMENT` if no longer local.

## 8. Provider Data Expansion Strategy

Do not bulk-add random providers. Provider expansion should be source-first, state-by-state, and category-specific.

### 8.1 Reports To Maintain

State x category coverage matrix:

- For each state, count providers by critical category.
- Distinguish federal/national listing, state-level, ZIP prefix, exact ZIP, polygon, and live-address-required coverage.
- Flag categories where all coverage is broad/unverified.

Missing critical categories per state:

- Electric.
- Gas.
- Water/sewer.
- Trash/recycling.
- Internet/cable.
- DMV.
- Voter registration.
- Toll/transit.
- Insurance.

Broad coverage assumptions:

- Federal or national providers in address-sensitive categories.
- State-scoped utilities/transit/trash/internet records without ZIP or source detail.
- Providers with `live_address` metadata but no visible user caveat.

Duplicate-domain buckets:

- Domains reused across multiple categories should be reviewed.
- Multi-category providers may be legitimate, but records should not look accidental.

Missing logo candidates:

- All providers without `logoUrl`.
- Logo should remain fallback icon until official/licensed source is approved.

Missing phone candidates:

- Providers missing a phone.
- Providers with a phone that has not been source-validated.

Generic/marketing description candidates:

- Descriptions with generic terms like "services for customers" or superlatives like "best," "largest," or "premium."
- Rewrite as neutral, sourceable directory copy.

Suspicious category counts:

- Categories with zero or one provider in states where the service is required.
- Categories with unusually high provider counts caused by overbroad imports.
- Categories where federal brands mask local official providers.

Split/merge/cross-link candidates:

- Split a provider when one brand has distinct service territories or categories.
- Cross-link same legal entity across categories only after review.
- Do not auto-merge duplicates without source review.

### 8.2 Official-Source Validation Types

Preferred source types:

- State public utility commissions for electric, gas, water, telecom, and utility service territories.
- FCC broadband availability data/maps for internet availability.
- EIA/FERC or state utility datasets where useful for utility territories.
- Official state DMV, voter registration, toll, transit, and public agency pages.
- Official provider website/contact pages.
- Licensed brand/logo sources when logo use is allowed.

Do not use generic SEO pages, reseller directories, or search snippets as proof.

Validation output should be "unverified" until source URL, last checked date, and confidence can be recorded. Adding those fields requires a schema/product decision.

## 9. Logo And Contact Strategy

### 9.1 Current State

The earlier current-product readiness audit found:

- 776 sanitized providers from 777 raw records.
- 776 providers missing logo URLs.
- 301 providers missing phone numbers.
- 118 generic descriptions.
- 28 marketing/superlative descriptions.
- 36 duplicate-domain buckets across categories.

These counts should be refreshed through provider audit scripts after provider trust changes merge, but the qualitative issue is clear: provider records are useful directory seeds, not verified provider records.

### 9.2 Logo Rules

- Do not scrape logos from random search results.
- Do not imply official partnership through logos.
- Prefer category fallback icons until a logo source is official or licensed.
- If a logo is sourced from an official provider page or licensed brand source, record source and last-checked metadata after schema approval.

Schema decision needed:

- `logoSourceUrl`
- `logoLicenseStatus`
- `logoLastCheckedAt`
- `providerDataSourceUrl`
- `providerLastVerifiedAt`
- `providerVerificationStatus`

### 9.3 Contact Validation Plan

For each provider:

1. Confirm official domain.
2. Confirm contact page or phone from official website or government/provider source.
3. Record redirect chain and canonical domain.
4. Mark stale or missing phone as warning, not as hard deletion.
5. Recheck high-impact providers on a defined cadence.

### 9.4 Stale-Data SLA Proposal

- Critical utilities/government/provider records: 90 days.
- Internet/cable, insurance, toll/transit: 180 days.
- Subscriptions/shopping/national account providers: 365 days.
- Any provider with broken website, duplicate-domain conflict, or category/scope ambiguity: review before being shown as high-confidence.

## 10. Recommendation Scoring Review

### 10.1 Current Scoring

Current deterministic scoring includes:

- Category urgency: critical, important, recommended, optional.
- Popularity and display order.
- Essential-category and move-phase boosts.
- Destination state/state-rule relevance.
- Coverage match boosts for exact ZIP, ZIP prefix, and polygon.
- Small penalty for address-check-required providers.
- Profile tag and community popularity signals.
- Existing service de-duplication by provider name/category.

Observed concern:

- Coverage confidence is not strong enough. Exact/prefix/polygon signals can be outweighed by category urgency, popularity, display order, state-rule boosts, and broad national/state scope.

### 10.2 Safer Scoring Rules

Recommended ordering:

1. Exact ZIP.
2. ZIP prefix.
3. Polygon/service area.
4. State-level.
5. National/federal.
6. Unknown/unverified.

Recommended rules:

- Coverage confidence should strongly affect ranking for address-sensitive categories.
- Address-check-required providers should not rank above local high-confidence providers.
- National brands should not hide local utilities, municipal services, transit agencies, or local government services.
- Existing service de-duplication should be action-aware. If a user already has the provider, show "update/transfer/verify" instead of recommending it as a new provider.
- Critical move categories should remain prioritized, but not at the expense of misleading coverage certainty.
- Every recommendation should explain why it is shown: category need, destination state, ZIP match, state rule, existing service, or manual verification needed.

### 10.3 ML Position

Do not add ML yet.

Useful ML would require labeled outcomes such as:

- Provider served the destination address.
- User started service successfully.
- User rejected provider as irrelevant.
- User confirmed contact data was correct.
- User completed a recommended transition task.
- Provider was stale/dead/duplicate.

Until then, deterministic scoring with transparent reasons is safer and more auditable.

## 11. Safe Implementation Assessment

This audit does not implement runtime code changes.

Reason:

- A durable task/action workflow would require product and likely schema decisions.
- Expanding the migration action taxonomy affects UI copy, API contracts, and support expectations.
- Provider verification metadata requires schema decisions.
- Provider data imports require official-source validation.
- Provider Trust v1 already addresses some user-facing truthfulness separately; this audit should not duplicate or conflict with that branch.

Safe next implementation without schema changes:

1. Add a pure shared transition classifier that returns non-persistent action proposals.
2. Add tests for the decision matrix in this audit.
3. Expose read-only proposals from the existing migration API.
4. Update moving UI copy to say "recommended next step" and "manual tracking only."
5. Keep all provider data as listed/unverified unless future metadata proves otherwise.

## 12. Items Requiring Product Decision

1. Whether move transition actions should be persisted as reminders, checklist items, or a new task model.
2. Whether `TRANSFER_SERVICE` is allowed as a label when no provider-side transfer automation exists.
3. How to classify deregulated utility markets, municipal/co-op utilities, and delivery-vs-retail electric providers.
4. Whether providers are a listed directory or a verified official catalog.
5. What evidence is required before showing "verified," "official," or "available at your address."
6. Whether logos may be shown, and what license/source evidence is required.
7. Whether high-impact provider edits need approval, source links, and stale-data review.
8. How support should explain provider recommendations to users.

## 13. Items Requiring Schema Changes

Likely schema changes, if approved:

- Provider source URL.
- Provider verification status.
- Provider last verified timestamp.
- Provider data owner/reviewer.
- Contact source and last checked timestamp.
- Logo source/license/last checked fields.
- Coverage source/confidence per provider or coverage row.
- Durable move task/action model, or an extension of reminders/checklist items.
- State market rule model for deregulated utility markets and local service rules.

No schema changes should be added silently.

## 14. Items Requiring External Official-Source Validation

1. Provider official websites and canonical domains.
2. Provider phone/contact pages.
3. Utility service territories and deregulated market rules.
4. Internet/cable address availability source.
5. DMV, voter, toll, transit, and government links.
6. Provider logos and logo license/source.
7. Provider active/dead/redirect status.
8. Duplicate-domain legitimacy across categories.

## 15. Recommended Next Branch

Recommended next branch:

- `pr/provider-transition-classifier-v1`

Scope:

- Add a pure shared move transition classifier using the action taxonomy in this audit.
- Use existing provider coverage match levels and category rules.
- Add unit tests for PSE&G New Jersey to Texas, same-state utility moves, interstate insurance, financial address updates, internet address-check-required, and no-candidate fallback.
- Return read-only action proposals from the moving migration API.
- Do not persist tasks.
- Do not add schema fields.
- Do not add connector automation or official/verified claims.

Follow-up branch after product/schema approval:

- `pr/provider-source-metadata-design`

Scope:

- Add source, verification, and stale-data fields if approved.
- Build provider data quality queues and official-source review workflows.
