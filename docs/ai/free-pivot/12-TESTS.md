# 12 · Tests

> The exhaustive flag×user×surface×feature grid + invariants live in [17-TEST-MATRIX](17-TEST-MATRIX.md). This file is the change/preserve summary.

Key tension: the task says "don't break subscription tests," but **making a gated feature free necessarily changes the tests that assert it's gated.** Resolve by splitting:
- **Gating-POLICY tests** → must be updated to the new free reality.
- **Billing/IAP/entitlement-ENGINE + security tests** → must stay intact (we don't change `entitlement.ts` provider branches, Stripe/IAP code, or admin step-up).

## Update (gating-policy — expectations change)

| Test | Why it changes |
|---|---|
| `packages/shared/src/workspace-entitlements.test.ts` | asserts `FREE_TRIAL.aiBriefing===false`, `homeDossier===false`, etc. → now full when `CONSUMER_FREE` on (test both flag states) |
| `apps/web/src/lib/plan-limits.test.ts` | asserts free-tier blocks (`MOVING_PLAN_UPGRADE_REQUIRED`, caps 3/10) → now allowed/unlimited under flag |
| `apps/web/src/app/api/addresses/[id]/dossier/route.test.ts` | preview vs full + upgrade-teaser path → free gets full |
| `apps/web/src/app/api/move-tasks/route.test.ts` | upgrade block → allowed; new `move_created`/`address_task_completed` emits |
| `apps/web/src/app/api/workspaces/[id]/invitations/route.test.ts` | seat ceiling for free → raised |
| `apps/web/src/app/api/custom-providers/route.test.ts` | new `provider_added` emit |
| `apps/mobile/src/lib/home-dossier.test.ts` | teaser vs data branches |
| `apps/mobile/src/lib/plan-comparison.test.ts` | **only if** the mirror caps literals change (they needn't for the core switch) |
| `apps/web/src/components/marketing/pricing-section.test.tsx` | asserts "included on Individual and up" etc. → rebuilt section copy |
| `apps/web/src/components/marketing/plan-compare-table.test.tsx` | tier/price assertions |
| mobile subscription / `subscription-visible-plans` copy tests | display-name/copy changes |
| analytics registry tests | 7 new event names + allowed keys |

## Preserve (engine / billing / security — do NOT weaken)

| Test | Why preserve |
|---|---|
| `packages/shared/src/__tests__/entitlement.test.ts` (correct path) | provider-paid/refund/cancel/grace + admin-manual branches stay exact (override is additive, free-path only). Must run with `CONSUMER_FREE` OFF — add a `beforeEach` deleting `process.env.CONSUMER_FREE` + CI guard ([16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H1/L6) |
| Stripe webhook/checkout/reconcile tests | billing plumbing unchanged |
| IAP verify / appstore / playstore webhook tests | unchanged |
| `apps/admin/.../feature-flags/route.test.ts`, `admin-step-up-ui.test.ts` | step-up + audit must stay |
| consent / `tracking-consent` / sampling / retention tests | new events must inherit, not bypass |
| billing-metrics / admin billing tests | admin truth preserved |

## New tests to add
- `getUserPlan` / `planFeatures` / `getEffectiveEntitlement` return full for all users **when CONSUMER_FREE on** AND tiered behavior **when off** (both directions — proves reversibility).
- A **provider-paid user still resolves to their real tier** with the flag on (override must not mask real payers); a **refunded/canceled** payer still loses premium (admin accuracy).
- Admin read path returns RAW (non-overridden) entitlement.

## Strategy
Where practical, parametrize gating tests over `CONSUMER_FREE` on/off so both the dormant paid model and the live free model are covered — this also documents the rollback contract.
