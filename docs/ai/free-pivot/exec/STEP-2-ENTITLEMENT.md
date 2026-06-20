# Step 2 — Entitlement Core (CONSUMER_FREE, flag OFF) · Implementation Spec

Mechanism (corrected by reports 16/17): **two param-gated overrides, applied via a pure wrapper — the billing core `getEffectiveEntitlement` is NOT edited** (zero risk to the 25-case preserve-suite; fully reversible). `planFeatures` override is DROPPED (redundant). Admin reads RAW.

## Coded now (safe, isolated)
- ✅ `packages/shared/src/consumer-free.ts` — `applyConsumerFreeOverride(result, enabled)` + `CONSUMER_FREE_FLAG`. Pure; upgrades ONLY `managementKind === "none" && !hasPremium` (free/campaign/no-row) → PRO/active/paid; **never** a real provider row (active payer = premium → skip; lapsed/refunded/canceled Stripe = "stripe", store = "store" → skip; admin = "admin" → skip). H3-safe by construction.
- ✅ `packages/shared/src/consumer-free.test.ts` — 8 tests incl. the H3 lapsed-payer cases + reversibility.
- The upgraded shape (effectivePlan PRO, accessType PAID, effectiveStatus PAID_ACTIVE) is chosen so the **existing** `getUserPlan` ladder yields PRO limits and the consumer snapshot reads active+paid (resolves M1) with **no change to the ladder**.

## Wiring to apply where `prisma generate` + typecheck + the 17-matrix run (CI/checkout)

1. **Flag resolver (web).** Add a tiny `consumerFreeEnabled()` in web: `return isFeatureEnabled(CONSUMER_FREE_FLAG)` ([feature-flags.ts](apps/web/src/lib/feature-flags.ts), DB-backed, fail-closed). Both consumer read paths await it.
2. **`getUserPlan`** ([plan-limits.ts:103](apps/web/src/lib/plan-limits.ts)) — TWO return points:
   - main path: after `const effective = getEffectiveEntitlement(subscription);` → `const eff = applyConsumerFreeOverride(effective, await consumerFreeEnabled());` and derive plan/limits/hasPremium/isActive from `eff` (the existing ladder already yields PRO for the upgraded shape → `limits = PLAN_LIMITS.PRO`, the abuse ceiling, NOT UNLIMITED).
   - no-subscription early return (line 106): also apply — simplest is to compute `applyConsumerFreeOverride(getEffectiveEntitlement(null), enabled)` (the resolver handles `null`) instead of the hardcoded FREE_TRIAL object.
   - Admin never calls `getUserPlan`, so admin stays raw automatically (H1).
3. **`buildUnifiedEntitlementSnapshot`** ([billing.ts:134](apps/web/src/lib/billing.ts)) — wrap its `getEffectiveEntitlement(...)` result with `applyConsumerFreeOverride(result, enabled)` so `/api/profile` (web client + **mobile** snapshot → planTier PRO, isPremium true) reflects free-for-all. Keep provider/expiresAt/management fields. Admin/billing-metrics call `getEffectiveEntitlement` directly (no wrapper) → RAW.
4. **Concurrent-plan fix (H4)** ([api/moving/route.ts:99](apps/web/src/app/api/moving/route.ts)) — under the flag, skip/raise the `concurrentPlanLimit` gate (it returns a silent 200 teaser that dead-ends every user at the 4th move). Either `if (enabled) skip` or raise `concurrentPlanLimit` for the upgraded plan.
5. **Cache epoch (H7)** — on flag flip, consumer caches must not replay pre-flip gated payloads: add an entitlement epoch to `/api/profile` + dossier cache keys and purge on change; do NOT send positive `max-age` on gated payloads. (Pairs with PR1b dossier cache.)
6. **planFeatures stays pure** — do NOT override it (H2). Server feature gates already get `plan: "PRO"` from getUserPlan → all open.

## Tests (CI) — from [17-TEST-MATRIX](../17-TEST-MATRIX.md)
- `getUserPlan`/snapshot with flag {on,off} × user {new, free, expired-trial, lapsed-payer, active-payer, admin-grant}: ON→PRO/active for free-family; OFF→tiered; **lapsed/active payer + admin unaffected both ways**.
- Admin-raw: admin call sites never wrap → free user shows raw FREE.
- Reversibility (describe.each over the flag). Concurrent-plan ON → create succeeds. Rate-limit/AI-cap not bypassed (Step 1).
- Keep `packages/shared/src/__tests__/entitlement.test.ts` GREEN with flag unset (entitlement.ts untouched → it already is).

## Status
🟡 Core override + tests coded (billing core untouched). Wiring (1–6) + CI verification pending — needs the toolchain + the full matrix; not safe to land blind.
