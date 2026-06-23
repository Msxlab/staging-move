# Flow Audit: Address Change / Relocation

Area slug: `address-change-relocation`
Scope: Add address -> validate -> set up move -> generate move tasks -> provider transition.
Method: read-only source review. Evidence cited to `path:line`. No source modified.

---

## 1. Flow Summary & Actors

**Actors**
- Authenticated end user (solo / legacy, no workspace).
- Workspace members (OWNER / ADMIN / MEMBER / VIEW_ONLY / CHILD / SUSPENDED) in the multi-tenant workspace model.
- Background connector worker (provider transition / address-change dispatch to partners).
- External services: Google Places (autocomplete), US Census geocoder (coordinate fallback), USPS Addresses 3.0 (standardization), FCC/OpenEI (serviceability), partner connectors (address-change push).

**End-to-end path**
1. **Add address** — UI `apps/web/src/app/(app)/addresses/new/page.tsx` → `POST /api/addresses` (`apps/web/src/app/api/addresses/route.ts`). Optional USPS standardization via `POST /api/addresses/validate`.
2. **Validate** — `apps/web/src/lib/usps-address-validation.ts` (USPS, fail-open) + server geocode fallback `apps/web/src/lib/census-geocoder.ts`.
3. **Set up move** — UI `apps/web/src/app/(app)/moving/new/page.tsx` → `POST /api/moving` (`apps/web/src/app/api/moving/route.ts`). Creates `MovingPlan` (+ optional inline destination `Address`).
4. **Generate move tasks** — UI `moving/plan/[id]/moving-plan-detail-client.tsx` → `POST /api/move-tasks` → `syncSuggestedMoveTasks` (`apps/web/src/lib/move-task-generation.ts`), with provider matching (`provider-matching.ts`) + serviceability (`provider-serviceability.ts`).
5. **Provider transition** — task COMPLETE → `completeMoveTaskWithLocalEffect` (`apps/web/src/lib/move-task-local-effects.ts`) mutates `Service` rows locally; primary-address edits optionally enqueue a partner `AddressChangeEvent` (`apps/web/src/lib/connector-runtime.ts`).

---

## 2. Step-by-step trace

### Step 1 — Add address (POST /api/addresses)
- **Trigger:** form submit in `addresses/new/page.tsx:110` (`handleSubmit`). First calls `POST /api/addresses/validate` (USPS), shows a correction card if `CORRECTED`, then `doSave` → `POST /api/addresses`.
- **State change:** local React `form` state; on success `router.push("/addresses")`.
- **API:** `POST /api/addresses` (`route.ts:68`).
- **Authz:** `requireAppMutationUser()` (verified user + legal acceptance), then `resolveWorkspaceDataScope` + `assertWorkspaceAction(scope, "address.create")`.
- **Rate limit:** `addr:create` 20/min, keyed by user (`route.ts:75`).
- **Entitlement:** `canCreateAddress` (plan cap / setup grace).
- **Validation:** `addressSchema.parse` (strict, `validators.ts:36`).
- **Side effects:** geocode fallback (`geocodeFallbackForPersist`); encrypt `formattedAddress`; transactional demote-other-primaries + create.
- **DB:** `Address` create within `$transaction` (`route.ts:106`).
- **Cache invalidation:** none (Next data is `force-dynamic` / client fetch).
- **Logging/analytics:** none on create (note: UPDATE/DELETE write `AuditLog`, but CREATE does not — see finding 09).

### Step 2 — Validate (POST /api/addresses/validate)
- **Authz:** `requireDbUserId()`; on any failure returns `ADDRESS_VALIDATION_UNAVAILABLE` (always 200).
- **Entitlement:** `requestHasPlanFeature(..., "addressValidation")` (Tier 2 / paid).
- **Behavior:** fail-open. Never blocks save. USPS creds resolved from runtime config with an https + `apis.usps.com` host allow-list (`usps-address-validation.ts:52`).

### Step 3 — Set up move (POST /api/moving)
- **Trigger:** `moving/new/page.tsx:175` `handleSubmit`.
- **Authz:** `requireAppMutationUser()` + `assertWorkspaceAction("address.create")`.
- **Rate limit:** dual — IP key `moving:create` (no userId) + per-user `moving:create:user:${userId}`, both 10/min (`route.ts:78`).
- **Entitlement:** `canCreateMovingPlan` (premium only), concurrent-plan cap (Pro=3, others=1; CONSUMER_FREE=25), `canCreateMovingDestinationAddress` when inline destination.
- **Validation:** `movingPlanSchema.parse`; same-address guard; state validation (`validateMovingAddressStates`).
- **DB:** optional inline `Address` create + `MovingPlan` create in one `$transaction` (`route.ts:210`).
- **Side effect:** `syncMoveTasksForPlans` (only auto-run for workspace plans; solo path also runs it — see `route.ts:251`).

### Step 4 — Generate move tasks (POST /api/move-tasks)
- **Authz:** `requireDbUserId()` + `assertWorkspaceAction("address.edit")`; plan re-fetched scoped; second `assertWorkspaceAction` with `resourceUserId: plan.userId`.
- **Rate limit:** `move-task:generate` 20/min per user.
- **Entitlement:** `canGenerateMoveTasks` (paid).
- **Core:** `syncSuggestedMoveTasks(plan.userId, planId)` → `buildMoveTransitionContext` classifies each origin service transition, builds destination provider candidates (popularity-ordered, capped 1000), enriches FCC/electric serviceability, persists CLASSIFIER tasks + the personalized CHECKLIST tasks (idempotent by `userId_idempotencyKey`).
- **Logging:** `AuditLog` TASK_GENERATED + `UserEvent` MOVE_TASK_GENERATED.

### Step 5 — Provider transition (PATCH /api/move-tasks COMPLETE; PATCH /api/addresses primary change)
- Task COMPLETE → `completeMoveTaskWithLocalEffect`: STOP/CANCEL deactivates the origin `Service`; TRANSFER clones to destination + deactivates origin; START/SHOP/FIND creates a destination `Service`. All local; "no external provider update" copy enforced.
- Primary address PATCH → best-effort `enqueueAddressChange` to partner connectors, gated on `isApiConnectorsEnabled()` + annual-Pro entitlement (`addresses/[id]/route.ts:167`).

---

## 3. Happy-path correctness

The happy path is coherent and notably defensive:
- Create/update/delete of addresses and moving plans are transactional, preventing "zero primary address" and orphaned services/budgets (`addresses/route.ts:106`, `addresses/[id]/route.ts:142`, `addresses/[id]/route.ts:245`).
- Move-task generation is idempotent via stable idempotency keys, never clobbers COMPLETED/DISMISSED tasks, and persists the legally-required checklist even when the user tracks zero services (`move-task-generation.ts:504`, `:614`).
- Moving plan status is a real state machine with terminal states (`moving/[id]/route.ts:27`); CANCELED retires suggested tasks, COMPLETED leaves them as history (`moving/[id]/route.ts:116`).
- Provider transition is explicitly local-only with consistent user-facing trust copy.

---

## 4. Edge cases & reverse-logic

| Concern | Result |
|---|---|
| Auth/role | Writes require verified user + legal acceptance; workspace actions gated by `can()`. Reads require only a valid session (no email-verification gate) — acceptable for read. |
| Empty/invalid input | Zod strict schemas; safe USPS fallback; client pre-validates moving fields. |
| Network failure (USPS/Census) | Fail-open by design; never blocks save. Good. |
| Double-submit / idempotency | Address create has no idempotency key — rapid double-submit creates duplicate addresses (finding 06). Move-task generation find-then-create races on the unique key under concurrent requests → 500 (finding 02). |
| Token/session expiry | 401 surfaced; client redirects. Plan detail page renders client even when session null (client recovers via 401). Minor. |
| Partial failure | Move-task sync failures are swallowed per-plan and reported in `failedPlanIds`; address update still succeeds (good). |
| Race conditions | Primary-promotion-on-delete resolved pre-transaction with a documented single-actor assumption; cross-member concurrency in a shared workspace is a theoretical gap (finding 08). |
| Stale data | Moving "new" page caches `/api/addresses` list in state; a destination address deleted elsewhere is validated server-side at create. OK. |
| Direct deep-link entry | `/moving/plan/[id]` and `/addresses/[id]` are client pages that fetch scoped APIs; IDOR blocked server-side (404 on out-of-scope). OK. |

**Reverse-logic findings**
- `GET /api/moving/migration` and `buildMoveTransitionContext` scope by `plan.userId === userId` only, ignoring workspace membership — a non-owner workspace member cannot see migration analysis or generate tasks for a plan owned by another member, even though they can view the plan and its tasks (findings 01, 03).

---

## 5. Security review (per step)

- **Authz at each step:** present. Writes go through `requireAppMutationUser` (verified + legal). Workspace scoping via `assertWorkspaceAction` / `assertScopedRecordAction`.
- **IDOR / workspace scoping:** address/plan/task reads & writes are scoped; out-of-scope returns 404. `completeMoveTaskWithLocalEffect` re-checks service/destination ownership (`move-task-local-effects.ts:80`). One inconsistency: migration + task-generation context use raw `plan.userId` equality instead of workspace scope (functional under-permission, not an over-permission leak — findings 01/03).
- **Validation:** strict Zod; USPS host allow-list; geocoder coordinate range checks.
- **Rate limiting:** present on all mutating endpoints. `POST /api/moving` IP key omits userId (`route.ts:78`) but a per-user key runs alongside it, so per-user abuse is still bounded (finding 07, Low).
- **Secrets/PII:** USPS secret confined to server lib; `formattedAddress` encrypted at rest; geocoder logs status only, never the address. Good.

---

## 6. Reliability

- **Retry:** connector dispatch has backoff/breaker. Move-task sync has no retry but degrades gracefully (`failedPlanIds`).
- **Transaction consistency:** address create/update/delete and moving create are transactional. `syncSuggestedMoveTasks` is **not** transactional and does per-row find-then-create with no `P2002` handling — concurrent generation throws and returns 500 (finding 02).
- **Partial-failure recovery:** address update returns `moveTaskSync` summary; auto-enqueue is best-effort and never fails the update.
- **Loading/empty/error UX:** plan detail and address pages have spinners, empty states, undo toasts. Good.

---

## 7. Cross-module impact

- **Services:** transition completion creates/deactivates `Service` rows; address delete cascades soft-delete to services + budgets.
- **Budget:** address delete soft-deletes budgets in the same tx.
- **Notifications / crons:** persisted checklist + classifier tasks feed move-reminder crons (`/api/cron/move-reminders`, `task-reminders`, `move-week-alerts`).
- **Connectors / partners:** primary-address change enqueues `AddressChangeEvent` → `ConnectorDispatch`.
- **Analytics:** `UserEvent` for task lifecycle; address CREATE is not audited (finding 09).
- **Coverage features:** geocode fallback fills coordinates so FCC/flood/school/weather work for typed addresses.

---

## 8. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| address-change-relocation-01 | Medium | Reverse Logic | Migration analysis scoped by `plan.userId === userId`, ignoring workspace membership | Non-owner members get 404 on `/api/moving/migration` for shared plans they can otherwise view | Scope by workspace like the rest of the flow | `api/moving/migration/route.ts:66`, `api/moving/migration/route.ts:81` |
| address-change-relocation-02 | Medium | Reliability | `syncSuggestedMoveTasks` find-then-create is non-transactional with no P2002 handling; unique key `(userId, idempotencyKey)` | Concurrent "Generate checklist" (double-click) → unique-constraint violation surfaces as 500 | Wrap in tx or use upsert / catch P2002 and re-read | `lib/move-task-generation.ts:551`, `lib/move-task-generation.ts:619`, schema `MoveTask:1008` |
| address-change-relocation-03 | Medium | Reverse Logic | `buildMoveTransitionContext` throws unless `plan.userId === userId`; task generation passes `plan.userId` so it works, but a member cannot generate for another member's shared plan | Inconsistent permission model vs. `/api/move-tasks` GET (which is workspace-scoped) | Resolve generation context by workspace scope | `lib/move-task-generation.ts:58`, `api/move-tasks/route.ts:180` |
| address-change-relocation-04 | Medium | Logic | Inline destination address created in `POST /api/moving` is never USPS-validated and bypasses the `addresses/new` correction step | Destination data quality lower than origin; downstream serviceability/coverage degraded | Run the same validation/geocode confidence on inline destination | `api/moving/route.ts:213`, `app/(app)/moving/new/page.tsx:216` |
| address-change-relocation-05 | Low | Logic | Inline destination address skips primary handling but counts against address cap via `canCreateMovingDestinationAddress` = `canCreateAddress` | A move with a new destination can be blocked by the address cap mid-flow with a generic limit error | Confirm intended; surface a move-specific limit message | `lib/plan-limits.ts:396`, `api/moving/route.ts:142` |
| address-change-relocation-06 | Low | Reliability | `POST /api/addresses` has no idempotency key; rapid double-submit creates duplicate addresses (rate limit is 20/min) | Duplicate addresses; user cleanup burden | Add client submit-lock (present via `loading`) + optional server dedupe on (user, street, zip) | `api/addresses/route.ts:68`, `app/(app)/addresses/new/page.tsx:82` |
| address-change-relocation-07 | Low | Security | `POST /api/moving` IP rate-limit key omits `userId` (`getRateLimitKey(request, "moving:create")`) | Shared NAT users share the IP bucket; mitigated by the parallel per-user key | Pass `{ userId }` to the IP key call or drop it | `api/moving/route.ts:78` |
| address-change-relocation-08 | Low | Race | Primary-promotion-on-address-delete resolves the next primary read-only before the tx; documented single-actor assumption | In a shared workspace, two members deleting addresses concurrently could momentarily leave 0 or 2 primaries | Resolve promotion inside the tx or add a guard | `api/addresses/[id]/route.ts:230` |
| address-change-relocation-09 | Low | Data | Address CREATE writes no `AuditLog` (UPDATE/DELETE do) | Audit trail gap for the creation of PII-bearing address records | Emit `createAuditLog` on create for parity | `api/addresses/route.ts:120` |
| address-change-relocation-10 | Info | Architecture | Mixed auth import sources (`@/lib/auth` vs `@/lib/user-auth`) for `requireDbUserId` across flow routes | Cosmetic; both re-export the same symbol | Standardize on one import path | `api/addresses/route.ts:3`, `api/addresses/validate/route.ts:3` |

---

## 9. Flow TODO

- [ ] Decide intended workspace-permission model for migration + task generation; replace `plan.userId === userId` with workspace scope (01, 03).
- [ ] Make `syncSuggestedMoveTasks` concurrency-safe (upsert / P2002 catch) (02).
- [ ] Extend USPS validation + geocode confidence to inline move destinations (04).
- [ ] Confirm the address-cap interaction with new move destinations and improve copy (05).
- [ ] Add server-side dedupe / idempotency for address create (06).
- [ ] Scope the `moving:create` IP rate-limit key to user, or remove it (07).
- [ ] Audit-log address creation for parity (09).
