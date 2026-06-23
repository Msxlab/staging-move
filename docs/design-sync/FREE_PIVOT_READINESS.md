# Free-Pivot (CONSUMER_FREE) Readiness Audit — for D3 "truly free"

> Read-only completeness check of the `CONSUMER_FREE` mechanism before turning it ON for real (D3: deactivate paid tiers, every user PRO, remove user-facing payment surfaces, keep billing backend dormant + reversible). **No code changed.** Evidence = current source.

## Verdict
- **Core mechanism: ✅ correctly built and reversible.** Safe to flip ON/OFF without deleting billing.
- **Production flip ("truly free"): ⚠️ NOT fully ready.** Several edge-case traps from the team's own adversarial list (`docs/ai/free-pivot/16`) are still open in current code. Turn the flag ON only after resolving the 🔴 items below.

## Mechanism status (✅ wired)
- **Lever 1 — `getUserPlan`** (`apps/web/src/lib/plan-limits.ts:115-147`): CONSUMER_FREE short-circuit → consumer resolves to PRO (`hasPremium:true`, `UNLIMITED` limits) via the H3-safe `consumerFreeApplies(effective, consumerFree)` predicate (excludes real Stripe/store/admin payers). ✅
- **Lever 3 — `getEffectiveEntitlement`** (`packages/shared/src/entitlement.ts:152-158`): `applyConsumerFreeOverride(result, options?.applyConsumerFree ?? false)` — **per-call param, default false** (NOT env-global), so H1/H2 are resolved and the override is reversible + admin-truthful. ✅ Also called in `billing.ts:166`.
- **Flag resolution:** `isFeatureEnabled(CONSUMER_FREE_FLAG, {userId})` read across home, pricing, dashboard, (app)/layout, moving, settings/subscription, api/profile, onboarding/briefing, blog, llms.txt, pricing-section. ✅ broadly wired.
- **Current state: flag is OFF by default** — `CONSUMER_FREE_DEFAULT="false"` in `.env.example:58` + `.env.production.example:143`; `feature-flags.ts:24-25` falls back to that. → To activate, set `CONSUMER_FREE_DEFAULT=true` **and/or** a DB FeatureFlag row (admin → feature-flags). **[runtime state of the DB row not verifiable from code.]**

## 🔴 Open traps — resolve BEFORE the production flip
| Trap | Status in current code | Action |
|---|---|---|
| **H4 — concurrent-plan dead-end** | `workspace-entitlements.ts:56` PRO `concurrentPlanLimit: 3` (not unlimited). Everyone→PRO caps at **3 concurrent move plans**. | Make `concurrentPlanLimit` unlimited (or a high finite cap) under the flag. Verify the `getUserPlan` UNLIMITED path covers concurrent plans. |
| **H6 — no abuse ceiling** | `plan-limits.ts:30` `UNLIMITED = Number.MAX_SAFE_INTEGER` still the cap. | Replace with a **finite abuse cap** shared web↔mobile (kills H6+H8). Free ≠ unlimited spend. |
| **M4 — weatherDigest cron blast** | `cron/weekly-digest/route.ts:82-87` gates on `planFeatures(plan).weatherDigest`; everyone→PRO ⇒ **entire base emailed + NWS lookups**, no per-user/day cap. | Add a recipient/day cap + a cron test asserting recipient count under both flag states. (Cost/abuse.) |
| **H7 — cache serves stale gated payloads** | No `consumer-free` cache epoch / flip-purge found (web ~10min, mobile ~30min caches). | Add a cache epoch keyed on the flag + no-store on gated payloads + purge on flip. |
| **H8 — web↔mobile cap mismatch + un-buyable upgrade CTA** | Tied to H6; mobile may show an "Upgrade" CTA that can't be bought when free. | Align caps; replace mobile upgrade alert with neutral "contact support for capacity". |

### 🟠 Medium (fix or explicitly accept)
- **M1 — contradictory snapshot:** `billing.ts buildUnifiedEntitlementSnapshot` sets `status` from RAW but `isActive/plan` from override → full-access user can still see "FREE_ACCESS_EXPIRED → Choose a plan" banners in `subscription-management.tsx`. Normalize the snapshot status under fullAccess.
- **M2 — UNLIMITED sentinel in UI:** `service-usage-indicator.tsx:30` would render `3 / 9007199254740991`; add a shared `isUnlimited()` guard.
- **M3 — setup-grace cap removed:** `isActive` always true ⇒ the 3-address onboarding cap goes dead. Confirm acceptable or re-express independently.
- **M5 — guardrails untested:** add tests proving the override grants NO rate-limit/AI-cap exemption.

## User-facing PRO surfaces (D3 wants hidden/removed) — flag-awareness
| Surface | File | Flag-aware? |
|---|---|---|
| Marketing pricing | `components/marketing/pricing-section.tsx:549` | ✅ `if (consumerFree)` → free layout |
| Settings → Subscription | `(app)/settings/subscription/page.tsx` + `components/settings/subscription-management.tsx` | ✅ passes `consumerFree` (but see M1 banner) |
| Upgrade prompt | `components/shared/upgrade-prompt.tsx` | ⚠️ **no `consumerFree` reference** — gate it (or confirm it never fires because gates pass) |
| Service-limit upsell / usage indicator | `components/shared/service-limit-upsell.tsx`, `service-usage-indicator.tsx` | ⚠️ M2 — UNLIMITED sentinel |
| Mobile subscription/IAP | `apps/mobile/app/settings/subscription.tsx`, `src/lib/{iap,iap-offers,subscription-gate,subscription-visible-plans}.ts` | ⚠️ needs a completeness pass (hide buy UI under free) |

## Recommended "truly-free" phase (when we get to it)
1. Resolve 🔴 **H4, H6, M4, H7, H8** (the safety/cost/UX blockers) — these are the real work.
2. Sweep the ⚠️ user-facing PRO/IAP surfaces (upgrade-prompt, usage sentinels, mobile IAP) to hide buy/upsell under the flag.
3. Address 🟠 M1/M2/M3/M5.
4. Turn the flag ON (`CONSUMER_FREE_DEFAULT=true` + DB row) in staging → verify everyone resolves PRO, no "choose a plan" contradictions, caps hold, cron recipient count sane.
5. Keep billing backend dormant + reversible (do NOT delete Stripe/IAP/admin-billing — D3).

> This is its own phase, separate from the design re-skin. The mechanism existing + reversible means it's low-risk to stage, but the 🔴 traps must be closed before a real flip or the base hits a 3-plan cap, an email blast, stale caches, and an un-buyable upgrade CTA.

_Audited 2026-06-22 (read-only). Source-cited; DB/runtime flag state not checked._
