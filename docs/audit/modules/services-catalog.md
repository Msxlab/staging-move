# Module Audit: Services & State Rules

> READ-ONLY audit. Evidence is source code only. Paths are relative to repo root
> (`apps/...`, `packages/...`). Items that cannot be confirmed from code are
> marked **[needs verification]**.

---

## 1. Module Summary

This module covers the tracked-services catalog (a user's/workspace's list of
utility, internet, insurance, etc. accounts attached to an address) and the
state-rules reference surface (DMV / voter / tax guidance per US state).

Core building blocks:

- `apps/web/src/lib/service-active.ts` — canonical "active tracked service"
  Prisma `where` builder (excludes soft-deleted / inactive / non-tracked
  migration actions) and a scope-aware variant.
- `apps/web/src/lib/service-sensitive-fields.ts` — at-rest encrypt/decrypt of the
  sensitive Service columns (accountNumber, username, phone, email, notes).
- `apps/web/src/lib/service-visibility.ts` — field-level redaction for the
  `service.viewSensitive` permission (AUTH-015) using the workspace data scope.
- `apps/web/src/lib/service-duplicate-guard.ts` — prevents tracking the same
  provider twice for the same (address, category) within scope.
- `apps/web/src/lib/service-provider-logo-enrichment.ts` — best-effort hydration
  of provider logo/website/phone from the global ServiceProvider catalog.
- `apps/web/src/app/api/services/route.ts` (GET list, POST create) and
  `apps/web/src/app/api/services/[id]/route.ts` (GET/PATCH/DELETE).
- `apps/web/src/app/api/state-rules/route.ts` (GET one state's rule).
- `packages/db/prisma/seed-state-rules.ts` and
  `packages/db/prisma/seed-data/state-rules.ts` (data).

The services CRUD is multi-tenant aware: in workspace mode it resolves a
`WorkspaceDataScope` and gates each action via the shared `can()` matrix. In
legacy mode (the current default — `WORKSPACE_MODEL_ENABLED` defaults OFF, see
`apps/web/src/lib/workspace-context.ts:96`) the scope is `legacyDataScope` and
the workspace gates / redaction are inert.

---

## 2. Related Files

| File | Role |
|------|------|
| `apps/web/src/lib/service-active.ts` | active-tracked `where` builders |
| `apps/web/src/lib/service-sensitive-fields.ts` | encrypt/decrypt sensitive cols |
| `apps/web/src/lib/service-visibility.ts` | viewSensitive redaction (AUTH-015) |
| `apps/web/src/lib/service-duplicate-guard.ts` | duplicate detection |
| `apps/web/src/lib/service-provider-logo-enrichment.ts` | provider catalog enrichment |
| `apps/web/src/app/api/services/route.ts` | GET list / POST create |
| `apps/web/src/app/api/services/[id]/route.ts` | GET / PATCH / DELETE one |
| `apps/web/src/app/api/state-rules/route.ts` | GET one state rule |
| `apps/web/src/lib/workspace-data-scope.ts` | scope resolution + gates |
| `apps/web/src/lib/validators.ts` (`serviceSchema`) | request validation |
| `packages/shared/src/permissions.ts` (`can`) | role policy matrix |
| `packages/db/prisma/seed-state-rules.ts` | 5-state plain-text seed |
| `packages/db/prisma/seed-data/state-rules.ts` | 51-row plain-text seed |
| `packages/db/prisma/seed.ts` / `seed-master.ts` | other StateRule seeders |
| `apps/web/src/app/(app)/services/services-client.tsx` | services UI (consumer) |

Tests present: `service-duplicate-guard.test.ts`,
`service-sensitive-fields.test.ts`, `service-provider-logo-enrichment.test.ts`,
`api/services/route.test.ts`, `api/services/[id]/route.test.ts`,
`api/state-rules/route.test.ts`. No test for `service-visibility.ts` or
`service-active.ts`.

---

## 3. Related Routes / Screens

- Web app: `(app)/services` → `services-client.tsx` (tracked services list/CRUD).
- Public SEO: `apps/web/src/app/moving/[state]/page.tsx` and
  `.../[state]/[city]/page.tsx` — these render from `@/lib/states/data.ts`, NOT
  from the `StateRule` DB table or `/api/state-rules`.
- Mobile: `apps/mobile/app/(tabs)/services.tsx`,
  `apps/mobile/src/components/provider/StateRulesCard.tsx`.
- Admin: `apps/admin/src/app/(admin)/state-rules/page.tsx` (CRUD of StateRule —
  out of this module's primary scope but the upstream writer of the data).

---

## 4. Related APIs

- `GET /api/services` — paginated active tracked services for the scope, with
  address/provider/customProvider includes, decrypt → enrich → redact.
- `POST /api/services` — create (rate-limited, plan-limited, duplicate-guarded).
- `GET /api/services/:id` — single service, scope-checked, decrypt → enrich →
  redact.
- `PATCH /api/services/:id` — update; re-runs duplicate guard; mutually
  exclusive provider/customProvider.
- `DELETE /api/services/:id` — soft delete (`deletedAt`, `isActive=false`,
  `deactivatedAt`).
- `GET /api/state-rules?state=XX` — single StateRule (dmvRules / voterRegistration
  / taxInfo only) plus static `GOVERNMENT_INFO_SOURCE_LINKS`.

---

## 5. Related Components

- `services-client.tsx` (list, add/edit forms, calls `/api/services` and
  `/api/state-rules` for the onboarding checklist context at line ~331).
- `service-provider-logo-enrichment.ts` shapes the provider sub-object the UI
  renders (logo, website, phone).
- Mobile `StateRulesCard.tsx` and `MoveBriefingCard` consume state-rule data.

---

## 6. Related State / Hooks / Stores

- No dedicated store in the scoped lib files; the API routes are stateless.
- Server-side scope is derived per request via `resolveWorkspaceDataScope`
  (`workspace-data-scope.ts`).
- Client state lives in `services-client.tsx` (not deeply audited here; out of
  the lib/API scope but noted as the primary consumer).

---

## 7. Related Database / Models

- `Service` (`schema.prisma:488`): sensitive cols `accountNumber`, `username`,
  `phone`, `email`, `notes` stored `@db.Text` (encrypted at rest). Soft-delete
  via `deletedAt`; `isActive`/`activatedAt`/`deactivatedAt`; `migrationAction`.
  Well-indexed (userId, workspaceId, addressId, category, providerName, etc.).
- `ServiceProvider` (`schema.prisma:733`) — global catalog used for enrichment.
- `StateRule` (`schema.prisma:715`): columns `dmvRules`, `voterRegistration`,
  `utilityInfo`, `taxInfo`, `insuranceRules`, `commonProviders`. Unique on
  `stateCode`.

---

## 8. Impact Map

- **UI**: services list/forms; provider logo/website hydration; onboarding
  briefing checklist (calls `/api/state-rules`).
- **API**: `/api/services*`, `/api/state-rules`.
- **DB**: `Service`, `ServiceProvider`, `UserCustomProvider`, `Address`,
  `StateRule`, `ServiceCostLog` (FK), `AuditLog`.
- **Auth**: custom JWT (`requireDbUserId` / `requireVerifiedUser`); workspace
  RBAC via `can()`; field redaction via `service-visibility.ts`.
- **Admin**: admin state-rules CRUD is the writer of `StateRule`.
- **Mobile**: services tab and state-rules card consume the same APIs/seed shape.
- **Notifications**: services drive Reminder/MoveTask sync
  (`safeSyncMoveTasksForAddress`).
- **Integrations**: provider stats `userCount` increment on create.
- **Analytics/SEO**: `/moving/[state]` SEO pages use a *separate* data source
  (`@/lib/states/data.ts`), so the DB StateRule table does not feed SEO.
- **Tests**: see §17.

---

## 9. Buttons / Actions / Functions

### `activeTrackedServiceWhere` / `activeTrackedServiceWhereForScope` (`service-active.ts`)
- **Where used**: list GET, duplicate guard.
- **Expected**: build a `where` that excludes soft-deleted, inactive, and
  non-tracked migration actions (`CANCEL`/`ARCHIVE`/…) and scopes by workspace or
  user.
- **Actual**: matches expectation. `activeTrackedServiceWhereForScope` keys on
  `workspaceId` when present, else `userId` (`service-active.ts:37`).
- **Edge cases**: a service whose `migrationAction` is one of the NON_TRACKED
  values is excluded from the active list AND from the duplicate guard, so a user
  could re-add a provider they "cancelled" — that is the intended product
  behavior but worth a test (see SC-07).

### `encryptServiceSensitiveFields` / `decryptServiceSensitiveFields` (`service-sensitive-fields.ts`)
- **Where used**: create/update (encrypt), all reads (decrypt).
- **Expected**: encrypt only present, not-already-encrypted values; decrypt all.
- **Actual**: correct; `encryptValue` no-ops on already-encrypted (`isEncrypted`)
  values so a PATCH that echoes back an encrypted blob is not double-encrypted.
- **Error state**: `decrypt` of a malformed/legacy plaintext value is not guarded
  here — relies on `@/lib/shared-encryption` `decrypt` behavior **[needs
  verification]**.

### `canViewSensitiveService` / `redactService` / `redactServices` (`service-visibility.ts`)
- **Where used**: list GET (`redactServices`) and `[id]` GET (`redactService`).
- **Expected**: null out sensitive fields when the caller's role lacks
  `service.viewSensitive`.
- **Actual**: correct in workspace mode. In legacy mode (`!workspaceMode`) it
  always returns the record unredacted (`service-visibility.ts:54`) — by design,
  but currently the production default (flag OFF), so redaction is dormant
  (SC-06).
- **Permission check**: delegates to `can()`. Note `MEMBER` is always redacted
  because `canViewSensitiveService` never passes `fieldVisibility`, and
  `can(... "service.viewSensitive")` requires `fieldVisibility === "WORKSPACE"`
  for MEMBER (`permissions.ts:114`). The code comment documents this as
  intended.

### `findDuplicateTrackedService` / `duplicateServiceError` (`service-duplicate-guard.ts`)
- **Where used**: POST create, PATCH update.
- **Expected**: 409 if the same provider already tracked for (address, category)
  in scope.
- **Actual**: matches by `providerId`, then `customProviderId`, then normalized
  provider name; excludes `ignoreServiceId`. Correct.
- **Edge case**: in workspace mode the candidate set is scoped by `workspaceId`
  (not the acting user), so a CHILD/MEMBER who can only *see* their own services
  can still be blocked by another member's identical service. Minor UX surprise
  (SC-05).

### `enrichServicesWithProviderCatalog` (`service-provider-logo-enrichment.ts`)
- **Where used**: list GET and `[id]` GET, between decrypt and redact.
- **Expected**: fill missing logo/website/phone from the catalog.
- **Actual**: correct; only queries when some service lacks a logo. Runs BEFORE
  redaction in the list path, but since enrichment only touches provider
  metadata (not the sensitive Service columns) and redaction is the final step,
  no sensitive data is re-exposed.

### State-rules `GET` (`api/state-rules/route.ts`)
- **Expected**: return a state's DMV/voter/tax guidance.
- **Actual**: returns only `dmvRules`, `voterRegistration`, `taxInfo` plus static
  source links; silently drops `utilityInfo`, `insuranceRules`, `commonProviders`
  even though the model and seeds populate them (SC-03).

---

## 10. UI/UX Audit

- **State-rules response omits populated fields** — evidence:
  `api/state-rules/route.ts:24-33` returns only 3 of the 6 populated StateRule
  columns. Impact: any client expecting utility/insurance/provider guidance from
  this endpoint gets nothing; the data exists in DB but is unreachable via API.
  Recommendation: either expose the columns or stop seeding them. Priority: Low.
- **Static source links attached only when a rule row exists** — evidence:
  `api/state-rules/route.ts:24` returns `stateRule: null` for unknown states, so
  the always-valid `GOVERNMENT_INFO_SOURCE_LINKS` are withheld for states that
  have no DB row. Impact: a user moving to a not-yet-seeded state gets zero
  official links even though those links are state-agnostic. Priority: Low.
- Loading/disabled/error UI for the services list lives in `services-client.tsx`
  (not in scope); not audited at the component level here.

---

## 11. Logic Audit

- **Expected flow (create)**: auth → scope → gate → rate limit → plan limit →
  validate → address ownership → provider/customProvider existence → duplicate
  guard → encrypt → create → audit → provider stats → move-task sync. The route
  implements all of these in order (`api/services/route.ts:120-318`).
- **Mutually-exclusive provider link**: enforced on create (both → 400) and on
  PATCH the "other" id is cleared when one is set
  (`api/services/[id]/route.ts:220-221`). Correct.
- **Category normalization**: stored trimmed-uppercase on create
  (`route.ts:229`) and the list filter mirrors it (`route.ts:69`), and the
  duplicate guard cleans category the same way (`service-duplicate-guard.ts:28`).
  Consistent.
- **Seed-format inconsistency (state rules)**: `seed-data/state-rules.ts` stores
  `dmvRules`/`voterRegistration`/`taxInfo` as **plain strings** (matching what the
  API/UI render), but `packages/db/prisma/seed.ts:107` stores `dmvRules` as a
  **JSON-stringified object**. If `seed.ts` is ever run against the same table the
  app reads, the API would hand the client a raw JSON blob where it expects a
  sentence, and the SEO/checklist copy would render `{"vehicleRegistration":...}`
  (SC-02).
- **Three divergent StateRule seeders**: `seed-state-rules.ts` (5 states),
  `seed-data/state-rules.ts` (51 rows, via `seed-master.ts`), and `seed.ts`
  (different shape). Whichever runs last "wins" the table contents (SC-04).
- **No race-condition guard on duplicate create**: the duplicate check is a
  read-then-write with no unique constraint backing it — two concurrent POSTs for
  the same provider can both pass the guard and create duplicates (SC-01).

---

## 12. Reverse Logic Audit

- **Unauthorized user**: all service routes call `requireDbUserId` /
  `requireVerifiedUser`; state-rules calls `requireDbUserId`. 401 on failure.
- **Empty data**: list returns an empty `services` array with pagination;
  `[id]` returns 404; state-rules returns `{ stateRule: null }`.
- **API error**: caught and mapped (auth → 401/403, gate → mapped, Zod → 400,
  P2025 → 404, else 500).
- **Direct route access / IDOR**: `[id]` GET/PATCH/DELETE do `findUnique` by id
  then `assertScopedRecordAction`, which returns NOT_FOUND (not FORBIDDEN) for
  records outside the caller's scope (`workspace-data-scope.ts:126-128`) — no
  cross-tenant existence leak. Good.
- **Role change / token expiry**: each request re-resolves scope and re-checks
  `can()`, so a downgraded role loses access on the next request. SUSPENDED /
  OVERFLOW members are read-only via `can()` (`permissions.ts:76`).
- **Double-click**: see SC-01 (duplicate create race).
- **Dark theme / mobile viewport**: UI-layer concerns in `services-client.tsx`,
  not in the scoped lib/API; not audited here.

---

## 13. Security Audit

### SC-01 — Duplicate service create is a check-then-act race (no unique constraint)
- **Severity**: Low
- **Affected area**: `POST /api/services`, `findDuplicateTrackedService`.
- **Evidence**: `api/services/route.ts:260-271` reads candidates then creates;
  `Service` has no unique index on (workspaceId/userId, addressId, category,
  provider) — `schema.prisma:555-569` shows only non-unique `@@index`.
- **Risk**: data-integrity (duplicate tracked services), not a privilege issue.
- **Defensive abuse scenario (high-level)**: a client firing two rapid identical
  create requests can land two rows before either sees the other.
- **Prevention**: add a partial/unique DB constraint or wrap the
  check+create in a transaction with `SELECT ... FOR UPDATE`-equivalent.
- **Detection**: count duplicates per (address, category, provider) in a
  monitoring query.
- **Analysis (root cause)**: business uniqueness enforced only in app code.
- **Recommendation**: back the guard with a DB constraint.
- **Tests to add**: concurrent-create integration test expecting one 201 + one
  409.

### SC-02 — StateRule `dmvRules` format inconsistency (plain text vs JSON) across seeders
- **Severity**: Medium
- **Affected area**: `/api/state-rules`, `/moving/[state]` copy, seed scripts.
- **Evidence**: `seed-data/state-rules.ts:2` stores `dmvRules` as a sentence;
  `packages/db/prisma/seed.ts:107-132` stores `dmvRules` as
  `JSON.stringify({ vehicleRegistration: {...}, driversLicense: {...} })`. The
  API (`api/state-rules/route.ts:28`) and `/moving/[state]` (`page.tsx:222`,
  `buildFaq` at `:87`) render the field as a raw string with no `JSON.parse`.
- **Risk**: if `seed.ts` populates the live table, the client renders a JSON blob
  as user-facing copy; FAQPage JSON-LD would also contain JSON-in-JSON.
- **Defensive abuse scenario (high-level)**: not attacker-driven — a deploy/seed
  ordering mistake silently corrupts user-facing state guidance.
- **Prevention**: pick one canonical shape; make the seeders share a single typed
  source (`seed-data/state-rules.ts`) and delete the divergent inline data.
- **Detection**: assert in a test that no StateRule field begins with `{`.
- **Analysis (root cause)**: three independent seeders maintain their own copies.
- **Recommendation**: consolidate seeders (see SC-04).
- **Tests to add**: format assertion across all seeded rows.

### SC-03 — `/api/state-rules` drops populated columns (data unreachable)
- **Severity**: Low
- **Affected area**: `/api/state-rules`.
- **Evidence**: `api/state-rules/route.ts:25-33` returns only `stateCode`,
  `stateName`, `dmvRules`, `voterRegistration`, `taxInfo` + static links;
  `utilityInfo`, `insuranceRules`, `commonProviders` are populated by the seeds
  (`seed-data/state-rules.ts:2`) and modeled (`schema.prisma:723-726`) but never
  exposed.
- **Risk**: dead data / wasted storage and seeding effort; potential client
  confusion if a consumer assumes the API returns the full model.
- **Prevention/Recommendation**: expose the columns or drop them from the model
  + seeds.
- **Tests to add**: contract test documenting the intended field set (already
  partially covered by `route.test.ts:82` guarding shape drift).

### SC-04 — Three divergent StateRule seeders (data drift)
- **Severity**: Low
- **Affected area**: seeding pipeline.
- **Evidence**: `seed-state-rules.ts` (5 states, plain text),
  `seed-data/state-rules.ts` (51 rows, plain text, run by `seed-master.ts:79`),
  `seed.ts:103` (JSON shape). All upsert the same `StateRule` table by
  `stateCode`.
- **Risk**: whichever seeder runs last determines coverage and format; running
  the wrong one yields only 5 states or JSON-formatted copy (compounds SC-02).
- **Recommendation**: keep one seeder (`seed-data/state-rules.ts`), delete or
  clearly mark the others as fixtures.
- **Tests to add**: a seed smoke test asserting 51 rows in plain-text form.

### SC-05 — Duplicate guard scope blocks members on other members' services
- **Severity**: Low
- **Affected area**: workspace mode duplicate detection.
- **Evidence**: `findDuplicateTrackedService` uses
  `activeTrackedServiceWhereForScope({ workspaceId })` (`service-duplicate-guard.ts:39`,
  `service-active.ts:32-41`), scoping candidates by workspace, not the acting
  member.
- **Risk**: a CHILD/MEMBER who cannot *see* a peer's service still gets a 409 +
  `existingServiceId` for it, leaking that a service exists (minor info
  disclosure) and blocking a legitimate add.
- **Defensive abuse scenario (high-level)**: a restricted member probes
  provider/address/category combinations and infers what peers track from the
  409 `existingServiceId`.
- **Prevention**: for non-manager members, scope the duplicate check to the
  acting member, or return a 409 without `existingServiceId`.
- **Detection**: review 409 payloads returned to CHILD/VIEW_ONLY roles.
- **Recommendation**: align duplicate scope with view scope (childSelfOnly).
- **Tests to add**: workspace duplicate test for a CHILD member vs a peer's
  service. **[needs verification — depends on `WORKSPACE_MODEL_ENABLED`]**

### SC-06 — Sensitive-field redaction is dormant while workspace model is OFF
- **Severity**: Info
- **Affected area**: `service-visibility.ts`, all service reads.
- **Evidence**: `isWorkspaceModelEnabled` defaults OFF
  (`workspace-context.ts:96-99`) → `resolveWorkspaceDataScope` returns
  `legacyDataScope` (`workspace-data-scope.ts:44`) → `canViewSensitiveService`
  short-circuits to `true` (`service-visibility.ts:54`).
- **Risk**: not a live vuln in single-user mode (the user owns their data), but
  the AUTH-015 control is unverified end-to-end in production until the flag is
  enabled. Worth a gate-on test before rollout.
- **Recommendation**: add a workspace-mode redaction integration test and
  enable-flag rollout checklist item.

### SC-07 — Encryption round-trip on `decrypt` of legacy plaintext not guarded here
- **Severity**: Info / **[needs verification]**
- **Evidence**: `decryptServiceSensitiveFields` calls `decrypt(value)` for any
  truthy value (`service-sensitive-fields.ts:19-22`) with no `isEncrypted` guard,
  unlike the encrypt path. If a legacy row stored plaintext, behavior depends on
  `@/lib/shared-encryption.decrypt` (not read here).
- **Recommendation**: confirm `decrypt` is a no-op / safe on non-encrypted input;
  if not, guard with `isEncrypted` symmetrically.

No XSS/SSRF/SQLi found in the scoped code: inputs go through Zod
(`serviceSchema`), Prisma parameterizes queries, and outputs are JSON (no
`dangerouslySetInnerHTML` in the scoped files). State-rules input is a bounded
2-letter-ish code uppercased before a `findUnique` (`api/state-rules/route.ts:13`).

---

## 14. Performance Audit

- **List query**: paginated (`parsePaginationParams`), `findMany` + `count` run in
  parallel (`route.ts:83`). Includes are `select`-narrowed. Good.
- **Enrichment N+1 avoided**: `enrichServicesWithProviderCatalog` batches a single
  `findMany` over collected names/slugs (`service-provider-logo-enrichment.ts:73`)
  and short-circuits when no service is missing a logo. Good.
- **Search uses `contains`** on `providerName` (`route.ts:79`) — there is a
  non-unique index on `providerName` (`schema.prisma:559`) but a leading-wildcard
  `LIKE` from `contains` cannot use it efficiently. Low impact at expected row
  counts; note for scale (Low).
- **State-rules**: single indexed `findUnique` on `stateCode` (unique). Cheap. No
  caching headers set — minor; the payload is small and static-ish (Low).

---

## 15. Reliability Audit

- **Non-blocking side effects**: provider stats increment is wrapped in
  try/catch (`route.ts:305-314`); move-task sync uses `safeSyncMoveTasksForAddress`
  and the route does not fail on a reported sync failure (covered by a test).
  Good.
- **Partial failure / transactions**: create is NOT transactional across
  service-create + audit + stats + sync, but the secondary effects are
  best-effort and the audit log failure would currently bubble (createAuditLog is
  `await`ed without try/catch at `route.ts:290`) **[needs verification]** — if
  audit throws, the service is already created but the response is a 500, leaving
  client/server inconsistent.
- **Error mapping**: thorough (auth, gate, Zod, P2025, 500 fallback).
- **Monitoring/logging**: `[id]` route emits structured `service_auth_diagnostic`
  warnings (`api/services/[id]/route.ts:40-58`) — no PII (only counts/booleans).
  Good.

---

## 16. Dead Code / Cleanup

- **`packages/db/prisma/seed-state-rules.ts`** appears superseded by
  `seed-data/state-rules.ts` (run via `seed-master.ts`). It only covers 5 states
  and is not imported by `seed-master.ts`. Confirm it is not wired into any npm
  script before deleting **[needs verification]**.
- **StateRule columns `utilityInfo`, `insuranceRules`, `commonProviders`** are
  populated by seeds but never read by `/api/state-rules` and not used by the SEO
  pages (which read `@/lib/states/data.ts`). Effectively dead through this API
  surface (see SC-03) **[needs verification — admin UI may surface them]**.
- No unused exports detected within the four scoped lib files; all are imported by
  the service routes.

---

## 17. Tests

Existing:
- `service-duplicate-guard.test.ts`, `service-sensitive-fields.test.ts`,
  `service-provider-logo-enrichment.test.ts`.
- `api/services/route.test.ts` (encrypt-on-create, decrypt/enrich/redact
  passthrough, address-ownership 404, plan-limit, non-blocking sync).
- `api/services/[id]/route.test.ts`.
- `api/state-rules/route.test.ts` (auth, missing-param, contract shape,
  null-state, uppercase normalization).

Missing / suggested:
- **Unit**: `service-visibility.ts` — redaction for CHILD/VIEW_ONLY/MEMBER vs
  OWNER/ADMIN, own-record, legacy mode (no test exists today).
- **Unit**: `service-active.ts` — NON_TRACKED migration actions excluded.
- **Integration**: workspace-mode list/`[id]` redaction (CHILD sees nulled
  account number; owner sees full) — covers SC-06.
- **Integration**: concurrent duplicate create (SC-01).
- **Seed**: StateRule format + coverage assertions (SC-02, SC-04).
- **Edge**: PATCH switching listed↔custom provider clears the other id.

---

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| services-catalog-01 | Medium | Data | StateRule `dmvRules` stored as JSON in `seed.ts` but plain text everywhere else; API/UI render it raw | JSON blob shown as user copy / in JSON-LD if `seed.ts` runs | Consolidate to one plain-text seeder; add format assertion test | `seed.ts:107`, `seed-data/state-rules.ts:2`, `api/state-rules/route.ts:28`, `moving/[state]/page.tsx:222` |
| services-catalog-02 | Low | Architecture | Three divergent StateRule seeders (5-state / 51-row / JSON) upsert same table | Coverage & format depend on run order | Keep `seed-data/state-rules.ts`; remove/flag others | `seed-state-rules.ts`, `seed-data/state-rules.ts`, `seed.ts`, `seed-master.ts:79` |
| services-catalog-03 | Low | Data | `/api/state-rules` omits populated `utilityInfo`/`insuranceRules`/`commonProviders` | Seeded data unreachable via API | Expose or drop columns | `api/state-rules/route.ts:25-33`, `schema.prisma:723-726` |
| services-catalog-04 | Low | Reliability | Duplicate create is check-then-act with no unique constraint | Concurrent creates can duplicate | Add DB unique constraint / transaction | `api/services/route.ts:260-271`, `schema.prisma:555-569` |
| services-catalog-05 | Low | Security | Workspace duplicate guard scoped by workspace, not acting member; 409 leaks `existingServiceId` to restricted roles | Minor info disclosure + blocked legitimate add | Scope duplicate check to member for non-managers | `service-duplicate-guard.ts:39`, `service-active.ts:32-41` |
| services-catalog-06 | Info | Security | AUTH-015 sensitive-field redaction dormant while `WORKSPACE_MODEL_ENABLED` OFF | Control unverified end-to-end pre-rollout | Add workspace-mode redaction test + rollout gate | `service-visibility.ts:54`, `workspace-context.ts:96-99` |
| services-catalog-07 | Info | Reliability | `decrypt` called without `isEncrypted` guard on read (asymmetric with encrypt) | Legacy plaintext rows depend on `decrypt` safety | Confirm `decrypt` no-ops on plaintext; guard if not | `service-sensitive-fields.ts:19-22` |
| services-catalog-08 | Low | Test | No unit test for `service-visibility.ts` redaction or `service-active.ts` | RBAC field-masking unverified | Add the unit/integration tests in §17 | `service-visibility.ts`, `service-active.ts` |
| services-catalog-09 | Low | UI/UX | `GOVERNMENT_INFO_SOURCE_LINKS` withheld when no StateRule row exists | Users moving to unseeded states get no official links | Return static links even when `stateRule` is null | `api/state-rules/route.ts:24-33` |
| services-catalog-10 | Info | Reliability | `createAuditLog` awaited without try/catch in create path | Audit failure → 500 after service already created | Wrap audit in best-effort try/catch like stats | `api/services/route.ts:290` |

---

## 19. Module TODO

- [ ] **(Medium) Consolidate StateRule seed format** — services-catalog-01.
  Reason: JSON-vs-plaintext drift corrupts user-facing copy. Files: `seed.ts`,
  `seed-data/state-rules.ts`, `api/state-rules/route.ts`. Fix: make all seeders
  import `STATE_RULES_ALL`; delete inline JSON shape. Deps: none. Complexity:
  med. Risk: med (data migration if live table already holds JSON).
- [ ] **(Low) Remove/flag redundant StateRule seeders** — services-catalog-02.
  Files: `seed-state-rules.ts`, `seed.ts`. Fix: delete or mark as test fixtures
  after confirming npm scripts. Deps: SC-01. Complexity: low. Risk: low.
- [ ] **(Low) Decide on extra StateRule columns** — services-catalog-03. Expose
  via API or drop from model+seeds. Complexity: low. Risk: low.
- [ ] **(Low) Back duplicate guard with a DB constraint** — services-catalog-04.
  Files: `schema.prisma`, service routes. Complexity: med. Risk: med (migration).
- [ ] **(Low) Scope workspace duplicate guard to member for non-managers** —
  services-catalog-05. Files: `service-duplicate-guard.ts`. Complexity: low.
  Risk: low.
- [ ] **(Info) Add workspace-mode redaction integration test + rollout gate** —
  services-catalog-06/08. Files: new tests. Complexity: med. Risk: low.
- [ ] **(Info) Verify `decrypt` is safe on plaintext; guard if not** —
  services-catalog-07. Files: `service-sensitive-fields.ts`,
  `shared-encryption.ts`. Complexity: low. Risk: low.
- [ ] **(Low) Return static source links when stateRule is null** —
  services-catalog-09. Files: `api/state-rules/route.ts`. Complexity: low. Risk:
  low.
- [ ] **(Info) Wrap audit log in best-effort try/catch in create** —
  services-catalog-10. Files: `api/services/route.ts`. Complexity: low. Risk:
  low (don't suppress real errors silently — log them).
