# 17 · Test Matrix

Exhaustive combination matrix for the pivot. Axes: **FLAG** {on, off} × **USER** {brand-new (no row), free-active, expired-trial/free, former-free, admin-manual-grant, FUTURE provider-paid} × **SURFACE** {web, mobile, admin} × **FEATURE**. Parametrize gating tests over the flag (`describe.each([true,false])`) — this both documents and enforces **reversibility**.

## Expected-outcome grid (FLAG ON unless noted)

| Feature · gate | FLAG ON (all consumer users) | FLAG OFF (tiered) |
|---|---|---|
| Move plan · `canCreateMovingPlan` [plan-limits.ts:318](apps/web/src/lib/plan-limits.ts) | allowed (hasPremium:true) | gated `MOVING_PLAN_UPGRADE_REQUIRED` (free) |
| Move-tasks/timeline · `canGenerateMoveTasks` :358 | allowed | gated (free); GET always ungated |
| Addresses cap · `canCreateAddress` :246 | up to **finite abuse cap** (not ∞) | 3/10/15/25 by tier |
| Services cap · `canCreateService` :290 | finite abuse cap | 10/100/500/1000 |
| Custom providers · `canCreateCustomProvider` :380 | finite abuse cap (**add count check** — H6) | setup-grace 10 then tier |
| Members/seats · `seatLimitForPlan(effectivePlan)` [invitations:100](apps/web/src/app/api/workspaces/[id]/invitations/route.ts) | 10 — WIRED via `resolveConsumerEntitlement` (H3 ✅, [AUDIT-FIXES](exec/AUDIT-FIXES.md)) | 1 (free/indiv) → "Upgrade to invite" |
| Concurrent plans · [moving/route.ts:99](apps/web/src/app/api/moving/route.ts) | **unlimited** (H4 fix) — NOT 3 | 3 (PRO) |
| AI briefing · `aiBriefing` [briefing:168](apps/web/src/app/api/onboarding/briefing/route.ts) | on (plan→PRO) **+ DAILY_AI_GENERATION_CAP still applies** | Family+Pro only |
| Home dossier (full) · [dossier:548](apps/web/src/app/api/addresses/[id]/dossier/route.ts) | full | preview subset (free) |
| Dossier PDF · [pdf:36](apps/web/src/app/api/addresses/[id]/dossier/pdf/route.ts) | on **+ export_pdf 3/60s still applies** | Pro only |
| Neighborhood · [dossier:779](apps/web/src/app/api/addresses/[id]/dossier/route.ts) | on | Pro only |
| Export/PDF · [export:126](apps/web/src/app/api/export/route.ts) | on **+ export_data 3/15min still applies** | Pro only |
| weatherDigest · [weekly-digest:87](apps/web/src/app/api/cron/weekly-digest/route.ts) | every user (cost — add per-user/day cap) | Individual+ |

USER-row nuances: **brand-new(no row)** & **expired-trial/free** & **former-free** → identical to free-active when ON (override lifts all); the now-dead setup-grace/inactive branches must be flag-OFF-only (M3). **admin-manual-grant** & **provider-paid** → resolve to their real/granted tier; ON must floor them to **≥ free-PRO** (H5). **admin SURFACE** → always RAW (see invariant c).

## Invariants (must hold regardless of flag)
- **(a) Cost guardrails not bypassed** — flag-ON brand-new user: 4th `export_pdf` in window = 429; AI past `DAILY_AI_GENERATION_CAP` = deterministic rule-based briefing (not a fresh LLM 200). Guard test: rate-limit-policy + AI-cap code reference no `plan`/`hasPremium`/entitlement symbol. (M5)
- **(b) Reversibility** — flag on→off restores every gate. Parametrize core gating tests over both.
- **(c) Admin reads RAW** — with flag ON, `getEffectiveEntitlement(freeRow, now, {applyConsumerFree:false})` (admin call sites) still returns `hasPremium:false`/`FREE_ACCESS`; admin seat counts use raw tier. (H1)
- **(d) Payer ≥ free floor** — every paid tier's feature/seat/cap ≥ the free-PRO baseline when ON. (H5)
- **(e) Cache busts on flip** — same user+address after flip = MISS / new payload, not a stale preview; gated payloads are `no-store`. (H7)
- **(f) provider-paid lapsed still loses access** — a once-paid CANCELED/REFUNDED/EXPIRED row keeps `hasAccess:false` even with flag ON (not re-upgraded by the override), so seat reconciliation still collapses. (H3 reverse)

## Existing tests that CHANGE (gating-policy)
- `apps/web/src/lib/plan-limits.test.ts` — parametrize over flag; ON=allowed/finite-cap, OFF=tiered. Mark setup-grace/`TRIAL_EXPIRED`/`inactivePlanBlock` cases flag-OFF-only.
- `packages/shared/src/__tests__/workspace-entitlements.test.ts` — `planFeatures('FREE_TRIAL')` stays tier-literal (NOT overridden, H2); assert it's unaffected by the flag env.
- `apps/web/src/app/api/addresses/[id]/dossier/route.test.ts` — ON: full; OFF: preview. (Mocks `getPlanForLimitScope`→ plan; keep `planFeatures` real.)
- `apps/web/src/app/api/move-tasks/route.test.ts` — ON allowed (+ new `move_created`/`address_task_completed` emits); OFF gated.
- `apps/web/src/app/api/workspaces/[id]/invitations/route.test.ts` — **add a real free-owner case** (stop mocking `seatLimitForPlan`/`getEffectiveEntitlement`): ON→10 seats, OFF→403. (H3)
- `apps/mobile/src/lib/home-dossier.test.ts` — add flag-ON full-data path; keep teaser/locked as flag-OFF/lapsed-payer contract. (assert planTier='PRO')
- `apps/mobile/src/lib/plan-comparison.test.ts` — update to the chosen cap policy (H8); add web↔mobile drift assertion.
- `apps/web/src/components/marketing/pricing-section.test.tsx`, `plan-compare-table.test.tsx` — rebuilt Free + coming-soon copy; assert `planFeatures` columns unchanged (not collapsed).
- `packages/shared/src/ux-experiments.test.ts` — teaser `isPremium` expectations; pin experiment.
- analytics registry tests — 7 new events.

## Existing tests that are PRESERVED (engine/billing/security — do NOT weaken)
- `packages/shared/src/__tests__/entitlement.test.ts` — **note correct path** (`__tests__/`, not `src/` root). Must run with flag OFF; add `beforeEach` deleting `process.env.CONSUMER_FREE` and a CI guard the var is unset for the shared-package run (H1/L6). Param-gating makes it flag-immune by construction.
- Stripe webhook/checkout/portal/reconcile; IAP verify/appstore/playstore webhook; admin `feature-flags/route.test.ts` + `admin-step-up-ui.test.ts`; consent/sampling/retention; billing-metrics/admin billing.

## NEW tests to add
1. **Override directionality** — `getUserPlan`/`getEffectiveEntitlement` with `{applyConsumerFree:true}` → PRO/active/premium for free/unknown/expired; with `false` (admin/default) → raw. (H1)
2. **Admin-raw guard** — admin call sites never pass `applyConsumerFree:true`. (H1)
3. **Reversibility** — describe.each(flag) over the gating grid. (b)
4. **Payer-floor** — paid tier ≥ free-PRO floor when ON. (H5/d)
5. **Lapsed-payer reverse** — CANCELED/REFUNDED row stays `hasAccess:false` with flag ON → seat reconcile collapses. (H3/f)
6. **Concurrent plans** — flag ON: 4th active plan create succeeds (or returns a real coded error, never the silent 200 teaser). (H4)
7. **Abuse cap** — creating past the finite abuse cap is blocked (addresses/services/custom-providers); custom-provider count check exists. (H6)
8. **Cost-guardrail invariants** — (a) above.
9. **Cache-bust on flip** — (e) above (server key includes epoch; gated payload `no-store`).
10. **Snapshot consistency** — `isActive:true` never co-occurs with an "expired/choose a plan" status the UI keys on. (M1)
11. **weatherDigest recipient count** — both flags; assert ON-case count + any per-user/day cap. (M4)
12. **UNLIMITED-sentinel display** — usage indicator hides/normalizes the sentinel. (M2)

## Structural traps to avoid (from the audit)
- Don't make `planFeatures` env-global (inverts marketing/comparison/dossier tests + redundant). (H2)
- Don't let `CONSUMER_FREE` leak into the shared-package test env (silently inverts the preserve-suite). (H1)
- Don't assert now-dead branches (setup-grace, `TRIAL_EXPIRED`, free-teaser) as live — wrap them in flag-OFF.
