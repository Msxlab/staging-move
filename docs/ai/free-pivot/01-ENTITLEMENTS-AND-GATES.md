# 01 · Entitlements & Server Gates

The heart of the pivot. Make **every account resolve to full access**, behind `CONSUMER_FREE`, while the billing engine keeps interpreting real subscriptions correctly.

## The "all accounts full" recipe

### Lever 1 — `getUserPlan()` · [apps/web/src/lib/plan-limits.ts:103](apps/web/src/lib/plan-limits.ts)
Today: resolves a ladder — missing/FREE_TRIAL/FREE_ACCESS → `FREE_TRIAL` limits, `hasPremium:false`; only manual-override or provider-paid get INDIVIDUAL/FAMILY/PRO.

Change (flag on): **short-circuit before the ladder** and return:
```
{ plan: 'PRO', isActive: true, hasPremium: true, isTrialExpired: false,
  limits: { maxAddresses: UNLIMITED, maxServices: UNLIMITED } }
```
for every user. Keep the entire existing ladder as the `else` branch (flag off → tiered behavior returns). **Still call** `findSubscriptionForEntitlement`/`getEffectiveEntitlement` so admin/analytics stay correct — only the returned `UserPlan` is overridden.

This single change auto-passes: `canCreateMovingPlan`, `canGenerateMoveTasks`, `canCreateAddress/Service/CustomProvider`, and `requireAppMutationUser({requirePremium})`.

### Lever 2 — `planFeatures()` / `FEATURES` · [packages/shared/src/workspace-entitlements.ts:55](packages/shared/src/workspace-entitlements.ts)
Today: `FEATURES.FREE_TRIAL` sets almost everything false (only `homeDossierPreview:true`); `planFeatures(plan)` returns `FEATURES[plan] ?? DEFAULT_FEATURES`.

**⚠️ CORRECTION (see [16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H2): DROP lever 2.** Overriding `planFeatures` is **redundant** — every server gate calls `planFeatures(userPlan.plan)` and `userPlan.plan` is already `'PRO'` from lever 1, so the gates already open. An override here is also high-blast-radius (it would invert the marketing/comparison/dossier tests and collapse the Compare-plans table). **Keep `planFeatures` pure/tier-literal** (do NOT add an env/global override). The FEATURES table stays as dormant tier data. Mechanism = **two** param-gated overrides only: lever 1 + lever 3.

### Lever 3 — `getEffectiveEntitlement()` · [packages/shared/src/entitlement.ts:130](packages/shared/src/entitlement.ts)
Today: non-paying/free/unknown → `hasAccess:false, hasPremium:false, effectivePlan:FREE_TRIAL`. Mobile reads this via `/api/profile` → `buildUnifiedEntitlementSnapshot` ([billing.ts:134](apps/web/src/lib/billing.ts)).

Change (flag on, **recommended Option A**): post-process so any **non-provider-paid** outcome (free/unknown/expired/no-row) is upgraded to `hasAccess:true, hasPremium:true, effectivePlan:'PRO'`. **Do NOT touch** the provider-paid / refund / cancel / grace branches — a real payer must still resolve to their tier, a refunded/canceled/expired payer must still lose premium (admin accuracy + seat reconciliation, see [16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H3). **Gate via a per-call `applyConsumerFree` PARAM (default false), NEVER an env-global** — admin imports this same function and must read RAW; an env read also inverts the preserve-suite tests ([16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H1). Pass `true` ONLY from web consumer reads (`getUserPlan`, `buildUnifiedEntitlementSnapshot`/`/api/profile`, mobile snapshot). Also required for seats (H3) and the future payer-floor (H5).

> Why Option A over editing the snapshot: web `getUserPlan`, `/api/profile` entitlement, and mobile all consume `getEffectiveEntitlement`. One guarded post-process covers web + mobile.

## ⚠️ "Unlimited" means plan limits only — NOT cost/rate limits
Lifting plan/feature limits (addresses, services, seats, feature booleans) is **separate** from the cost & abuse guardrails. Per-request **rate limits** ([rate-limit-policy.ts](apps/web/src/lib/rate-limit-policy.ts) — keyed by IP/user + route group, **not by plan**), the **AI daily cap**, **export/PDF ceilings**, **external-API throttles**, **caching**, and **analytics sampling** all STAY. Do **not** add a "premium bypass" to any limiter when making everyone PRO. Full detail: [15-COST-CACHE-LIMITS](15-COST-CACHE-LIMITS.md).

## Web server gates (auto-open once levers flip)

| Feature | Gate | File | Note |
|---|---|---|---|
| Move plan / checklist | `canCreateMovingPlan` (keys `hasPremium`) | [plan-limits.ts:318](apps/web/src/lib/plan-limits.ts) | Auto-passes via lever 1 |
| Move timeline / tasks | `canGenerateMoveTasks` | [plan-limits.ts:358](apps/web/src/lib/plan-limits.ts) | Auto-passes via lever 1 |
| Address tracker | `canCreateAddress` (cap 3) | [plan-limits.ts:246](apps/web/src/lib/plan-limits.ts) | UNLIMITED via lever 1 |
| Provider/company tracker | `canCreateService` (cap 10) | [plan-limits.ts:290](apps/web/src/lib/plan-limits.ts) | UNLIMITED via lever 1 |
| Custom providers | `canCreateCustomProvider` | [plan-limits.ts:380](apps/web/src/lib/plan-limits.ts) | Unlimited once `isActive:true` |
| Family/member sharing | `seatLimitForPlan` / `overflowCount` (seat 1) | [workspace-entitlements.ts:71](packages/shared/src/workspace-entitlements.ts) + [invitations/route.ts:101](apps/web/src/app/api/workspaces/[id]/invitations/route.ts) | PRO seats via lever 2 |
| AI move briefing | `planFeatures().aiBriefing` (false) | [onboarding/briefing/route.ts:168](apps/web/src/app/api/onboarding/briefing/route.ts) | True via lever 2 — see note ⚠️ |
| Home Dossier (full) | `features.homeDossier` (preview-only) | [dossier/route.ts:548](apps/web/src/app/api/addresses/[id]/dossier/route.ts) | Full data via lever 2 |
| Dossier PDF | `features.dossierPdf` (PRO-only) | [dossier/pdf/route.ts:36](apps/web/src/app/api/addresses/[id]/dossier/pdf/route.ts) | True via lever 2 (everything-free) |
| Neighborhood Intel | `features.neighborhoodIntel` | [dossier/route.ts:779](apps/web/src/app/api/addresses/[id]/dossier/route.ts) | True via lever 2 (everything-free) |
| Reminders/weather digest | `features.weatherDigest` | [workspace-entitlements.ts:59](packages/shared/src/workspace-entitlements.ts) | True via lever 2 — see cost note 💸 |
| Per-request boolean gate | `requestHasPlanFeature` / `getRequestEntitlement` | [request-entitlements.ts:27](apps/web/src/lib/request-entitlements.ts) | Pure pass-through; no edit |
| API mutation gate | `requireAppMutationUser` | [api-gates.ts:101](apps/web/src/lib/api-gates.ts) | Auto-passes; no edit |

⚠️ **AI briefing cost guard:** the route enforces a hard 3/day Anthropic cap (`DAILY_AI_GENERATION_CAP`) and degrades to a deterministic rule-based briefing. **Preserve it** — it's cost control, not a paywall. The `ANTHROPIC_API_KEY` "configured" check ([briefing/route.ts:151](apps/web/src/app/api/onboarding/briefing/route.ts)) is a deployment switch, not a paywall — preserve.

💸 **weatherDigest** drives the move-week/weekly digest cron emails → opening it for all increases email volume/cost. Confirm acceptable.

## Mobile
No entitlement edits required for the core switch — `auth-store.planTier` ([auth-store.ts:52](apps/mobile/src/lib/auth-store.ts)) and `isPremium` ([index.tsx:479](apps/mobile/app/(tabs)/index.tsx)) derive from the server snapshot → become `PRO`/premium automatically. The mirrored caps `plan-comparison.ts` ([:57](apps/mobile/src/lib/plan-comparison.ts)) read PRO once `planTier=PRO`. (Showing "Free — everything included" instead of PRO numbers is a *copy* task → [06-MOBILE](06-MOBILE.md).) Onboarding/teaser cleanup → [06-MOBILE](06-MOBILE.md).

## Preserve verbatim (billing-keep)
`getEffectiveEntitlement` provider-paid/refund/cancel/grace branches & admin-manual branch ([entitlement.ts:248,453](packages/shared/src/entitlement.ts)); `buildUnifiedEntitlementSnapshot` ([billing.ts:134](apps/web/src/lib/billing.ts)); Stripe price mapping ([billing.ts:48](apps/web/src/lib/billing.ts)); `BILLING_PLAN_DEFINITIONS` keys/prices; `requestHasPlanFeature`; `requireAppMutationUser` error codes; admin billing reads. See [09-PAYMENTS-BILLING-PRESERVED](09-PAYMENTS-BILLING-PRESERVED.md).

## Concurrent-plan gate ⚠️ ([16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H4)
[POST /api/moving:99](apps/web/src/app/api/moving/route.ts) caps active plans at `concurrentPlanLimit=3` and returns a silent `200 {entitled:false}` no create flow handles → with everyone PRO it dead-ends the whole base at the 4th move with nowhere to upgrade. **Under the flag, raise `concurrentPlanLimit` to unlimited (or skip the gate).**

## Tests impacted → [12-TESTS](12-TESTS.md) · full matrix → [17-TEST-MATRIX](17-TEST-MATRIX.md)
`workspace-entitlements.test.ts` (planFeatures stays tier-literal), `plan-limits.test.ts` (parametrize over flag), dossier route test, move-tasks test, invitations route test (add real free-owner case), mobile `home-dossier.test.ts`, `plan-comparison.test.ts`. Preserve `packages/shared/src/__tests__/entitlement.test.ts` + Stripe/IAP/security tests (don't edit `entitlement.ts` provider branches) — and keep `CONSUMER_FREE` OFF in the shared-package test env.
