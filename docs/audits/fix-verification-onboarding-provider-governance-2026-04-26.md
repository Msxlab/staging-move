# Onboarding And Provider Governance Audit Fix Verification

Branch: `onboarding-provider-governance-audit-fixes`

Source audits reviewed:

- `06-onboarding-address-services-moving.md`
- `07-provider-directory-governance.md`
- `08-provider-logo-contact-data-strategy.md`

The source audit files are read-only and were partially stale against current main. This verification fixes only confirmed, low-risk items and defers schema, data enrichment, scraping, paid-service, and product-policy work.

## Summary

- Findings reviewed: 48
- Confirmed and fixed in this branch: 13
- Already fixed before this branch: 15
- Stale: 0
- False positives: 0
- Deferred: 20
- Schema migrations added: no
- Provider rows added or changed: no
- Logo or phone scraping performed: no

## Validation Matrix

| Finding ID | Audit title | Current status | Evidence in current code | Fix decision | Files touched | Tests added | Launch relevance |
| --- | --- | --- | --- | --- | --- | --- | --- |
| F-OB-001 | `/onboarding` not gated by email verification | CONFIRMED | Middleware/session allowed valid `user_session`; onboarding layout did not check `emailVerifiedAt`. | Added server gate for email/password users with null `emailVerifiedAt`; OAuth-linked verified users are allowed. | `apps/web/src/lib/email-verification-gate.ts`, `apps/web/src/app/onboarding/layout.tsx`, `apps/web/src/app/(app)/layout.tsx` | `email-verification-gate.test.ts` | Private-beta blocker |
| F-OB-002 | OAuth-new-user landing path implicit | CONFIRMED | Google/Apple callbacks redirected to saved redirect path and relied on app layout to bounce incomplete users. | First-time OAuth users now redirect directly to `/onboarding`; existing users keep safe redirect behavior. | `apps/web/src/lib/oauth.ts`, Google/Apple callback routes | `oauth.test.ts` | Launch UX/security clarity |
| F-OB-003 | No DB-level duplicate Service guard | CONFIRMED | `POST /api/services` created services after address/provider checks with no duplicate lookup. | Added API-level duplicate guard for same user/address/category/provider identity; DB unique index deferred to `service-uniqueness-migration`. | `apps/web/src/lib/service-duplicate-guard.ts`, services routes, services new page | `service-duplicate-guard.test.ts`, services route tests | Launch data integrity |
| F-OB-004 | Custom provider uniqueness per user | CONFIRMED | `POST /api/custom-providers` created records without normalized duplicate check. | Added API-level duplicate guard for same user/name/category on create and update. DB unique index deferred. | `apps/web/src/lib/custom-provider-duplicate-guard.ts`, custom provider routes | `custom-provider-duplicate-guard.test.ts`, custom provider route tests | Launch data integrity |
| F-OB-005 | Listed-vs-custom service shadowing | CONFIRMED | Custom provider creation did not check listed provider names in same category. | Added safe 409 when a private provider name/category matches a listed provider; no auto-linking. | custom provider guard and routes | custom provider tests | Launch trust/data clarity |
| F-OB-006 | Move-task idempotency key omits state transition | CONFIRMED | `buildIdempotencyKey` used plan/service/action/provider but not route states. | Added normalized from/to state suffix and legacy-key lookup to avoid duplicate regeneration after deploy. | `apps/web/src/lib/move-task-generation.ts` | `move-task-generation.test.ts` | Launch data integrity |
| F-OB-007 | Address state validation deferred to task generation | CONFIRMED | Moving plan route could reach task sync before explicit route-state validation. | Added route-level origin/destination state validation and normalized inline destination state. | `apps/web/src/lib/moving-address-validation.ts`, moving route | `moving-address-validation.test.ts` | Launch blocker for move tasks |
| F-OB-008 | Service transfer loses bidirectional link | DEFERRED | `completeMoveTaskWithLocalEffect` stores `previousServiceId` and local metadata but no destination FK back to origin. | Requires schema/product retention design; defer to `move-service-transfer-linking`. | None | None | Post-launch correctness |
| F-OB-009 | `localEffect` JSON not typed | CONFIRMED | Web code cast `task.localEffect` as `any`; shared package had no parser. | Added shared `MoveTaskLocalEffect` interface and allowlist parser; web completion code now parses typed metadata. | `packages/shared/src/move-task-local-effect.ts`, web local-effects and moving detail | shared local effect test | Launch maintainability |
| F-OB-010 | Old service kept inactive forever / UX confusion | DEFERRED | Current transfer completion intentionally marks old service inactive and stores local-only notes. | Historical/archival UX needs product decision with F-OB-008; defer to `move-service-transfer-linking`. | None | None | Post-launch UX |
| F-OB-011 | Provider caveats not surfaced prominently | ALREADY_FIXED | Provider list/detail, services new, onboarding, moving detail, and shared trust helpers already show listed/unverified/manual caveats. | Kept existing caveats; added only missing-logo copy in provider detail. | provider detail copy | Covered by existing provider trust tests | Launch trust clarity |
| F-OB-012 | Address PATCH does not revalidate not soft-deleted | CONFIRMED | `PATCH /api/services/[id]` checked address ownership but not `deletedAt`. | Added soft-delete check and duplicate guard on service patch. | services `[id]` route | service duplicate tests | Launch data integrity |
| F-OB-013 | MovingPlan address FK onDelete unclear | DEFERRED | Prisma `MovingPlan.fromAddress` and `toAddress` relations have no explicit onDelete policy. | Retention policy/schema migration deferred to `move-service-transfer-linking`. | None | None | Post-launch retention |
| F-OB-014 | Duplicate address prevention | DEFERRED | Address creation policy may intentionally allow repeated locations for periods/ownership. | Product decision deferred to `address-dedupe-policy`. | None | None | Low |
| F-OB-015 | Provider popularity score never decrements | DEFERRED | Service delete decrements `userCount`; separate `popularityScore` semantics remain seed/ranking policy. | Defer to `provider-source-metadata` or provider scoring branch. | None | None | Low |
| F-OB-016 | Legal consent storage | ALREADY_FIXED | App layout reads versioned `LEGAL_CONSENT_EVENT`; legal helpers summarize stored consent metadata. | No change; do not disturb legal acknowledgement flow. | None | Existing onboarding/legal tests | Launch compliance |
| F-OB-017 | `syncMoveTasksForAddress` performance at scale | DEFERRED | Sync is bounded to 20 open plans and safe for launch-scale usage. | Defer performance work until measured. | None | None | Low |
| F-PROV-001 | Missing phone numbers | DEFERRED | Governance warnings flag `missing_phone`; no official-source phone metadata schema exists. | No scraping. Official-source workflow documented; data/schema work deferred to `provider-source-metadata`. | policy doc | None | Quality backlog |
| F-PROV-002 | Missing logos | CONFIRMED | Provider UI falls back to category icons; detail lacked explicit copy. | Added user-facing fallback copy and policy; no logos imported. | provider detail, policy doc | Existing provider trust tests | Trust clarity |
| F-PROV-003 | Cross-category duplicate domains | ALREADY_FIXED | Admin governance route derives domains with `normalizeProviderUrlDomain` and queues duplicate candidates. | No auto-merge; keep queue review. | None | Existing provider integrity tests | Governance backlog |
| F-PROV-004 | Two confidence enums | ALREADY_FIXED | Shared `provider-move-domain` maps coverage confidence and task confidence separately with display helpers. | No enum migration in this branch. | None | Existing shared confidence tests | Launch consistency |
| F-PROV-005 | No verificationStatus field | DEFERRED | Current schema has no verification status; UI uses listed/unverified copy. | Defer schema to `provider-source-metadata`; do not invent verification claims. | policy doc | None | Trust roadmap |
| F-PROV-006 | National/federal providers can outrank local providers | CONFIRMED | Recommendations were fixed, but `/api/providers` resorted by display/popularity after tiering. | Sort provider API results by coverage confidence before display/popularity/name. | provider API route | provider matching test | Launch recommendation quality |
| F-PROV-007 | Regional utility polygons not modeled | DEFERRED | Static polygon metadata exists for limited cases; no general polygon schema. | Defer to `provider-service-territory-polygon-model`. | None | Existing polygon tests | Future accuracy |
| F-PROV-008 | `subCategory` unused | ALREADY_FIXED | Provider list/detail/services UI render subcategory labels. | No change. | None | Existing UI/type coverage | Low |
| F-PROV-009 | Generic descriptions / marketing-speak | DEFERRED | Shared quality warnings flag generic/marketing descriptions. | Bulk content rewrite requires source review; defer to `web-i18n-provider-content` or provider content branch. | None | Existing provider integrity tests | Quality backlog |
| F-PROV-010 | Governance review lacks SLA/rejection/bulk action | DEFERRED | Admin review route supports statuses and audit logs, but no dueAt/rejectionReason/bulk schema. | Defer workflow v2 to `provider-governance-workflow-v2`. | None | Existing admin route behavior | Governance backlog |
| F-PROV-011 | Custom providers cannot be promoted globally | DEFERRED | Admin can mark promotion candidate/link to global; no source-backed promotion workflow. | Defer to `provider-governance-workflow-v2`; do not promote private data. | None | None | Future governance |
| F-PROV-012 | No second-review chain | DEFERRED | No schema for double-review approvals. | Defer to `provider-governance-workflow-v2`. | None | None | Future governance |
| F-PROV-013 | Governance issues sorted by severity only | ALREADY_FIXED | Admin route already sorts issues by severity and age. Category gravity/SLA is a future workflow enhancement, not a current blocker. | No change; keep broader workflow improvements deferred to `provider-governance-workflow-v2`. | None | None | Low |
| F-PROV-014 | No user notification on custom provider review | DEFERRED | Notification policy for review outcomes is not defined. | Defer to `provider-governance-workflow-v2`; no new notification automation. | None | None | Future UX |
| F-PROV-015 | `states`/`zipCodes` are JSON strings | DEFERRED | Schema still stores JSON strings plus generated coverage rows. | Broad schema/data migration deferred. | None | Existing coverage tests | Future scalability |
| F-PROV-016 | Popularity score increments only | DEFERRED | Service delete decrements `userCount`; popularityScore is separate ranking data. | Defer score semantics to provider scoring branch. | None | None | Low |
| F-PROV-017 | Duplicate slug guard manual | ALREADY_FIXED | `sanitizeProviderSeedRecords` dedupes/renames seed conflicts with tests. | No change. | None | Existing provider integrity tests | Seed safety |
| F-PROV-018 | Provider list UI does not show confidence | ALREADY_FIXED | Provider list/recommendation cards show coverage confidence labels and caveats. | No change. | None | Existing provider UI behavior | Launch trust clarity |
| F-PROV-019 | Admin governance lacks consolidated dashboard | ALREADY_FIXED | Admin Provider Governance page has summary cards and queues for provider quality, missing contact, duplicates, source validation, and custom reviews. | No change. | None | Existing admin route behavior | Ops readiness |
| F-LOGO-001 | All provider logos empty | CONFIRMED | Catalog data still lacks logos; UI fallback exists. | Added explicit fallback copy and policy; no logo import. | provider detail, policy doc | None | Trust clarity |
| F-LOGO-002 | Missing contact/phone data | DEFERRED | Missing phone warnings exist; source/contact fields absent. | Defer official-source enrichment to `provider-source-metadata`. | policy doc | None | Quality backlog |
| F-LOGO-003 | No canonical/source/contact columns | DEFERRED | Prisma `ServiceProvider` lacks sourceUrl/sourceType/lastCheckedAt/canonicalDomain fields. | Schema deferred to `provider-source-metadata`. | policy doc | None | Future governance |
| F-LOGO-004 | Duplicate domains need review | ALREADY_FIXED | Governance route derives duplicate-domain queues from current websites. | No auto-merge. | None | Existing provider integrity tests | Ops readiness |
| F-LOGO-005 | Generic descriptions need source review | DEFERRED | Shared warnings detect generic/marketing copy, but bulk rewrite needs source review. | Defer to provider content/source review branch. | None | Existing provider integrity tests | Quality backlog |
| F-LOGO-006 | Source/contact/logo policy missing | CONFIRMED | Existing docs were broader; no dedicated logo/contact policy page. | Added focused policy for official sources, logo licensing, metadata workflow, and no-scraping rules. | policy doc | None | Launch governance |
| F-LOGO-007 | Queue design | ALREADY_FIXED | Admin governance queues already cover missing contact, missing logo/provider quality, duplicate domain, source validation, broad coverage, and user-created review. | Keep metadata/schema enhancements deferred. | None | Existing admin route behavior | Ops readiness |
| F-LOGO-008 | No-cost first phase | ALREADY_FIXED | Admin derives canonical domains from websites for display/audit; UI fallback icons exist. | Documented no-cost workflow and added explicit detail fallback copy. | policy doc, provider detail | None | Launch polish |
| F-LOGO-009 | Paid/future enrichment phase | DEFERRED | No legal/budget approval for paid logo/contact/territory APIs. | Documented future-only approach; no dependency added. | policy doc | None | Future planning |
| F-LOGO-010 | No scraping guardrails | ALREADY_FIXED | Existing provider expansion docs prohibit random/scraped data; new policy makes it explicit for logos/phones. | No code changes needed. | policy doc | None | Risk control |
| F-LOGO-011 | User-created provider privacy | ALREADY_FIXED | User custom providers are scoped by `userId`; admin governance is support/review only. | Duplicate guards preserve privacy and avoid auto-promotion. | custom provider routes | custom provider tests | Privacy |
| F-LOGO-012 | No false verification claims | ALREADY_FIXED | Shared trust copy says listed/unverified/manual; provider surfaces avoid official/partner claims. | Kept wording; no verificationStatus added. | policy doc | Existing provider trust tests | Trust/legal |

## Fixed Findings

- F-OB-001: email/password users without verified email are gated before onboarding/app completion.
- F-OB-002: first-time OAuth signup redirects directly to onboarding.
- F-OB-003/F-OB-004/F-OB-005: API-level duplicate and shadowing guards for services and custom providers.
- F-OB-006/F-OB-007: move task idempotency and moving address state validation.
- F-OB-009: typed `localEffect` parser.
- F-OB-012: soft-deleted address guard on service updates.
- F-PROV-002/F-LOGO-001: visible logo fallback copy.
- F-PROV-006: provider API ranking respects coverage confidence before popularity.
- F-LOGO-006: official-source logo/contact enrichment policy.

## Deferred Findings

- `service-uniqueness-migration`: DB unique/index strategy for active services and custom providers after duplicate data audit.
- `move-service-transfer-linking`: destination service linkage, old-service historical UX, and MovingPlan FK retention policy.
- `provider-source-metadata`: sourceUrl/sourceType/lastCheckedAt/canonicalDomain/verificationStatus and official contact enrichment.
- `provider-service-territory-polygon-model`: broader utility territory polygon model.
- `provider-governance-workflow-v2`: SLA, dueAt, rejection reason, double-review, bulk actions, and user notification policy.
- `provider-logo-licensed-assets`: legal/budget-approved logo provider integration.
- `web-i18n-provider-content`: source-reviewed neutral descriptions and localized provider content.

## Provider Audit Results

- `pnpm audit:providers`: passed. Raw records 792, sanitized records 791, dedupe removals 1, cross-category domain duplicate buckets 37, missing logo 791, missing phone 315, broad state coverage 155, generic descriptions 133.
- `pnpm audit:providers:coverage`: passed. Scanned 740 providers across 204 state/category cells; no coverage gaps found.
- `pnpm audit:providers:readiness`: passed and wrote generated artifacts. Summary: 791 providers reviewed, 765 matrix cells, 58 missing critical state/category cells, 189 broad-only cells, 52 duplicate-domain buckets, missing logo 791, missing phone 315.
- `pnpm audit:providers:state-completeness`: passed with `--skip-fetch` through the package script and wrote generated artifacts. Summary: 52 catalog entries, 51 states covered, 47 newly added in merged seed, 5 catalog-only backlog entries, coverage models state=12, zip_prefix=36, polygon=3, live_address=1, official URL validation ok=52.

Generated provider audit artifacts were not staged for this branch.

## Tests Added

- Email verification gate helper tests.
- OAuth post-auth redirect helper tests.
- Service duplicate guard tests and services route duplicate/deleted-address tests.
- Custom provider duplicate/shadowing guard tests and route tests.
- Moving address state validation tests.
- Move task idempotency key tests.
- Shared `MoveTaskLocalEffect` parser tests.
- Provider confidence ranking test.

## Remaining Risks

- DB-level uniqueness is intentionally deferred until existing data can be audited.
- Provider source metadata and logo/contact enrichment need schema and legal/source-review decisions.
- Utility polygon support requires a dedicated territory model and source ingestion workflow.
- Custom provider promotion remains manual and must not expose private user-created data globally.
