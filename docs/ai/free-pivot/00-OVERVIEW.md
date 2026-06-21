# LocateFlow → Free Consumer App · Repositioning Master Report

> **Status:** PLAN ONLY — no code has been changed. This folder documents *everything* the pivot touches, surface by surface, so implementation can be approved and executed deterministically.
> **Generated:** 2026-06-19 · from two read-only audits (entitlement/billing + all public/store/comms surfaces).

## The decision (locked)

1. **All accounts get full access to everything.** Every user — any plan, trial, free, or unknown — resolves to full features + unlimited limits. Nothing consumer-facing is gated.
2. **Public pricing = "Free" (active) + "Concierge" (coming soon) + "Business" (coming soon).** Concierge/Business are *not for sale*; they are placeholders to capture interest for future monetization.
3. **Billing infrastructure is preserved but dormant.** Stripe, Apple IAP, Google Play IAP, the entitlement engine, admin billing, and lifecycle emails stay intact and correct — just not reachable by users.
4. **Reversible.** The whole behavior sits behind a single master switch (`CONSUMER_FREE`). Flip it off → the tiered paid model returns.
5. **Everyone resolves to PRO** — every account is the PRO tier (incl. the Pro accent theme on mobile).
6. **Caching is preserved.** No cache layer is stripped or bypassed; cache-first read paths stay (web + mobile). See [15-COST-CACHE-LIMITS](15-COST-CACHE-LIMITS.md).
7. **Cost / API / abuse limits are preserved.** Free ≠ unlimited spend: per-IP/user rate limits, the AI daily cap, export ceilings, external-API throttles, and analytics sampling all stay — they are *not* paywalls and are *not* plan-based. See [15-COST-CACHE-LIMITS](15-COST-CACHE-LIMITS.md).

## The core mechanism — a 3-point switch, not a sweep

Gating funnels through a tiny number of choke points. Making "every account full" is **3 edits** (all behind `CONSUMER_FREE`):

| # | Lever | File | Effect |
|---|---|---|---|
| 1 | `getUserPlan()` | [plan-limits.ts:103](apps/web/src/lib/plan-limits.ts) | Returns `hasPremium:true, isActive:true, plan:PRO, limits:UNLIMITED` for **all** users → opens move plan, move-tasks, addresses, services, custom providers, all `requirePremium` API gates |
| 2 | `planFeatures()` / `FEATURES` | [workspace-entitlements.ts:55](packages/shared/src/workspace-entitlements.ts) | Returns the **PRO feature set (all booleans true)** for all plans → opens AI briefing, full Home Dossier (+PDF, neighborhood), real map, vehicle check, weather digest, address validation, exports — everywhere `requestHasPlanFeature` is called |
| 3 | `getEffectiveEntitlement()` | [entitlement.ts:130](packages/shared/src/entitlement.ts) | Post-process: any *non-provider-paid* outcome → `hasAccess:true, hasPremium:true, effectivePlan:PRO`. This single change also lights up **mobile** (it reads this via `/api/profile`). Provider-paid / refund / cancel / grace branches stay untouched. |

**Mobile needs almost no entitlement edits** — it has no independent resolver; `isPremium`/`planTier` come from the server snapshot, so lever #3 propagates automatically.

### The flag plumbing nuance
- `getUserPlan` is web-side + async → it can `await isFeatureEnabled('CONSUMER_FREE')` ([feature-flags.ts:36](apps/web/src/lib/feature-flags.ts)).
- `getEffectiveEntitlement` lives in `packages/shared` (pure, no DB) → the override there **must be a per-call `applyConsumerFree` PARAM, NEVER an env-global** (an env read inflates admin + silently inverts the preserve-suite tests — see [16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H1). Pass `true` only from web consumer reads.
- **Lever 2 (`planFeatures` override) is DROPPED** — it's redundant (server gates already get `plan='PRO'` from lever 1) and high-blast-radius. Keep `planFeatures` pure/tier-literal. Mechanism = **two** param-gated overrides: `getUserPlan` + `getEffectiveEntitlement`. ([16](16-LOGIC-HOLES-AND-EDGE-CASES.md) H2)
- **Admin must read the RAW entitlement (`applyConsumerFree:false`)** so manual grants, expiries, real tiers, and warnings stay truthful.

> ⚠️ **An adversarial logic audit ([16](16-LOGIC-HOLES-AND-EDGE-CASES.md)) found 8 high-severity traps** beyond the levers — read it before implementing. Headliners: concurrent-plan gate dead-ends the whole base (H4); future paid tiers end up worse than free (H5); `UNLIMITED=MAX_SAFE_INTEGER` removes the abuse ceiling (H6); caches replay gated screens after the flip (H7).

## Scope map — which report covers what

| Report | Surface |
|---|---|
| [01-ENTITLEMENTS-AND-GATES](01-ENTITLEMENTS-AND-GATES.md) | The 3-point switch + every server gate (moving, tasks, addresses, services, providers, seats, AI, dossier, exports, reminders) |
| [02-WEB-APP](02-WEB-APP.md) | Logged-in web app: dashboard teasers, upsell modals, in-app pricing/billing surfaces |
| [03-MARKETING-HOMEPAGE](03-MARKETING-HOMEPAGE.md) | Homepage, /pricing, how-it-works, faq, about, contact; PricingSection rebuild |
| [04-BLOG-CONTENT](04-BLOG-CONTENT.md) | Blog system, seed posts, per-article CTA, llms.txt discovery notes |
| [05-SEO-GEO](05-SEO-GEO.md) | JSON-LD/Offer/FAQ schema, metadata, sitemap, robots, llms.txt, GEO state/metro pages |
| [06-MOBILE](06-MOBILE.md) | Mobile onboarding, dashboard gates, subscription screen, teaser cards, copy |
| [07-APPLE-APP-STORE](07-APPLE-APP-STORE.md) | EAS flags, IAP code, App Store Connect manual steps |
| [08-GOOGLE-PLAY](08-GOOGLE-PLAY.md) | Play subscriptions, base plans, data safety, listing manual steps |
| [09-PAYMENTS-BILLING-PRESERVED](09-PAYMENTS-BILLING-PRESERVED.md) | The explicit DO-NOT-TOUCH list (Stripe/IAP/admin/emails/acquisition) |
| [10-ANALYTICS-FLAGS](10-ANALYTICS-FLAGS.md) | 7 new events + pipeline; future-monetization feature-flag stubs |
| [11-COPY-I18N](11-COPY-I18N.md) | Free/Concierge/Business rename map across en/es web+mobile + literals + emails |
| [12-TESTS](12-TESTS.md) | Tests to update (gating-policy) vs preserve (billing/security) |
| [13-RISKS-ROLLBACK](13-RISKS-ROLLBACK.md) | Risks, cost exposure, store coordination, rollback |
| [14-EXECUTION-CHECKLIST](14-EXECUTION-CHECKLIST.md) | Ordered, phase-by-phase execution checklist (code + manual) |
| [15-COST-CACHE-LIMITS](15-COST-CACHE-LIMITS.md) | **Preserve** caching + cost/API/abuse/rate limits (free ≠ unlimited spend) |
| [16-LOGIC-HOLES-AND-EDGE-CASES](16-LOGIC-HOLES-AND-EDGE-CASES.md) | **Adversarial audit** — inverse-logic traps, edge cases, mechanism corrections (read before coding) |
| [17-TEST-MATRIX](17-TEST-MATRIX.md) | Full flag×user×surface×feature matrix + invariants + which tests change/add |
| [18-OPEN-ITEMS](18-OPEN-ITEMS.md) | **Düzeltilecekler & açık kararlar** — consolidated open-decisions + must-fix register |
| [19-MONETIZATION-ENGINE](19-MONETIZATION-ENGINE.md) | **The revenue half** — category-based partner marketplace (affiliate + lead-gen + sponsored); spine already exists |

## Net impact at a glance
- **Code edits are concentrated**: ~3 entitlement levers + UI teaser/onboarding cleanup + marketing/SEO copy + analytics events + flag stubs.
- **Manual/console work is real**: App Store Connect, Google Play Console (listings, products, privacy labels), admin DB (acquisition campaigns, email templates), Search Console re-index.
- **Nothing is deleted**: every paid-tier scaffold becomes dormant, ready for Concierge/Business later.
