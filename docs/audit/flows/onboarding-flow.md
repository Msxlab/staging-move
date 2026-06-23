# Flow Audit: Onboarding

Area slug: `onboarding-flow`
Scope: First-run onboarding -> profile capture -> legal consent -> address -> services -> moving plan / teaser -> progress persistence -> dashboard entry. Plus the AI briefing surface used by the dashboard.

Evidence is source-only. File paths are relative to repo root (`staging-move/`).

---

## 1. Flow Summary & actors

Actors:
- Authenticated end user (web) who has signed up but not finished onboarding.
- Workspace member (CHILD/ADULT/OWNER) — onboarding data is workspace-scoped on some reads.
- System side effects: `UserEvent` funnel/progress rows, `DataConsent`, `Profile`, `Address`, `Service`, `MovingPlan`, Anthropic API (briefing), analytics (`trackEvent`).

Entry / key paths:
- Page shell: `apps/web/src/app/onboarding/page.tsx` (server) -> `onboarding-client.tsx` (client wizard, ~2344 lines).
- Gate: `apps/web/src/app/onboarding/layout.tsx` -> `resolveOnboardingGateRedirect` + `getPostAuthUserState` (`apps/web/src/lib/post-auth-redirect.ts`).
- Progress model: `apps/web/src/lib/onboarding-progress.ts` (`getOnboardingProgress`).
- APIs: `POST /api/onboarding/progress`, `POST /api/onboarding/briefing`, `GET/POST /api/profile`, `POST /api/legal/acceptance`, `POST /api/consent`, `POST /api/addresses`, `POST /api/services`, `POST /api/moving`, `GET /api/providers/recommendations`, `GET /api/state-rules`.
- Briefing lib: `apps/web/src/lib/onboarding-briefing.ts`.
- Profile payload: `apps/web/src/lib/onboarding-profile-payload.ts`.

The wizard is 4 steps: Profile(0) -> Address(1) -> Services(2) -> Moving(3). Billing is intentionally excluded (owner decision; see `aurora-aside.tsx:122`). Step progress is **server-derived** from `UserEvent` rows + record counts, re-computed on every `/api/profile` GET, so a refresh resumes the correct step.

---

## 2. Step-by-step trace

### Mount / hydrate
- `onboarding-client.tsx:191-311` `loadOnboardingState()` calls `GET /api/profile`.
  - If `data.onboardingCompleted === true` -> clears local draft, `router.replace('/dashboard')`.
  - Computes `isPremium` from `data.entitlement` / `data.subscription`.
  - Reads `data.legalConsents` -> `setLegalAcceptedOnServer(hasRequiredLegalConsents(...))`.
  - `?step=legal` requested + already accepted -> `router.replace('/onboarding')`.
  - Sets `step = clamp(data.onboardingStepIndex, 0, 3)`; prefills profile; if `nextStep >= 1` also `GET /api/addresses` and prefills primary address.
- Funnel telemetry: `useEffect` fires `STARTED` once + `STEP_VIEWED_<STEP>` per step change via `POST /api/onboarding/progress` (`onboarding-client.tsx:173-186`). Best-effort, errors swallowed.
- Step-3 draft (move intent + typed dest/date) is mirrored to `localStorage["locateflow.onboarding.draft"]` (`onboarding-client.tsx:388-433`).

### Step 0 — Profile (+ inline legal + sensitive consent)
- Trigger: "Continue" -> `next()` (`onboarding-client.tsx:953`).
- `next()` step 0: if `!legalAcceptedOnServer` -> `acceptLegalInline()` -> `POST /api/legal/acceptance` (records `LEGAL_CONSENT` UserEvent via `recordLegalAcceptance`). Then `saveProfile()`.
- `saveProfile()` (`:557`): if disability/immigration selected -> `POST /api/consent` `{grants:[{category:'SENSITIVE',granted:true}]}` FIRST, else `/api/profile` rejects with `SENSITIVE_CONSENT_REQUIRED`. Then `POST /api/profile` with `buildOnboardingProfilePayload(profile)`.
- DB: `/api/profile` POST upserts `Profile`, updates `User.firstName/lastName`. Server re-checks legal (`hasRequiredLegalConsents`) and SENSITIVE consent (`api/profile/route.ts:201-233`).
- Side effects: `DataConsent` row(s), `Profile` row, `User` update, toast.

### Step 1 — Address
- Trigger: "Continue" -> `saveAddress()` (`:667`). Client validation: required fields, 2-letter state, ZIP regex, `detectStateZipMismatch`.
- API: `POST /api/addresses` (or `PATCH /api/addresses/{id}` if `createdAddressId`), body `{...address, isPrimary:true}`. Stores `createdAddressId`.

### Step 2 — Services
- On entry: `fetchProviders()` -> `GET /api/providers/recommendations?addressId&state&zip&lat&lng` -> `setProviders`, `setMissingCritical(data.stats.missingCritical)`.
- "Compiling your starter plan" ritual is decorative (`:511-534`), skipped under reduced-motion/empty.
- "Continue": `next()` step 2 -> `saveServices()` then, if 0 selected, `recordOnboardingProgress('SERVICES_SKIPPED')`.
- `saveServices()` (`:707`): loops `POST /api/services` per selected provider with optional billing. On `SERVICE_LIMIT_REACHED`/`SUBSCRIPTION_REQUIRED`/`TRIAL_EXPIRED` -> sets `serviceLimit` upsell + throws.
- "Skip" button (footer) also calls `next()`.

### Step 3 — Moving
- `wantsToMove === false` -> "Go to Dashboard" -> `finishOnboarding()` -> `saveMovingPlan()` returns null -> `recordOnboardingProgress('MOVING_SKIPPED')` + `recordOnboardingProgress('COMPLETED')` -> `ensureOnboardingCompleted()` -> `router.push('/dashboard')`.
- `wantsToMove === true`:
  - FREE user: `finishOnboarding()` -> `buildMoveTeaser('free')` (no `/api/moving` POST; writes free-move preview context; `trackEvent`). Teaser screen -> `finishFromTeaser('upgrade'|'dashboard')` -> `MOVING_SKIPPED` + `COMPLETED` + `ensureOnboardingCompleted()`.
  - Teaser variant (flag) or premium-with-teaser -> `buildMoveTeaser`; paid teaser "Continue to your plan" -> `continueFromPaidTeaser()` -> `saveMovingPlan()` -> `completeWithMovingPlan(planId)`.
  - Premium, no teaser: `saveMovingPlan()` -> `POST /api/moving` -> `completeWithMovingPlan(planId)` -> `COMPLETED` -> push `/moving/plan/{planId}`.

### Progress persistence API
- `POST /api/onboarding/progress` (`api/onboarding/progress/route.ts`): auth via `requireDbUserId`; rate-limit 20/60s; zod `event` enum `[SERVICES_SKIPPED, MOVING_SKIPPED, COMPLETED, STARTED, STEP_VIEWED]`; dedups via `userEvent.findFirst` then `create`. No record-state validation (see findings).

### Gate / dashboard entry
- `onboarding/layout.tsx` -> `resolveOnboardingGateRedirect(getPostAuthUserState(userId))`: redirects to `/dashboard` if `onboardingCompleted`, else renders wizard.
- `(app)/layout.tsx` -> `resolvePostAuthRedirect(getPostAuthUserState(userId), currentPath)`: redirects unfinished users to `/onboarding` (or `/onboarding?step=legal`).
- `getOnboardingProgress` (`onboarding-progress.ts:39`) ordering: profile+legal -> **completedEvent short-circuit (returns complete)** -> addressCount -> serviceCount/skip -> movingPlanCount/skip.

---

## 3. Happy-path correctness

The happy path is coherent and well-instrumented:
- Step resume is server-derived and clamped; a refresh lands on the right step with prefilled fields (`hydrated` gate prevents a flash of Step 0).
- Legal + SENSITIVE consent are enforced server-side in `/api/profile` POST, and the client orders the consent writes before the profile write so the user is never wedged.
- The briefing route degrades gracefully (no key -> `{configured:false}`; LLM error/timeout -> deterministic fallback; budget/cap -> cached or rule-based; never 500), and is correctly workspace-scoped with `childSelfOnly`.
- PII contract for the LLM is enforced by construction in `buildBriefingSignals` (coarse booleans/counts + 2-letter state only).

---

## 4. Edge cases & reverse-logic

- **COMPLETED short-circuits address/service/moving requirement (reverse logic).** `getOnboardingProgress` returns `{completed:true}` as soon as `completedEvent` is present (`onboarding-progress.ts:44-46`), *before* the `addressCount<=0` check at `:48`. `POST /api/onboarding/progress {event:"COMPLETED"}` writes that event with **no server-side validation** that an address/profile actually exists (`api/onboarding/progress/route.ts:62-76`). An authenticated user (or a buggy/duplicated client call) who has only profile+legal can mark themselves "onboarded" and reach the dashboard with **zero addresses** — an invariant the rest of the app (briefing, recommendations, dashboard widgets) may assume. `ensureOnboardingCompleted()` cannot catch this because it re-reads the same flag the COMPLETED event just set (circular). See onboarding-flow-01.
- **Scope divergence between the gate and the wizard resume (reverse logic / data).** The page gate uses `getPostAuthUserState` which counts `address/service/movingPlan` strictly by `userId` (`post-auth-redirect.ts:109-116`), but `/api/profile` GET — which the wizard reads for `onboardingStepIndex` — counts using **workspace scope** (`api/profile/route.ts:73-86`). For a workspace member/CHILD, the address that satisfies the gate (workspace-scoped) may not be counted by the gate's userId-only query (or vice-versa), so the gate and the in-wizard step can disagree, producing redirect loops or a wrong resume step. See onboarding-flow-02.
- **`isMilitary` silently dropped on resume.** `loadOnboardingState` hardcodes `isMilitary: false` when prefilling (`onboarding-client.tsx:268`), and the Move-Type buttons also force `isMilitary:false` (`:1658`). A returning user who previously stored `isMilitary=true` loses it in the UI; the next profile save (`buildOnboardingProfilePayload` -> `isMilitary: profile.isMilitary ?? false`) then **overwrites the stored value to false**, and because `isMilitary` is a SENSITIVE field, this is a silent data regression. See onboarding-flow-03.
- **Partial failure in `saveServices` is not atomic.** The loop `POST`s one service at a time (`:717-763`); if provider #3 hits a plan limit it throws after #1-#2 already persisted, with no rollback. The step does not advance, and a retry re-POSTs #1-#2 (relies on `service-duplicate-guard` to avoid dupes — not verified here). See onboarding-flow-06.
- **No idempotency / unique constraint on progress events.** `UserEvent` has no `@@unique([userId,event])` (`schema.prisma:1190-1209`); the progress route's `findFirst`+`create` is TOCTOU. Concurrent double-submits (e.g. the funnel `STARTED` + a fast re-render) can create duplicate rows. Functionally harmless (gating uses set membership) but pollutes funnel analytics. See onboarding-flow-07.
- **Skip events are purgeable; COMPLETED is retained.** `RETAINED_USER_EVENT_NAMES` keeps only `LEGAL_CONSENT` + `ONBOARDING_COMPLETED` (`user-event-retention.ts:12,70-74`). `SERVICES_SKIPPED`/`MOVING_SKIPPED` can be purged after the retention window. This only affects a user who is *still mid-onboarding* after the retention period (rare), so risk is low, but a long-dormant un-finished user could be bounced back to the services/moving step. See onboarding-flow-08.
- **Direct deep-link entry** to `/onboarding` is gated (`layout.tsx`), and `/dashboard` is gated by `(app)/layout.tsx`; both rely on the same `getPostAuthUserState`, so the COMPLETED short-circuit (onboarding-flow-01) is the only way past the address requirement.
- **Token expiry / network failure**: client fetches swallow errors and keep the step visible; the `hydrated` finally always runs. Acceptable.
- **Double-submit on CTAs**: guarded by the `saving` flag on each `ObCta`.

---

## 5. Security review of the flow

- **AuthZ at each step**: every API (`/api/onboarding/progress`, `/api/onboarding/briefing`, `/api/profile`, `/api/legal/acceptance`, `/api/consent`) calls `requireDbUserId()` and returns 401/403 on failure. Middleware (`middleware.ts`) also gates all non-public `/api/*` with JWT verification, CSRF (same-origin/Origin/Referer), body-size, and rate limits. `/onboarding` and `/api/onboarding/*` are NOT in any public allow-list -> authenticated-only. Good.
- **IDOR / workspace scoping**: the briefing route consistently uses `scopedRecordWhere(scope, ..., {childSelfOnly:true})` and `activeTrackedServiceWhereForScope`, and `getRequestEntitlement` validates the workspace belongs to the user (`workspace-data-scope.ts:48`). No raw client-supplied IDs are trusted in the onboarding APIs. The scope **divergence** in onboarding-flow-02 is a correctness bug, not a cross-tenant leak.
- **Validation**: zod on progress + legal + consent; `profileSchema` on profile. Address/move forms validated client-side (`detectStateZipMismatch`, ZIP regex) AND re-validated server-side by the respective routes.
- **Rate limiting**: progress 20/60s, briefing 10/60s + a hard 3/UTC-day Anthropic generation cap via the shared limiter + a global AI budget circuit-breaker. Solid against cost abuse.
- **Secrets / PII**: `ANTHROPIC_API_KEY` read via `getRuntimeConfigValue`, never returned. Subscription tokens stripped before client (`sanitizeSubscriptionForClient`). The LLM prompt is coarse/non-PII by construction. SENSITIVE profile fields are consent-gated and wiped on consent withdrawal (`api/consent/route.ts:121-137`). No exploitable secret/PII exposure found in this flow.
- The COMPLETED-without-address issue (onboarding-flow-01) is an **integrity/abuse** concern (a user corrupts their own onboarding state), not a cross-user vulnerability.

---

## 6. Reliability

- **Retry**: client fetches are best-effort; the wizard never wedges (the `hydrated` finally guarantees render). `recordOnboardingProgress` surfaces errors and blocks advancement on failure (good — except COMPLETED can be written before the records it implies, onboarding-flow-01).
- **Transaction consistency**: profile + consent are separate POSTs (not atomic) but ordered safely. `saveServices` is non-atomic on partial failure (onboarding-flow-06).
- **Loading/empty/error UX**: skeleton while hydrating; provider empty-state copy; error banner with `role="alert"`; toasts. Good coverage.
- **Briefing reliability**: never throws to the card; cache + cap + global budget all degrade to rule-based. Strong.

---

## 7. Cross-module impact

- **Dashboard**: consumes `/api/onboarding/briefing`; a dashboard reachable with no address (onboarding-flow-01) will render the briefing/recommendations against an empty primary address (best-effort `.catch(()=>null)` handles it, but UX is degraded).
- **Mobile parity**: `apps/mobile/app/onboarding.tsx` exists and shares `@/lib/legal` + the same progress events; the COMPLETED short-circuit and scope divergence are server-side, so mobile is exposed to the same `getOnboardingProgress` semantics (cross-check recommended).
- **Billing/entitlement**: free vs paid drives the teaser vs create-plan branch; correctly resolved from `entitlement`.
- **Analytics**: funnel events (`STARTED`/`STEP_VIEWED_*`) + `trackEvent` calls; duplicate-row risk (onboarding-flow-07) slightly inflates funnel counts.
- **Retention/GDPR**: skip-event purge (onboarding-flow-08).

---

## 8. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| onboarding-flow-01 | Medium | Reverse Logic | `COMPLETED` event short-circuits the address/service/moving requirement; the progress API writes it with no state validation | User (or buggy client) can reach dashboard with zero addresses; breaks an invariant downstream code assumes | Validate prerequisites server-side before accepting `COMPLETED` (require profile+legal+>=1 address), or move the `completedEvent` short-circuit below the address check | `apps/web/src/lib/onboarding-progress.ts:44-48`, `apps/web/src/app/api/onboarding/progress/route.ts:62-76` |
| onboarding-flow-02 | Medium | Data | Gate counts records by `userId` only while `/api/profile` counts by workspace scope; the two can disagree for workspace members | Redirect loops / wrong resume step for CHILD/member users | Use one scoping helper for both `getPostAuthUserState` and `/api/profile` onboarding counts | `apps/web/src/lib/post-auth-redirect.ts:109-116`, `apps/web/src/app/api/profile/route.ts:73-86` |
| onboarding-flow-03 | Medium | Logic | `isMilitary` hardcoded to `false` on resume and on move-type select; the next profile save overwrites the stored SENSITIVE value to false | Silent loss of a SENSITIVE profile flag for returning military users | Prefill `isMilitary` from `data.profile.isMilitary`; don't force-clear it on move-type change | `apps/web/src/app/onboarding/onboarding-client.tsx:268,1658`, `apps/web/src/lib/onboarding-profile-payload.ts:38` |
| onboarding-flow-06 | Low | Reliability | `saveServices` POSTs services one-by-one with no rollback on mid-loop failure | Partial writes on plan-limit hit; retry re-POSTs already-saved providers | Pre-check the plan limit, or make the batch idempotent/transactional; rely on (and verify) `service-duplicate-guard` | `apps/web/src/app/onboarding/onboarding-client.tsx:707-774` |
| onboarding-flow-07 | Low | Data | No `@@unique([userId,event])`; progress dedup is TOCTOU `findFirst`+`create` | Duplicate funnel/progress rows under concurrent submits | Add a unique constraint and use upsert/createMany-skipDuplicates | `packages/db/prisma/schema.prisma:1190-1209`, `apps/web/src/app/api/onboarding/progress/route.ts:62-76` |
| onboarding-flow-08 | Low | Reliability | `SERVICES_SKIPPED`/`MOVING_SKIPPED` are not in `RETAINED_USER_EVENT_NAMES` and can be purged | A long-dormant unfinished user could be bounced back to a skipped step | Retain skip events too, or treat their absence as not-skipped only for active onboarding | `apps/web/src/lib/user-event-retention.ts:12,70-74` |
| onboarding-flow-09 | Info | Architecture | Onboarding "completed" is derived from event rows rather than a durable `User.onboardingCompletedAt` column | State is reconstructed on every request from multiple tables; fragile to event semantics changes | Consider a denormalized completion timestamp as the source of truth | `apps/web/src/lib/onboarding-progress.ts`, `apps/web/src/lib/post-auth-redirect.ts` |

---

## 9. Flow TODO

1. Decide the contract: is "onboarded" allowed without an address? If not, fix onboarding-flow-01 server-side (highest priority — it is the one place the address invariant can be skipped).
2. Unify onboarding record-count scoping (onboarding-flow-02) so the gate and the wizard agree for workspace/CHILD users.
3. Stop clobbering `isMilitary` on resume/move-type change (onboarding-flow-03) — it is SENSITIVE data.
4. Harden `saveServices` partial-failure + add the `UserEvent` unique constraint.
5. Cross-check mobile onboarding (`apps/mobile/app/onboarding.tsx`) against the same `getOnboardingProgress` semantics.
