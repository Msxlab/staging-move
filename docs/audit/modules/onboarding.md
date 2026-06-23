# Module Audit: Onboarding

> READ-ONLY audit. Evidence cited from source only. Paths are relative to repo root
> `apps/web/...` unless noted. Line numbers are approximate to the version read on 2026-06-22.

## 1. Module Summary

The onboarding module is a 4-step client wizard (Profile → Address → Services → Moving)
that funnels a newly authenticated user from sign-up to the dashboard. The state machine
is **server-derived**: the wizard reads `/api/profile` to compute `onboardingStepIndex` /
`onboardingCompleted`, and persists step decisions (services-skipped, moving-skipped,
completed) as idempotent `UserEvent` rows via `/api/onboarding/progress`. First-run gating
is enforced server-side in two layouts: `app/onboarding/layout.tsx` (bounce out if already
complete) and `app/(app)/layout.tsx` (bounce into `/onboarding` if not complete), both via
`lib/post-auth-redirect.ts`. A separate AI "move briefing" feature
(`lib/onboarding-briefing.ts` + `app/api/onboarding/briefing/route.ts`) generates a
PII-safe, entitlement-gated, daily-capped summary surfaced on the dashboard
(`components/dashboard/move-briefing-card.tsx`).

Core state-machine logic (`getOnboardingProgress`) is small, well-tested, and correctly
refuses to let a `COMPLETED` event bypass the profile + legal gate. The largest concrete
defect found is a **data-loss bug**: the web wizard never sets `Profile.isMilitary = true`
(the Military move-type button hardcodes `isMilitary: false`), so military status entered on
web is silently dropped. A secondary correctness gap is a **scope inconsistency** between
the gating helper (`getPostAuthUserState`, raw-userId counts) and the wizard's own data
source (`/api/profile`, workspace-scoped counts), which can desync the resume step for
workspace members. Several reverse-logic and reliability edges (partial multi-write
failures in services/moving, double-`COMPLETED` direct posts skipping the address step,
unbounded per-row service POST loop) are documented below.

## 2. Related Files

- `apps/web/src/lib/onboarding-progress.ts` — state machine + funnel event names.
- `apps/web/src/lib/onboarding-profile-payload.ts` — maps wizard state → `/api/profile` payload.
- `apps/web/src/lib/onboarding-briefing.ts` — AI briefing signals, prompt, LLM call, fallback, encoding.
- `apps/web/src/lib/post-auth-redirect.ts` — first-run gating (`resolvePostAuthRedirect`, `resolveOnboardingGateRedirect`, `getPostAuthUserState`).
- `apps/web/src/app/onboarding/page.tsx` — server entry; resolves the teaser feature flag.
- `apps/web/src/app/onboarding/layout.tsx` — onboarding-access gate.
- `apps/web/src/app/onboarding/onboarding-client.tsx` — the 2,344-line wizard client (all steps, teaser, ritual).
- `apps/web/src/app/api/onboarding/progress/route.ts` — persists skip/complete/funnel events.
- `apps/web/src/app/api/onboarding/briefing/route.ts` — AI briefing endpoint (cache + cap + gate).
- `apps/web/src/app/api/profile/route.ts` — GET serves onboarding progress; POST saves profile + legal + sensitive gate.
- `apps/web/src/app/(app)/layout.tsx` — app-shell gate that forces incomplete users into onboarding.
- `apps/web/src/components/dashboard/move-briefing-card.tsx` — consumer of the briefing API.
- `apps/web/src/components/onboarding/ob-cta.tsx` — unified CTA (loading/disabled/locked states).
- `packages/shared/src/legal.ts` — `hasRequiredLegalConsents`, `ONBOARDING_COMPLETED_EVENT`.
- `apps/web/src/lib/validators.ts` — `profileSchema` (server-side profile validation).

Tests: `onboarding-progress.test.ts`, `onboarding-profile-payload.test.ts`,
`onboarding-briefing.test.ts`, `api/onboarding/progress/route.test.ts`,
`api/onboarding/briefing/route.test.ts`, `post-auth-redirect.test.ts`,
`api/profile/route.test.ts`.

## 3. Related Routes / Screens

- `/onboarding` — the wizard (server `page.tsx` → client `onboarding-client.tsx`).
- `/onboarding?step=legal` — legal interstitial landing target for server redirects (OAuth callbacks, post-auth gate).
- `/dashboard` — completion destination; hosts the move-briefing card.
- `/moving/plan/[id]` — completion destination when a paid user creates a plan.
- `/settings/subscription?returnTo=%2Fdashboard` — teaser "upgrade" target.
- `/pricing` — Pro-showcase "See Pro" target.

## 4. Related APIs

- `POST /api/onboarding/progress` — auth-gated, rate-limited (20/min/user); idempotent `UserEvent` write for `SERVICES_SKIPPED`, `MOVING_SKIPPED`, `COMPLETED`, `STARTED`, `STEP_VIEWED`.
- `POST /api/onboarding/briefing` — auth-gated, rate-limited (10/min/user), config-gated (ANTHROPIC_API_KEY), entitlement-gated (Family/Pro or CONSUMER_FREE), per-user-per-UTC-day cache + 3/day generation cap.
- `GET /api/profile` — serves `onboardingCompleted`, `onboardingStep`, `onboardingStepIndex`, `legalConsents`, `entitlement`, `subscription`, `profile`.
- `POST /api/profile` — saves user name + profile; enforces legal-acceptance fallback and SENSITIVE DataConsent gate.
- Indirectly consumed by the wizard: `POST/PATCH /api/addresses[/:id]`, `GET /api/addresses`, `GET /api/providers/recommendations`, `POST /api/services`, `POST /api/moving`, `POST /api/legal/acceptance`, `POST /api/consent`, `GET /api/state-rules`.

## 5. Related Components

- `OnboardingClient` — the wizard.
- `AuroraAside` — ≥lg brand/progress rail (`./aurora-aside`).
- `ObCta` — unified CTA with loading/locked semantics.
- `ObCoach`, `ObProShowcase` — coach explainer + Pro showcase.
- `LegalConsentPanel` — inline legal consent on Step 0 and the `?step=legal` gate.
- `AddressAutocompleteInput` — address/destination autocomplete.
- `ServiceLimitUpsell` — service-cap upsell modal triggered from Step 2 saves.
- `CategoryIcon`, `RaccoonReading`, `GlassCard`, `OnboardingProviderLogo` — presentational.
- `MoveBriefingCard` / `MoveBriefingTeaser` — dashboard consumers of the briefing API.

## 6. Related State / Hooks / Stores

- Local `useState`: `step`, `hydrated`, `saving`, `error`, `profile`, `address`, `createdAddressId`, `providers`, `selectedProviders` (Map), `billingData`, `wantsToMove`, `movingForm`, `teaser`, `isPremium`, ritual state, `legalConsents`, `legalAcceptedOnServer`, `serviceLimit`, `missingCritical`.
- `useSearchParams` — reads `?step=legal`.
- `useRouter` — `replace`/`push`/`refresh` for navigation.
- `useCoachCollapsed` — localStorage-backed coach dismiss.
- localStorage: `locateflow.onboarding.draft` (Step-3 transient draft), `locateflow.moveBriefing.seenStage` (briefing per-stage dismissal), free-move-preview context (`lib/free-move-preview.ts`).
- In-process module state: `briefingCache` (LRU Map) inside the briefing route.

## 7. Related Database / Models

- `Profile` — upserted by `POST /api/profile` (firstName/lastName on `User`).
- `UserEvent` — stores `LEGAL_CONSENT_ACCEPTED`, `ONBOARDING_*` (skip/complete/started/step-viewed) rows; the onboarding state machine reads these.
- `Address`, `Service`, `MovingPlan` — counted to derive the resume step; created during steps 1–3.
- `DataConsent` — SENSITIVE category gate for disability/immigration/military fields.
- `Subscription` — entitlement resolution for `isPremium` / briefing gate.
- `SavedProvider` — counted in the briefing route as "owned" categories.

## 8. Impact Map

- **UI**: 4-step wizard, legal gate, teaser takeover, "compiling" ritual, Pro showcase, dashboard briefing card.
- **API**: `/api/onboarding/*`, `/api/profile`, and the address/service/moving/legal/consent/state-rules endpoints the wizard orchestrates.
- **DB**: Profile/Address/Service/MovingPlan/UserEvent/DataConsent writes.
- **Auth**: gating depends on JWT session (`requireDbUserId`) + email-verification gate + legal gate; first-run redirects in two layouts.
- **Admin**: none directly; admin can read UserEvent funnel telemetry.
- **Mobile**: shares the briefing API + `legal.ts`; `onboarding-profile-payload.ts` is intentionally mobile-parity (test asserts mobile fields preserved). Web/mobile divergence on `isMilitary` (see onboarding-02).
- **Notifications**: none in onboarding itself.
- **Integrations**: Anthropic Messages API (briefing), address-autocomplete provider, state-rules.
- **Analytics**: `ONBOARDING_STARTED`, `ONBOARDING_STEP_VIEWED_*`, `onboarding_completed`, `moving_plan_started`, `move_teaser_*`, `AI_BRIEFING_*`, Phase-1 teaser events.
- **SEO**: `/onboarding` is `noindex` via middleware `pathShouldNoIndex`.
- **Tests**: solid unit coverage on the pure helpers and the two API routes; no integration/e2e for the wizard client itself.

## 9. Buttons / Actions / Functions

For each: name — where — expected — actual — loading? — disabled? — error? — success? — permission? — edge cases.

1. **Continue (Step 0 → save profile)** — footer `next()` → `acceptLegalInline()` + `saveProfile()`.
   - Expected: accept legal, then persist profile, advance.
   - Actual: matches. Legal accepted before profile POST (server requires it). Validates first/last name client-side; server `profileSchema` re-validates.
   - Loading: yes (`saving`, ObCta spinner). Disabled: yes — disabled on Step 0 until legal checkboxes satisfied (`!legalAcceptedOnServer && !hasRequiredLegalConsents(...)`), with a locked hint. Error: yes (banner + toast). Success: toast "Profile saved!". Permission: server `requireDbUserId`.
   - Edge cases: sensitive fields require a SENSITIVE consent POST first; **`isMilitary` is never sent true (onboarding-02)**. Name-only client validation; whitespace-only handled by `.trim()`.

2. **Continue (Step 1 → save address)** — `saveAddress()`.
   - Expected: validate + POST/PATCH address, set primary, advance.
   - Actual: matches. Client validates required fields, 2-letter state, ZIP regex, and state/ZIP mismatch (`detectStateZipMismatch`).
   - Loading/disabled/error/success: yes/yes/yes/yes. Permission: server-gated.
   - Edge cases: PATCH when `createdAddressId` already set (resume) — correct. `data.address.id` is read without guarding a malformed success body (minor).

3. **Continue / Skip (Step 2 → save services)** — `saveServices()` + `recordOnboardingProgress("SERVICES_SKIPPED")`.
   - Expected: POST each selected provider as a Service; if none selected, record skip and advance.
   - Actual: **loops one `POST /api/services` per selected provider sequentially**; partial failures are possible — successes persist while a later one throws (onboarding-05). Handles SERVICE_LIMIT/SUBSCRIPTION/TRIAL codes → `ServiceLimitUpsell`. Skip path records the event.
   - Loading/disabled/error/success: yes/yes/yes/yes (`{saved} services added!`). Permission: server-gated.
   - Edge cases: selecting many providers fans out N requests; no batching, no abort-on-first-limit before some succeed.

4. **Skip (Step 2 footer)** — `next()` with zero selected → records `SERVICES_SKIPPED`.
   - Actual: correct; if recording the skip fails, it surfaces an error and does NOT advance (good).

5. **Add all essentials** — `addAllEssentials()`.
   - Expected: additively select every unselected essential. Actual: matches; never deselects. Disabled when `unselectedEssentialCount === 0`. No async; no loading needed.

6. **Yes, plan my move / Not right now (Step 3)** — `setWantsToMove(true|false)`.
   - Actual: toggles the branch. No persistence yet. Correct.

7. **Preview my move plan / Create Plan & Go (Step 3)** — `finishOnboarding()`.
   - Expected: free user → `buildMoveTeaser("free")`; teaser variant → teaser; else `saveMovingPlan()` → complete.
   - Actual: matches. `saveMovingPlan` returns `false`/`null`/planId; `finishOnboarding` branches. Validates destination + date + state/ZIP mismatch. Loading label varies by plan/variant.
   - Edge cases: **multi-step completion (`recordOnboardingProgress("MOVING_SKIPPED")` then `"COMPLETED"` then `ensureOnboardingCompleted`) is non-transactional** — a failure between the two event writes leaves a half-recorded state (onboarding-06). Both are idempotent so retry is safe, but the user sees an error mid-completion.

8. **Continue to your plan (paid teaser)** — `continueFromPaidTeaser()` → `saveMovingPlan` + `completeWithMovingPlan`.
   - Actual: correct; guards `planId` is a string.

9. **Keep organizing for free / Continue with full access (free teaser)** — `finishFromTeaser("dashboard"|"upgrade")`.
   - Actual: records MOVING_SKIPPED + COMPLETED, verifies, navigates. Loading/error handled. No MovingPlan POST (avoids the free 403).

10. **Go to Dashboard (wantsToMove === false)** — `finishOnboarding()` → no plan → MOVING_SKIPPED + COMPLETED.
    - Actual: correct.

11. **Back / Cancel** — `prev()` / `setWantsToMove(null)`. Back disabled on Step 0 and while `saving`. Correct.

12. **Skip ritual** — `finishRitual()`; clears timers, reveals picker. Correct; decorative.

13. **Provider toggle / category expand / search / category filter** — local state only; correct.

14. **Briefing action rows (dashboard card)** — `actionHref(action)` Link. Maps `target`/`deeplink` to in-app routes; safe neutral fallback. No permission needed (read-only navigation).

## 10. UI/UX Audit

- **U-1 (Low, A11y/UX)**: `selectedProviders` chips and several toggle buttons in Step 2 are `<button>` without `type="button"` in a few spots (most do set it). Evidence: `onboarding-client.tsx` selected-chip button (~L1959) omits `type`. Inside a non-form context this is benign, but inconsistent. Recommendation: set `type="button"` uniformly. Priority: low.
- **U-2 (Low, UX)**: The "compiling your starter plan" ritual (`ritualActive`) adds up to ~350 + rows*380 + 1200 ms of forced animation before the picker is usable (`onboarding-client.tsx` ~L524-530). It is skippable and respects `prefers-reduced-motion`, but on a slow first load it delays the most important step. Recommendation: cap total ritual duration; keep the Skip affordance prominent. Priority: low.
- **U-3 (Info, UX)**: Step 0 hardcodes English copy ("Profile saved!", "First name and last name are required.") via `toast`/`setError` while the rest of the wizard uses `next-intl` (`t(...)`). Mixed localization. Evidence: `saveProfile`/`saveAddress` string literals. Recommendation: route through `useTranslations`. Priority: info.
- **U-4 (Info, Theme)**: Theming uses semantic tokens (`bg-foreground/5`, `text-tone-*`, `border-border`) throughout, so light/dark parity is structurally sound. The ritual progress ring uses `hsl(var(--primary))` / `hsl(var(--border))` — token-driven, dark-safe. No hardcoded hex found in the wizard. No theme defect identified.

## 11. Logic Audit

Expected flow: profile+legal (step 0) → address (step 1) → services or skip (step 2) →
moving or skip (step 3) → complete. `getOnboardingProgress` encodes exactly this and is
unit-tested (`onboarding-progress.test.ts`).

- **L-1 (Medium, Logic) — `isMilitary` is never persisted from web onboarding.** The wizard's
  `profile` state initializes `isMilitary: false` (`onboarding-client.tsx` L325), the resume
  loader hardcodes `isMilitary: false` (L268, discarding any previously saved value), and the
  Military move-type button sets `isMilitary: false` (L1658). There is **no UI control that
  ever sets `isMilitary: true`**. `buildOnboardingProfilePayload` faithfully forwards
  `profile.isMilitary` (`onboarding-profile-payload.ts` L38), so the persisted
  `Profile.isMilitary` is always `false` for web users — even when they pick "Military". The
  payload test (`onboarding-profile-payload.test.ts`) only proves the *builder* forwards a
  `true` it is given; it does not prove the wizard ever provides `true`. Impact: military
  movers lose military-specific personalization that keys off `Profile.isMilitary`; mobile
  parity is broken (mobile persists it). The briefing route partially compensates by deriving
  `isMilitary` from `moveType === "MILITARY"` (`onboarding-briefing.ts` L218-219), so the AI
  card is unaffected, but any other consumer of `Profile.isMilitary` sees stale `false`.
  See onboarding-02.

- **L-2 (Medium, Logic) — Gate counts use raw `userId`, wizard uses workspace scope.**
  `getPostAuthUserState` counts `address/service/movingPlan` with `{ userId, deletedAt: null }`
  (`post-auth-redirect.ts` L109-116), while `GET /api/profile` counts the SAME entities through
  `scopedRecordWhere(scope, ...)` / `activeTrackedServiceWhereForScope(...)`
  (`api/profile/route.ts` L73-92). For a workspace member (CHILD/non-owner) whose visible
  records differ from their raw-owned records, the app-shell gate
  (`(app)/layout.tsx` → `resolvePostAuthRedirect`) and the wizard's resume step
  (`onboarding-client.tsx` reads `data.onboardingStepIndex` from `/api/profile`) can disagree
  about whether onboarding is complete. Worst case: a user is bounced into `/onboarding` by the
  layout gate but `/api/profile` reports `onboardingCompleted: true`, causing
  `loadOnboardingState` to `router.replace("/dashboard")` (L199-209) — a redirect loop or
  flicker. Recommendation: make `getPostAuthUserState` workspace-scope-aware (or make both use
  the same helper). See onboarding-03.

- **L-3 (Low, Logic) — Direct `COMPLETED` POST skips the address requirement.**
  `getOnboardingProgress` checks `completedEvent` *before* `addressCount` (`onboarding-progress.ts`
  L44-49). An authenticated user can `POST /api/onboarding/progress {event:"COMPLETED"}`
  directly (the route accepts it for the caller's own account) once profile+legal exist, and the
  gate will then treat onboarding as complete even with zero addresses. This is self-service
  only (no cross-user impact — `requireDbUserId`), and the normal UI never sends COMPLETED before
  an address exists, so the blast radius is "a user shortcuts their own onboarding into a
  partly-empty dashboard." The code correctly *does* block COMPLETED from bypassing profile/legal
  (asserted by the test at `onboarding-progress.test.ts` L55-61). Recommendation: either require
  an address before honoring COMPLETED, or accept this as intended (address is creatable later).
  See onboarding-07.

- **L-4 (Low, Stale state) — Resume re-overwrites local edits.** `loadOnboardingState` runs once
  on mount and merges server data with `prev` using `??`/`||`, so most in-flight edits survive.
  But the address fetch (`nextStep >= 1`) overwrites `address` fields from the primary address
  unconditionally on mount; if the user navigates back to Step 1 after the load, their typed
  edits are intact (load only runs once). No race observed beyond the documented `cancelled`
  guard. Low risk.

- **L-5 (Info) — `wantsToMove` draft restore vs. server state.** The Step-3 draft
  (`locateflow.onboarding.draft`) is restored from localStorage independently of server state and
  cleared only on completion. On a shared device a previous user's draft is cleared on completion
  (`ensureOnboardingCompleted` → `clearOnboardingDraft`) and on revisit-when-completed (L203-207),
  which is a reasonable mitigation. No defect.

## 12. Reverse Logic Audit

- **Unauthorized user**: all onboarding APIs call `requireDbUserId` and 401/403; middleware also
  blocks unauthenticated page/API access. `/onboarding` page is not in `PUBLIC_PATHS`, so the
  layout gate runs. OK.
- **Empty data**: zero providers → empty-state card with "Continue without listed providers"
  (`onboarding-client.tsx` L2062-2077). Zero essentials in briefing → quiet "all handled" card
  (`briefing/route.ts` L322-342). OK.
- **API error**: profile/address/service/moving saves surface banner + toast and do not advance.
  `/api/profile` load failure in `loadOnboardingState` is swallowed (keeps current step) — the
  wizard still renders Step 0, which can MIS-resume a returning user to step 0 on a transient
  GET failure (onboarding-08, Low).
- **Slow network**: `saving` disables CTAs; ritual has a Skip; briefing LLM has a 12s abort
  (`onboarding-briefing.ts` L312/L329). OK.
- **Double-click**: CTAs disable on `saving`. However, the **multi-await completion chains**
  (`finishOnboarding`, `completeWithMovingPlan`) set `saving` inside `saveMovingPlan` only; the
  subsequent `recordOnboardingProgress`/`ensureOnboardingCompleted` awaits run while `saving`
  may already be reset in `saveMovingPlan`'s `finally` — a fast double tap could in principle
  re-enter. Idempotent events bound the damage (onboarding-06, Low).
- **Stale data**: `isPremium` is resolved once at load; a plan change mid-wizard isn't re-read,
  so a user who upgrades in another tab still takes the free teaser path. Low.
- **Direct route access**: `/onboarding` when complete → `loadOnboardingState` replaces to
  `/dashboard`; the layout gate (`resolveOnboardingGateRedirect`) also redirects complete users
  to `/dashboard`. OK.
- **Mobile viewport**: dedicated `lg:hidden` progress header + chip rail; grid collapses. OK.
- **Dark theme**: token-driven (see U-4). OK.
- **Role change**: a CHILD/member role change can desync gate vs. resume (L-2/onboarding-03).
- **Token expiry**: mid-wizard expiry → next API call 401 → toast error; page-level expiry →
  layout gate redirects to `/sign-in`. The wizard does not proactively detect 401 to redirect,
  so the user may see a generic save error before re-auth. Low.

## 13. Security Audit

The module is defensively built: every API call is `requireDbUserId`-gated, rate-limited,
zod-validated server-side, and CSRF-protected via the middleware origin/sec-fetch checks
(`middleware.ts` `applyCsrfCheck`). No findings rise above Low. Items below are framed
defensively.

- **S-1 (Low, Security — sensitive-data handling, [needs verification])**
  - Severity: Low. Affected area: `POST /api/profile` SENSITIVE gate + onboarding sensitive opt-in.
  - Evidence: `api/profile/route.ts` L220-233 blocks disability/immigration/military writes unless a current SENSITIVE `DataConsent` exists; the wizard records that consent before saving (`onboarding-client.tsx` L570-582). BUT because the web wizard never sends `isMilitary: true` (L-2), the `isMilitary` branch of the SENSITIVE gate is never exercised from web, and the opt-in checkbox only gates disability + immigration in the UI (military is treated as a non-sensitive move-type). If a future change starts sending `isMilitary: true` without also gating it behind the opt-in UI, the server gate is the only backstop.
  - Risk: inconsistency between UI consent surface and server gate could let military status be saved without the explicit sensitive opt-in being shown.
  - Defensive abuse scenario (high-level): a client that sets `isMilitary: true` without the SENSITIVE consent is correctly rejected server-side (good), but the mismatch invites future regressions.
  - Prevention: align the UI opt-in to cover `isMilitary`; keep the server gate.
  - Detection: assert in tests that any sensitive field requires consent.
  - Analysis (root cause): military is modeled both as a move-type (non-sensitive) and a sensitive Profile flag.
  - Recommendation: decide one model; if `Profile.isMilitary` is sensitive, gate it in the UI too.
  - Tests to add: profile POST rejects `isMilitary:true` without SENSITIVE consent (server already does — add the explicit test).

- **S-2 (Low, Security — PII to third party, verified safe-by-design)**
  - Evidence: `onboarding-briefing.ts` `buildBriefingSignals` (L197-231) emits only coarse booleans/counts + a 2-letter state; `buildLlmPrompt` never includes name/address/email/ZIP. The system prompt forbids PII (L257-270). The route gathers only profile booleans + coarse state/ownership (`briefing/route.ts` L185-316).
  - Risk: a future signal addition could leak PII into the prompt.
  - Prevention/Detection: keep the signal type narrow; add a unit test asserting the prompt contains no address/email substrings. Recommendation: add a "no-PII" assertion test on `buildLlmPrompt`. This is currently a strength, flagged only to guard against regression.

- **S-3 (Low, Security — abuse/cost)**
  - Evidence: briefing route enforces a per-user per-minute limit (10/min), a per-user per-UTC-day generation cap (3/day) via the shared limiter, and an app-wide `checkGlobalBudget("ai")` circuit breaker (`briefing/route.ts` L140-146, L360-390). Failed AI attempts still consume budget (hammering guard, tested).
  - Risk: low — spend is well guarded. Note the in-process `briefingCache` (L52) is per-instance; the *cap* is shared (Upstash) so multi-instance spend is bounded. No action required; documented as a strength.

- **S-4 (Info, Security — open-redirect surface)**
  - Evidence: completion navigations use fixed in-app paths (`/dashboard`, `/moving/plan/${planId}`, `/settings/subscription?returnTo=%2Fdashboard`); `planId` is the server-returned id. Post-auth gating normalizes external redirects via `normalizeAppRedirectPath` (`post-auth-redirect.ts` L39, tested in `post-auth-redirect.test.ts` L64-67). No unsafe redirect found.

- **S-5 (Info, Security — XSS)**
  - Evidence: briefing prose is rendered as React text nodes in `move-briefing-card.tsx` (no `dangerouslySetInnerHTML`); the LLM output is display-only. Wizard renders provider names/descriptions as text. No injection sink found.

## 14. Performance Audit

- **P-1 (Medium, Performance) — N service POSTs in a sequential loop.** `saveServices` issues one
  `POST /api/services` per selected provider serially (`onboarding-client.tsx` L716-763). A user
  who taps "Add all essentials" plus extras can trigger 10+ sequential round-trips, each
  re-validated and rate-limited (profile/service writes share a 20/min user_write budget). Impact:
  slow Step-2 completion and possible 429s mid-batch. Recommendation: add a bulk
  `POST /api/services` endpoint or `Promise.all` with a concurrency cap and a single aggregated
  result. See onboarding-04.
- **P-2 (Low, Performance) — Briefing route does a separate `address.findFirst` after the
  Promise.all.** `briefing/route.ts` runs a 4-way `Promise.all` (L185-229) then an additional
  awaited `address.findFirst` (L232-238). Minor extra serial round-trip; could join the batch.
- **P-3 (Low, Performance) — Full wizard client is a single ~2,344-line client component.**
  `onboarding-client.tsx` ships the entire wizard (all steps, teaser, ritual, Pro showcase) in
  one client bundle. Step content could be code-split. Low priority given it is a one-time route.
- **P-4 (Info) — Recommendations fetch re-runs on every Step-2 entry.** `fetchProviders` is keyed
  on address fields and called when `step === 2` (L498-500). Re-entering Step 2 refetches; no
  client cache. Acceptable, but a memo/ETag would cut repeat loads.

## 15. Reliability Audit

- **R-1 (Medium, Reliability) — Non-atomic multi-write completion.** Completion performs
  `recordOnboardingProgress("MOVING_SKIPPED")` → `recordOnboardingProgress("COMPLETED")` →
  `ensureOnboardingCompleted()` as independent awaited calls (`onboarding-client.tsx` L1019-1023,
  L1050-1052). A failure between writes leaves a partially-recorded state and surfaces an error;
  the user must retry. Both event writes are idempotent (route dedups on `findFirst`), so retry is
  safe, but there is no automatic retry and the UX is a hard error mid-finish. Recommendation:
  collapse the two events into one server call, or wrap completion in a single endpoint. See
  onboarding-06.
- **R-2 (Medium, Reliability) — Partial service-save failure.** `saveServices` can persist some
  services then throw on a later one (sequential loop, no rollback) (`onboarding-client.tsx`
  L716-764). The user sees an error implying nothing saved, but some records exist. Recommendation:
  aggregate per-provider outcomes and report "N of M added" instead of a single throw. See
  onboarding-05.
- **R-3 (Low, Reliability) — `loadOnboardingState` swallows `/api/profile` GET failures.** On a
  transient GET error the `catch` keeps the current step (Step 0) and sets `hydrated`
  (`onboarding-client.tsx` L298-304), so a returning user mid-onboarding can be silently dropped
  to Step 0 with empty fields. Recommendation: surface a retry affordance on load failure.
- **R-4 (Info) — Briefing degrades gracefully.** Missing key → `{configured:false}`; LLM
  timeout/error → rule-based fallback; cap exceeded → cached/rule-based. Well-covered by tests.
  Strength.
- **Monitoring/logging**: `recordIntegrationOutcome("briefing", ...)` emits cached/gated/generated/
  rule_based telemetry; funnel events expose per-step drop-off. Good observability for the briefing
  and funnel; the wizard's own save failures are toast-only (no structured client error reporting
  beyond Sentry if wired globally) — [needs verification of global Sentry capture].

## 16. Dead Code / Cleanup

- **D-1 (Info)** `getOnboardingGateRedirect` in `onboarding-progress.ts` (L63-68) is exercised by
  `onboarding-progress.test.ts` but I found no production import. The production gate uses
  `resolveOnboardingGateRedirect`/`resolvePostAuthRedirect` in `post-auth-redirect.ts` instead.
  Possibly redundant. [needs verification — grep showed no app import outside its test].
- **D-2 (Info)** `OnboardingProgress.stepIndex` value `4`/`step "complete"` is used by the client
  only as a `<= 3` clamp (`onboarding-client.tsx` L244-247); the "complete" branch never renders a
  step. Intentional sentinel, not dead, but worth a comment. No action required.
- No abandoned routes/components found; all imported symbols are used.

## 17. Tests

Existing (strong on pure logic + API routes):
- `onboarding-progress.test.ts` — state machine incl. the COMPLETED-cannot-bypass-legal case.
- `onboarding-profile-payload.test.ts` — payload mapping incl. `isMilitary` forwarding (but NOT that the UI ever sets it true).
- `onboarding-briefing.test.ts` (referenced) + `api/onboarding/briefing/route.test.ts` — cache, cap, gating, fallback, targets, UTC rollover, shared-limiter cold-cache.
- `api/onboarding/progress/route.test.ts` — idempotency, funnel events, validation, rate limit.
- `post-auth-redirect.test.ts` — gating matrix.
- `api/profile/route.test.ts` (referenced) — profile POST.

Missing / suggested:
- **Unit**: regression test that the wizard's profile state → payload yields `isMilitary:true` when "Military" is selected (would have caught onboarding-02). A "no-PII in prompt" assertion (S-2).
- **Integration**: profile POST rejects `isMilitary:true` without SENSITIVE consent (S-1).
- **Integration**: `getPostAuthUserState` vs `/api/profile` scope parity for a workspace member (onboarding-03).
- **E2E**: full resume across refresh at each step; partial service-save failure surfaces "N of M" (onboarding-05); completion idempotency on retry after a mid-finish failure (onboarding-06).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| onboarding-02 | Medium | Logic | Web wizard never sets `Profile.isMilitary=true`; Military button hardcodes false; resume discards saved value | Military movers lose personalization; web/mobile data divergence | Set `isMilitary` from the Military selection (or a dedicated control) and preserve it on resume | `app/onboarding/onboarding-client.tsx` L268,L325,L1658; `lib/onboarding-profile-payload.ts` L38 |
| onboarding-03 | Medium | Logic | Gate counts use raw `userId`; `/api/profile` uses workspace scope → resume/gate desync for members | Possible redirect loop/flicker or wrong resume step for workspace members | Make `getPostAuthUserState` workspace-scope-aware (share scope helper) | `lib/post-auth-redirect.ts` L109-116; `app/api/profile/route.ts` L73-92 |
| onboarding-04 | Medium | Performance | `saveServices` fires N sequential service POSTs | Slow Step-2; possible 429 mid-batch | Bulk endpoint or capped `Promise.all` | `app/onboarding/onboarding-client.tsx` L716-763 |
| onboarding-05 | Medium | Reliability | Partial service-save failure persists some, throws on rest with a "nothing saved" error | Misleading error; orphaned partial saves | Aggregate outcomes; report "N of M added" | `app/onboarding/onboarding-client.tsx` L716-764 |
| onboarding-06 | Medium | Reliability | Non-atomic completion (two event writes + verify) errors mid-finish | Hard error mid-completion; manual retry | Single completion endpoint; events idempotent already | `app/onboarding/onboarding-client.tsx` L1019-1023,L1050-1052 |
| onboarding-07 | Low | Reverse Logic | Direct `COMPLETED` POST skips the address requirement (checked before `addressCount`) | User self-shortcuts onboarding into an address-less dashboard | Require an address before honoring COMPLETED, or accept as intended | `lib/onboarding-progress.ts` L44-49; `app/api/onboarding/progress/route.ts` |
| onboarding-08 | Low | Reliability | `/api/profile` GET failure in `loadOnboardingState` silently drops returning users to Step 0 | Mis-resume on transient error | Surface a load-failure retry | `app/onboarding/onboarding-client.tsx` L298-304 |
| onboarding-09 | Low | Security | UI sensitive opt-in does not cover `isMilitary`; server gate is the only backstop [needs verification] | Future regression could save military status without shown consent | Align UI opt-in with the server SENSITIVE gate | `app/onboarding/onboarding-client.tsx` L570-582; `app/api/profile/route.ts` L220-233 |
| onboarding-10 | Low | Performance | Briefing route runs an extra serial `address.findFirst` after its Promise.all | Minor added latency | Join into the batch | `app/api/onboarding/briefing/route.ts` L185-238 |
| onboarding-11 | Low | UI/UX | Mixed localization: Step 0/1 save messages are hardcoded English | Inconsistent i18n | Route through `next-intl` | `app/onboarding/onboarding-client.tsx` (saveProfile/saveAddress) |
| onboarding-12 | Info | Dead Code | `getOnboardingGateRedirect` appears unused in production [needs verification] | Minor redundancy | Remove or document | `lib/onboarding-progress.ts` L63-68 |
| onboarding-13 | Info | Test | No test that the wizard produces `isMilitary:true`; no no-PII prompt assertion | Coverage gap that hid onboarding-02 | Add the regression + no-PII tests | tests listed in §17 |

## 19. Module TODO

- [ ] **onboarding-02 — Persist `isMilitary` from web onboarding** — Severity: Medium. Reason: military status entered on web is silently dropped; mobile parity broken. Related: `onboarding-client.tsx` (L268,L325,L1658), `onboarding-profile-payload.ts`. Suggested fix: set `isMilitary` true when `moveType === "MILITARY"` (or add a dedicated military checkbox), stop overwriting it to false on resume, and gate it behind the sensitive opt-in if it is to remain a sensitive flag. Dependencies: decide whether military is sensitive (S-1). Complexity: low. Risk: low.
- [ ] **onboarding-03 — Unify gating scope** — Severity: Medium. Reason: `getPostAuthUserState` (raw userId) and `/api/profile` (workspace scope) can disagree, causing redirect loops/flicker for members. Related: `post-auth-redirect.ts`, `api/profile/route.ts`, `workspace-data-scope.ts`. Suggested fix: resolve a `WorkspaceDataScope` inside `getPostAuthUserState` and count through `scopedRecordWhere`/`activeTrackedServiceWhereForScope` like the profile route. Dependencies: workspace context availability in a server-component gate. Complexity: med. Risk: med (changes gating behavior).
- [ ] **onboarding-04 / onboarding-05 — Batch + harden service saves** — Severity: Medium. Reason: N sequential POSTs cause slowness/429 and partial-failure ambiguity. Related: `onboarding-client.tsx` `saveServices`, `api/services/route.ts`. Suggested fix: add a bulk service-create endpoint (or capped `Promise.all`) returning per-item results; surface "N of M added". Dependencies: server endpoint. Complexity: med. Risk: med.
- [ ] **onboarding-06 — Single completion endpoint** — Severity: Medium. Reason: non-atomic multi-write completion errors mid-finish. Related: `onboarding-client.tsx` completion paths, `api/onboarding/progress/route.ts`. Suggested fix: one endpoint that records MOVING_SKIPPED+COMPLETED and returns verified status; keep idempotency. Complexity: low. Risk: low.
- [ ] **onboarding-07 — Gate COMPLETED on address presence** — Severity: Low. Reason: direct COMPLETED skips the address step. Related: `onboarding-progress.ts`. Suggested fix: move the `completedEvent` check after the `addressCount` check, or require `addressCount > 0` to honor it. Dependencies: confirm product intent (address-later is allowed). Complexity: low. Risk: low (could re-gate intentional skips).
- [ ] **onboarding-08 — Load-failure retry on resume** — Severity: Low. Reason: transient `/api/profile` failure drops users to Step 0. Related: `onboarding-client.tsx` `loadOnboardingState`. Suggested fix: render a retry/error state instead of silently defaulting to Step 0. Complexity: low. Risk: low.
- [ ] **onboarding-09 — Align sensitive opt-in with `isMilitary`** — Severity: Low. Reason: UI consent surface and server gate model military differently. Related: `onboarding-client.tsx`, `api/profile/route.ts`. Suggested fix: include `isMilitary` under the sensitive opt-in if it stays a sensitive flag. Complexity: low. Risk: low.
- [ ] **onboarding-10 — Fold briefing `address.findFirst` into the batch** — Severity: Low. Complexity: low. Risk: low.
- [ ] **onboarding-11 — Localize Step 0/1 save messages** — Severity: Low. Complexity: low. Risk: low.
- [ ] **onboarding-13 — Add regression + no-PII tests** — Severity: Info. Reason: coverage gap hid onboarding-02. Complexity: low. Risk: low.
- [ ] **onboarding-12 — Confirm/remove `getOnboardingGateRedirect`** — Severity: Info. Complexity: low. Risk: low.
