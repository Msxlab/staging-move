# System Correctness Fix Report

Branch: `fix/system-correctness-audit`
Date: 2026-05-07

## 1. Summary

**Fixed (verified from source + locked in by tests):**
- A. Soft-delete model parity (`SOFT_DELETE_MODELS` mismatch with Prisma schema).
- B. Impersonation visibility & audit (banner + `auth/me` exposure + handoff `AdminAuditLog`).
- C. Web DELETE callers without `Content-Type` (3 sites + regression guard).
- E. `/api/state-rules` contract: 2 callers were reading `data.rules[0]` from a route that returns `data.stateRule`. Callers updated.
- F. Admin permission seed mismatch (`blog`, `acquisition_campaigns` missing from `seed-admin.ts`).
- G. `profileSchema` missing `isMilitary` (web + shared validators + onboarding payload + route persistence + sensitive-consent gate).

**False positives (verified absent in source, but lockdown test added):**
- D. Provider recommendation soft-delete filtering. The route already uses the `prisma` client extended with `withSoftDelete`, so all soft-delete-aware reads (Address, MovingPlan, Service, ServiceProvider) auto-filter `deletedAt: null`. Scope A's fix expanded that set to include `MoveTask`, `UserCustomProvider`, `BlogPost`, but those models are not consulted by the recommendations route. Lockdown test added so a future regression (e.g. a switch to `rawPrisma`) fails loudly.

**Inventoried but not deleted (per instructions, no destructive cleanup this pass):**
- See section 5.

**Not implemented (deferred):**
- Per-mutating-action audit logging while impersonated. Helper `recordImpersonatedMutation()` shipped in `apps/web/src/lib/impersonation-audit.ts`. Wiring it into every `POST/PUT/PATCH/DELETE` handler is out of scope for this PR — see "Findings Not Implemented" below.

## 2. Files Changed

### Modified

- `packages/db/src/soft-delete.ts` — `SOFT_DELETE_MODELS` corrected.
- `packages/db/prisma/seed-admin.ts` — added `blog`, `acquisition_campaigns` to seeded resources.
- `packages/shared/src/validators.ts` — `profileSchema` now includes `isMilitary`.
- `apps/web/src/lib/validators.ts` — same.
- `apps/web/src/lib/user-auth.ts` — `getUserSession` selects `impersonatedByAdminId` and includes it on `UserSessionClaims`.
- `apps/web/src/lib/onboarding-profile-payload.ts` — forwards `isMilitary`.
- `apps/web/src/lib/onboarding-profile-payload.test.ts` — updated assertion + new default-false test.
- `apps/web/src/app/api/auth/me/route.ts` — exposes `impersonation` block + `user.impersonatedByAdminId`.
- `apps/web/src/app/api/auth/me/route.test.ts` — added impersonated/non-impersonated cases.
- `apps/web/src/app/api/auth/impersonate-handoff/route.ts` — writes `AdminAuditLog` row on successful handoff.
- `apps/web/src/app/api/profile/route.ts` — persists `isMilitary` and gates it on SENSITIVE consent.
- `apps/web/src/app/api/profile/route.test.ts` — added `isMilitary` happy-path + consent-required cases.
- `apps/web/src/app/(app)/addresses/addresses-client.tsx` — DELETE now sends `Content-Type: application/json`.
- `apps/web/src/app/(app)/moving/[id]/page.tsx` — DELETE now sends `Content-Type: application/json`; state-rules consumer reads `data.stateRule`.
- `apps/web/src/hooks/use-addresses.ts` — DELETE now sends `Content-Type: application/json`.
- `apps/web/src/hooks/use-current-user.ts` — `CurrentUser` now carries `impersonatedByAdminId`.
- `apps/web/src/components/layout/app-shell.tsx` — renders `<ImpersonationBanner />`.
- `apps/mobile/app/moving/[id].tsx` — state-rules consumer reads `data.stateRule`.

### Added

- `apps/web/src/components/layout/impersonation-banner.tsx` — persistent banner shown while impersonating.
- `apps/web/src/lib/impersonation-audit.ts` — `recordImpersonatedMutation()` helper.
- `apps/web/src/lib/impersonation-audit.test.ts` — helper unit tests (impersonated row, no-op for normal session, field truncation).
- `apps/web/src/app/api/auth/impersonate-handoff/route.test.ts` — handoff writes audit row; missing session does not.
- `apps/web/src/app/api/state-rules/route.test.ts` — locks in the `{ stateRule: ... }` contract.
- `apps/web/src/lib/soft-delete-models.test.ts` — schema↔`SOFT_DELETE_MODELS` parity guard.
- `apps/web/src/lib/soft-delete-recommendations.test.ts` — exercises the extension contract for recommendation queries.
- `apps/web/src/lib/delete-content-type.test.ts` — repo-wide guard that DELETE callers send `application/json`.
- `apps/admin/src/lib/admin-permissions-seed-parity.test.ts` — `ADMIN_RESOURCES` ↔ `seed-admin.ts` parity.
- `docs/audits/system/system_correctness_fix_report.md` — this file.

### Untouched (unrelated dirty files in tree at session start)

`apps/admin/src/app/api/backup/**`, `apps/admin/src/lib/backup-*` files, and a few `apps/admin/src/app/api/health/route.ts`-adjacent files were already dirty in the working tree from prior in-progress work. Per the audit rules I did **not** touch them and will **not** stage them.

## 3. Confirmed Bugs Fixed

### A. Soft-delete model parity

- **Source evidence:** `packages/db/prisma/schema.prisma` declares `deletedAt DateTime?` on `User`, `Address`, `Service`, `MovingPlan`, `Budget`, `ServiceProvider`, `MoveTask`, `UserCustomProvider`, `BlogPost`. The previous `SOFT_DELETE_MODELS` set listed `Task` and `ProviderReview` (neither model exists in the schema) and omitted `MoveTask`, `UserCustomProvider`, `BlogPost`. Verified via `awk '/^model / {model=$2} /deletedAt DateTime/ {print model}' packages/db/prisma/schema.prisma`.
- **Fix:** Corrected the set in `packages/db/src/soft-delete.ts` to match the schema.
- **Tests added:** `apps/web/src/lib/soft-delete-models.test.ts` parses `schema.prisma` directly and fails if (a) any `deletedAt` model is missing from the set or (b) the set contains a model the schema does not declare.
- **Verification command:** `pnpm --filter @locateflow/web test -- src/lib/soft-delete-models.test.ts` → 3 tests pass.

### B. Impersonation visibility & audit

- **Source evidence (before fix):**
  - `apps/web/src/lib/user-auth.ts` did **not** select `impersonatedByAdminId` from `UserLoginSession` (line 456 selected only `id, userId, expiresAt, userAgent`).
  - `apps/web/src/app/api/auth/me/route.ts` did not surface impersonation status.
  - The repo had no app banner referencing impersonation (`grep -r "impersonat" apps/web/src` returned only the security page detail and the route comments).
  - `apps/web/src/app/api/auth/impersonate-handoff/route.ts` did not write an `AdminAuditLog` row.
  - The `impersonate` route comments claim "every request leaves an audit breadcrumb" — that promise was unfulfilled in the web app.
- **Fix:**
  1. `getUserSession` selects and propagates `impersonatedByAdminId` on `UserSessionClaims`.
  2. `/api/auth/me` exposes `{ impersonation: { active, adminId? } }` + `user.impersonatedByAdminId`.
  3. `useCurrentUser` hook carries the flag; `<ImpersonationBanner />` is mounted in `app-shell.tsx` and renders for the entire impersonation window.
  4. `/api/auth/impersonate-handoff` writes a single `AdminAuditLog` row on successful handoff (action `IMPERSONATE_HANDOFF`, entityType `User`, entityId = target userId, plus sessionId + expiresAt in `changes`, plus `ipAddress`).
  5. New helper `recordImpersonatedMutation()` so route handlers can emit per-action audit rows; safe no-op for non-impersonated sessions.
- **Tests added:**
  - `auth/me/route.test.ts` — impersonated session surfaces `impersonation.active = true`; non-impersonated returns `{ active: false }` and `user.impersonatedByAdminId = null`.
  - `auth/impersonate-handoff/route.test.ts` — handoff writes one `adminAuditLog.create` call with the expected payload; missing session writes nothing.
  - `lib/impersonation-audit.test.ts` — helper writes an audit row for impersonated mutation, no-ops for normal session, truncates oversized fields to schema column widths.
- **Verification command:** `pnpm --filter @locateflow/web test -- src/lib/impersonation-audit.test.ts src/app/api/auth/me/route.test.ts src/app/api/auth/impersonate-handoff/route.test.ts` → 11 tests pass.

### C. Web DELETE content-type mismatch

- **Source evidence:** `apps/web/src/middleware.ts` `applyCsrfCheck` rejects all mutations (`POST/PUT/PATCH/DELETE`) without `application/json` or `multipart/form-data` (the only carve-out is `/api/auth/logout`). Three callers sent neither header nor body:
  - `apps/web/src/app/(app)/addresses/addresses-client.tsx:52`
  - `apps/web/src/app/(app)/moving/[id]/page.tsx:219`
  - `apps/web/src/hooks/use-addresses.ts:53`
- **Fix:** All three now send `headers: { "Content-Type": "application/json" }`, `credentials: "same-origin"`, `body: JSON.stringify({})`. Other DELETE callers (`addresses/[id]/page.tsx`, `services/[id]/page.tsx`, `services/use-services.ts`) already had the correct shape — left untouched.
- **Tests added:** `apps/web/src/lib/delete-content-type.test.ts` walks `git ls-files apps/web/src` and asserts every `method: "DELETE"` site has `Content-Type: application/json` within a 6-line window above. The existing `middleware.test.ts` already locks in the inverse contract (DELETE without content-type → 403 `INVALID_CONTENT_TYPE`).
- **Verification command:** `pnpm --filter @locateflow/web test -- src/lib/delete-content-type.test.ts src/middleware.test.ts` → 20 tests pass.

### E. State-rules contract mismatch

- **Source evidence:** `/api/state-rules` returns `{ stateRule: { stateCode, stateName, dmvRules, voterRegistration, taxInfo } | null }`. Two callers were reading `data.rules[0]` (an array shape that the route never returned), silently dropping the state-rules guidance:
  - `apps/web/src/app/(app)/moving/[id]/page.tsx:188`
  - `apps/mobile/app/moving/[id].tsx:95`
  Other callers (`dashboard-client.tsx`, `services-client.tsx`, mobile `index.tsx`/`services.tsx`) were already on the correct `data.stateRule` shape.
- **Fix:** Two callers updated to read `d.stateRule`. Smaller side fixed (callers, not the route) so the four already-correct callers don't regress. Mobile change is a one-line logic fix, not a design change.
- **Tests added:** `apps/web/src/app/api/state-rules/route.test.ts` covers auth gate, missing-state 400, the documented `{ stateRule }` shape with extra columns dropped, `null` when missing, and uppercase normalization. Includes a `expect("rules" in body).toBe(false)` guard against accidental shape drift.
- **Verification command:** `pnpm --filter @locateflow/web test -- src/app/api/state-rules/route.test.ts` → 5 tests pass.

### F. Admin permission seed mismatch

- **Source evidence:** `apps/admin/src/lib/admin-permissions.ts` declares 14 resources (`users, subscriptions, reviews, providers, state_rules, badges, documents, moving_plans, tickets, audit_logs, admin_users, settings, blog, acquisition_campaigns`). `packages/db/prisma/seed-admin.ts` inlined only 12 — missing `blog` and `acquisition_campaigns`. With the legacy fallback in `checkPermission` removed (per the helper docstring), a freshly seeded SUPER_ADMIN would have come up missing rows for those resources.
- **Fix:** Added `blog` and `acquisition_campaigns` to the inlined list. Left a comment pointing readers at the parity test.
- **Tests added:** `apps/admin/src/lib/admin-permissions-seed-parity.test.ts` reads `seed-admin.ts` directly, parses out the resource list, and asserts both directions of inclusion against `ADMIN_RESOURCES`.
- **Verification command:** `pnpm --filter @locateflow/admin test -- src/lib/admin-permissions-seed-parity.test.ts` → 3 tests pass.

### G. profileSchema isMilitary missing

- **Source evidence:** `Profile.isMilitary Boolean @default(false)` is declared in `packages/db/prisma/schema.prisma:376`. Both validator copies (`packages/shared/src/validators.ts`, `apps/web/src/lib/validators.ts`) used `z.strictObject` and omitted the field, so the profile route silently rejected payloads carrying `isMilitary`. Onboarding had a UI affordance (`apps/web/src/app/onboarding/page.tsx:217,855`) that set `isMilitary` in client state, but the payload builder explicitly stripped it (and the existing test asserted that — wrong!).
- **Fix (minimal):**
  - Added `isMilitary: z.boolean().default(false)` to both validator copies. (Did not consolidate the duplicate this pass — that's a follow-up; both files now define the field consistently.)
  - `OnboardingProfileState` accepts `isMilitary?: boolean`; payload builder forwards it (defaulting to `false`).
  - Profile route persists `isMilitary` to the `Profile` row.
  - The `storesSensitiveProfileData` gate now also fires for `isMilitary === true` (matches the schema comment naming `Profile.isMilitary` as SENSITIVE).
- **Tests added/updated:**
  - `onboarding-profile-payload.test.ts` flipped from "strips isMilitary" to "forwards isMilitary"; added a defaults-to-false case.
  - `profile/route.test.ts` got two new cases: `isMilitary=true` with sensitive consent succeeds and persists; `isMilitary=true` without consent returns 400 `SENSITIVE_CONSENT_REQUIRED`. The default happy-path now asserts `isMilitary: false` on the upsert payload.
- **Verification command:** `pnpm --filter @locateflow/web test -- src/app/api/profile/route.test.ts src/lib/onboarding-profile-payload.test.ts` → 11 tests pass.

## 4. Findings Not Implemented

### B. Per-mutating-action audit during impersonation
- **Why not implemented:** Wiring `recordImpersonatedMutation()` into every `POST/PUT/PATCH/DELETE` handler is mechanically invasive (touches dozens of route files) and does not fit the "small, focused PR" rule. The handoff event + per-call helper deliver the most important property (a concrete audit row when a session is created and when a route opts in).
- **Risk:** Without per-action wiring, the audit trail for an impersonated session is the handoff row plus whatever `auditLog.create` calls already exist in individual routes. Forensic attribution still works; the gap is forensic *enumeration* of every action taken in the window.
- **Proposed next PR:**
  1. Extend `requireDbUserId` (and friends) to return the full session including `impersonatedByAdminId`.
  2. In each mutating route handler, call `recordImpersonatedMutation({ session, action: "<verb>_<entity>", entityType, entityId, route, ipAddress })` right before the success response.
  3. Add a parity test that scans for `prisma.<model>.(create|update|delete|upsert)` in mutating route files and asserts the same file imports `recordImpersonatedMutation`.

### G. Validator duplicate consolidation
- **Why not implemented:** Folding `apps/web/src/lib/validators.ts` into `packages/shared/src/validators.ts` is safe but touches every web import site. Out of scope for this audit.
- **Proposed next PR:** Replace `apps/web/src/lib/validators.ts` with a re-export from `@locateflow/shared` and update imports.

## 5. Dead/Stale Code Inventory (no deletions performed)

- **`packages/db/prisma/seed.ts:104`** — calls `prisma.badge.upsert(...)`, but no `Badge` model exists in the current `schema.prisma` (only `BadgeAward`-style references would be live). This file is no longer wired into `pnpm db:seed` (the master script is `seed-master.ts`); leaving in place pending owner review.
- **`packages/db/prisma/_migrate-to-mysql.ts`** — one-off migration helper. Filename prefix indicates retirement candidate.
- **`packages/db/prisma/_migration-data.json`** — JSON dataset for the above migration helper. Same retirement signal.
- **`packages/db/prisma/legacy-sqlite-migrations/`** — single subdir `20260211195621_add_compound_indexes` from the SQLite era. The active migrations directory is `packages/db/prisma/migrations/`.
- **`packages/db/prisma/seed-providers*.ts`** — seven provider seed scripts (`seed-providers.ts`, `-all-states`, `-expanded`, `-government`, `-phase2`, plus the per-state variants). Only `seed-master.ts` is the canonical entrypoint per `package.json`. The non-master ones are still callable via dedicated `seed:*` scripts but several look like archaeological residue.
- **`apps/web/public/sw.js`** — service worker file present; not audited deeply this pass.
- **Stale validators:** none located on top of the duplicate-validators-file finding under G.
- **Stale admin permission resources:** none found after F's fix.

No deletions were performed. These are reported only.

## 6. Test Results

```
$ pnpm --filter @locateflow/db exec tsc --noEmit
(no output → pass)

$ pnpm --filter @locateflow/shared exec tsc --noEmit
(no output → pass)

$ pnpm --filter @locateflow/web exec tsc --noEmit
(no output → pass)

$ pnpm --filter @locateflow/admin exec tsc --noEmit
(no output → pass)

$ pnpm --filter @locateflow/mobile exec tsc --noEmit
(no output → pass)

$ pnpm --filter @locateflow/web test
Test Files  130 passed (130)
     Tests  798 passed (798)
  Duration  3.88s

$ pnpm --filter @locateflow/admin test
Test Files  38 passed (38)
     Tests  148 passed (148)
  Duration  1.38s
```

All five typechecks clean; full web + admin suites green (798 + 148 tests).

## 7. Safety Confirmation

- ✅ No provider seed data changed (`packages/db/prisma/seed-data/*` untouched).
- ✅ Controlled-provider-import files confirmed absent — verified at session start.
- ✅ No backup/DR changes — the dirty `apps/admin/src/app/api/backup/**` files in the tree at session start were left untouched.
- ✅ No mobile/theme/admin design changes. The two mobile edits are a single-line JSON-shape fix in `apps/mobile/app/moving/[id].tsx` (state-rules contract); no styling, layout, or navigation changes.
- ✅ No secrets printed.
- ✅ No destructive DB commands run (no `prisma migrate`, no `db:push`, no `prisma db execute`).
- ✅ No i18n/translation files modified.
- ✅ Aurora/theme/logo files untouched.

## 8. Commit Recommendation

**Safe to commit** the listed files (sections 2, "Modified" + "Added"), excluding the unrelated dirty `apps/admin/src/app/api/backup/**` and `apps/admin/src/lib/backup-*` files that pre-existed in the working tree.

Suggested staging (per audit rules — `git add` by name, no `git add .`):

```
git add packages/db/src/soft-delete.ts \
        packages/db/prisma/seed-admin.ts \
        packages/shared/src/validators.ts \
        apps/web/src/lib/validators.ts \
        apps/web/src/lib/user-auth.ts \
        apps/web/src/lib/onboarding-profile-payload.ts \
        apps/web/src/lib/onboarding-profile-payload.test.ts \
        apps/web/src/app/api/auth/me/route.ts \
        apps/web/src/app/api/auth/me/route.test.ts \
        apps/web/src/app/api/auth/impersonate-handoff/route.ts \
        apps/web/src/app/api/auth/impersonate-handoff/route.test.ts \
        apps/web/src/app/api/profile/route.ts \
        apps/web/src/app/api/profile/route.test.ts \
        apps/web/src/app/api/state-rules/route.test.ts \
        apps/web/src/app/\(app\)/addresses/addresses-client.tsx \
        apps/web/src/app/\(app\)/moving/\[id\]/page.tsx \
        apps/web/src/hooks/use-addresses.ts \
        apps/web/src/hooks/use-current-user.ts \
        apps/web/src/components/layout/app-shell.tsx \
        apps/web/src/components/layout/impersonation-banner.tsx \
        apps/web/src/lib/impersonation-audit.ts \
        apps/web/src/lib/impersonation-audit.test.ts \
        apps/web/src/lib/soft-delete-models.test.ts \
        apps/web/src/lib/soft-delete-recommendations.test.ts \
        apps/web/src/lib/delete-content-type.test.ts \
        apps/admin/src/lib/admin-permissions-seed-parity.test.ts \
        apps/mobile/app/moving/\[id\].tsx \
        docs/audits/system/system_correctness_fix_report.md
```

**Awaiting your review before commit.** Per the audit instructions, no commit will be created until you say so.
