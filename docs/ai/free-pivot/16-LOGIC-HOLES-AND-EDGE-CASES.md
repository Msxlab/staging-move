# 16 · Logic Holes, Inverse-Logic Traps & Edge Cases

Output of an adversarial audit of the pivot plan ("everyone PRO / everything free / preserve cache + cost limits", no existing payers). These are things that **break, are inconsistent, go stale, or enable abuse** — fix before/with implementation. Severity: 🔴 high · 🟠 medium · 🟡 low.

---

## 🔴 H1 — The override MUST be a per-call param, NOT an env-global (mechanism correction)
`getEffectiveEntitlement` / `planFeatures` are in `packages/shared` and are imported by **web AND admin AND the preserve-suite tests**. If the `CONSUMER_FREE` override is read from `process.env` *inside* these pure functions:
- **Admin truth breaks** — admin ([user-detail-client.tsx:933](apps/admin/src/app/(admin)/users/[id]/user-detail-client.tsx), [workspace-seats.ts:31](apps/admin/src/lib/workspace-seats.ts), admin workspaces routes) calls the same function → every free/refunded/expired user shows as PRO ACTIVE; admin seat math inflates. Violates the "admin reads RAW" rule.
- **Preserve-suite silently inverts** — [packages/shared/src/__tests__/entitlement.test.ts](packages/shared/src/__tests__/entitlement.test.ts) + `workspace-entitlements.test.ts` call the pure fns with no flag; if `CONSUMER_FREE` leaks into the test env, their negative-access assertions flip.
- **Marketing/comparison inverts** — `plan-compare-table.test.tsx`, `pricing-section.test.tsx`, dossier `route.test.ts` call `planFeatures('FREE_TRIAL'/...)` expecting per-tier results; an env-global makes every column "included."

**Fix:** thread an explicit `applyConsumerFree`/`fullAccess` **boolean param** (default `false`) into `getEffectiveEntitlement` (and the `getUserPlan` override). Pass `true` ONLY from **web consumer read paths** (`getUserPlan`, `buildUnifiedEntitlementSnapshot`/`/api/profile`, mobile snapshot). Admin, marketing, comparison, and tests pass `false`/omit. Add a test asserting admin call sites never set it true.

## 🔴 H2 — Lever 2 (`planFeatures` override) is redundant AND high-blast-radius → drop it
Every server feature gate calls `planFeatures(userPlan.plan)` where `userPlan.plan` is already `'PRO'` from lever 1 ([request-entitlements.ts:24](apps/web/src/lib/request-entitlements.ts), [briefing/route.ts:168](apps/web/src/app/api/onboarding/briefing/route.ts), [dossier/route.ts:479](apps/web/src/app/api/addresses/[id]/dossier/route.ts), pdf, export). So overriding `planFeatures` itself does **no useful work** on servers and only risks inverting marketing/tests. **Keep `planFeatures` pure/tier-literal.** Mechanism collapses to **two** param-gated overrides: `getUserPlan` (→ plan PRO, limits, hasPremium/isActive) and `getEffectiveEntitlement` (→ effectivePlan PRO for the snapshot/mobile + seat math). *(Supersedes the "3 levers" framing in [01](01-ENTITLEMENTS-AND-GATES.md)/[00](00-OVERVIEW.md): lever 2 is dropped.)*

## 🔴 H3 — Seats need BOTH `getUserPlan` AND `getEffectiveEntitlement` overridden (half-open trap)
Invitation seat gate ([invitations/route.ts:100](apps/web/src/app/api/workspaces/[id]/invitations/route.ts)) reads `getEffectiveEntitlement(ownerSub).effectivePlan` then `seatLimitForPlan(plan)`. If only `getUserPlan` (lever 1) is done and `getEffectiveEntitlement` is skipped, a free owner still resolves `FREE_TRIAL` → seat 1 → **everyone still blocked from inviting** (silent half-open feature). Must apply the param override in `getEffectiveEntitlement` too. Existing `invitations/route.test.ts` mocks `seatLimitForPlan`/`getEffectiveEntitlement` so it can never catch this — add a real free-owner test.

## 🔴 H4 — Concurrent-plan gate = universal dead-end (the ONE place "unlimited" isn't)
[POST /api/moving:99](apps/web/src/app/api/moving/route.ts) caps active (PLANNING/IN_PROGRESS) plans at `planFeatures(PRO).concurrentPlanLimit = 3` and returns **HTTP 200** `{entitled:false, upgradeRequired:"CONCURRENT_PLAN_LIMIT"}` (no `code`, not a 4xx). After the pivot **every** account is PRO, so the entire base hits this at the 4th active move. None of the 4 create entry points handle this shape → generic "plan could not be created / Retry" loop:
- web onboarding [onboarding-client.tsx:811](apps/web/src/app/onboarding/onboarding-client.tsx), web [moving/new/page.tsx:240](apps/web/src/app/(app)/moving/new/page.tsx), mobile [moving/new.tsx:285](apps/mobile/app/moving/new.tsx), mobile [onboarding.tsx:838](apps/mobile/app/onboarding.tsx).
- Inverse-logic: its CTA says "upgrade to Pro for multiple moves" — but PRO is the universal ceiling; **nowhere to upgrade.**

**Fix:** under `CONSUMER_FREE`, raise `concurrentPlanLimit` to unlimited (or skip the gate). If kept as a cost guard, return a real 4xx with a `code` the clients understand and drop the "upgrade" CTA.

## 🔴 H5 — Future provider-paid user ends up WORSE than a free user (payer-floor trap)
Override lifts only *non-provider-paid* users to PRO. A real paying **INDIVIDUAL** (seat 1, no aiBriefing/realMap/neighborhood/dossierPdf) or **FAMILY** (seat 6, no neighborhood/PDF/movers) would get **fewer features than a free user** once Concierge/Business launch — a churn/refund hazard (cancel to get more). **Fix/policy:** when `CONSUMER_FREE` is on, floor every provider-paid user to **≥ the free-PRO baseline**. Add a payer-integrity invariant test (paid tier feature/seat/cap ≥ free floor). *(No payers today, but the override + future tiers make this latent.)*

## 🔴 H6 — Abuse ceiling: `UNLIMITED = MAX_SAFE_INTEGER` is the absence of a cap
- **Custom providers**: [canCreateCustomProvider:380](apps/web/src/lib/plan-limits.ts) has **no count check at all** on the active path (only a 90/5min rate limit + a 10-pending-*review* cap that doesn't cover local rows) → one free account ≈ 26k local provider rows/day, forever.
- **Addresses/services**: `count >= UNLIMITED` never trips; only velocity limits (addresses 20/min ≈ 28.8k/day, services 120/5min ≈ 34.5k/day). Each address can trigger geocoding/dossier cost.
- Free accounts are cheap to mint (IP/email rate-limited signup only).

**Fix:** make "unlimited" a **sane high finite abuse cap** (e.g. addresses ~1–2k, services ~5–10k, custom providers ~1–2k per owner) so the existing `count>=limit` branch still trips for pathological accounts but never affects real users; add a per-owner count check to custom providers. Keep rate limits. (Abuse ceiling ≠ paywall.) → extends [15](15-COST-CACHE-LIMITS.md).

## 🔴 H7 — Cache serves pre-flip gated payloads after the flip (web 10 min, mobile 30 min)
No entitlement-bearing cache is keyed by plan/flag; there is **no invalidation hook** (only logout clears caches).
- **Web dossier**: route sends `Cache-Control: private, max-age=600` on the **preview/gated** body ([dossier/route.ts:96](apps/web/src/app/api/addresses/[id]/dossier/route.ts)); the card uses a raw `fetch()` with no revalidation ([home-dossier.tsx:1355](apps/web/src/components/dashboard/home-dossier.tsx)) → browser replays the locked teaser for up to 10 min after flip.
- **Mobile dossier**: [home-dossier-cache.ts:33](apps/mobile/src/lib/home-dossier-cache.ts) keyed by `mode+addressId` only, cache-first within 30 min → returning free user sees "Unlock with Individual" teaser for up to 30 min, no network call.
- **last-plan-cache** ([:49](apps/mobile/src/lib/last-plan-cache.ts)) seeds a FREE hero + candy accent on first paint after flip (the very flash it was built to kill); inverse on rollback seeds PRO for a now-free user.

**Fix:** add an **entitlement epoch** to `/api/profile` (+ snapshot); persist last-seen epoch per client; on mismatch run a scoped purge (React Query `removeQueries` for gated keys; mobile clear `home-dossier.*`/`detail.*`/last-plan hint). Include the epoch in dossier/snapshot cache keys. Critically, **do NOT send a positive `max-age` on gated/preview payloads** (`no-store`) so the browser can't replay a gated frame. Treat the global flag flip as an epoch bump. Symmetric handling on rollback. *(SW verified NOT a vector — it skips `/api/`; keep it that way.)* → extends [15](15-COST-CACHE-LIMITS.md).

## 🔴 H8 — Web↔mobile cap mismatch + un-buyable upgrade CTA
Web lever 1 returns `UNLIMITED`; mobile reads its own pinned mirror ([plan-comparison.ts:57](apps/mobile/src/lib/plan-comparison.ts)) `PRO = 25 addresses / 1000 services` and **hard-blocks client-side** ([addresses.tsx:271](apps/mobile/app/(tabs)/addresses.tsx), [services.tsx:381](apps/mobile/app/(tabs)/services.tsx)) with an Alert routing to `/settings/subscription` — a tier nobody can buy. So a 26th address works on web but is blocked on mobile, pointing at a dead upgrade.

**Fix:** align — pick **PRO-caps-everywhere** (web also caps at the same finite numbers — consistent with H6's finite abuse cap) OR truly-unlimited-everywhere (mobile reads server cap; update the drift test `plan-comparison.test.ts`). Replace the mobile "Upgrade" alert with a neutral "contact support for more capacity." *(Recommendation: one finite abuse cap shared by web + mobile — kills H6 and H8 together.)*

---

## 🟠 Medium
- **M1 — Snapshot contradictory state.** [buildUnifiedEntitlementSnapshot:159](apps/web/src/lib/billing.ts) sets `status` from the RAW row but `isActive`/`plan` from the override → a full-access user can see "FREE_ACCESS_EXPIRED → Choose a plan to continue" banners in [subscription-management.tsx](apps/web/src/components/settings/subscription-management.tsx) (branches at :147/:422/:578). Fix: under fullAccess, normalize the snapshot status the UI reads (or have the UI key only off `isActive`/`plan`). Add a consistency test.
- **M2 — UNLIMITED sentinel in UI.** [service-usage-indicator.tsx:30](apps/web/src/components/shared/service-usage-indicator.tsx) renders `3 / 9007199254740991` + ~0% bar; [service-limit-upsell.tsx](apps/web/src/components/shared/service-limit-upsell.tsx) echoes current/limit + hardcodes PRO=25. Add a shared `isUnlimited()` guard; hide count/bar or show "N tracked" at the abuse cap. (Today they only render off the now-never-fired 403 — but unsafe by construction.)
- **M3 — Setup-grace cap silently removed.** `canCreate*` `!isActive` → `isInSetupGrace` branches ([plan-limits.ts:229](apps/web/src/lib/plan-limits.ts)) go dead (isActive always true) → the 3-address onboarding/setup-import cap disappears (now PRO/abuse cap). Confirm acceptable; if a tighter setup cap is wanted, re-express it independent of `isActive`.
- **M4 — weatherDigest cron email blast.** [weekly-digest/route.ts:87](apps/web/src/app/api/cron/weekly-digest/route.ts) + move-week-alerts gate on `weatherDigest` → everyone PRO → whole base emailed + NWS lookups. Add a per-user/day digest cap; assert recipient count in a cron test (both flags). → [15](15-COST-CACHE-LIMITS.md)
- **M5 — Cost-guardrail bypass untested.** No test proves the override grants no rate-limit/AI-cap exemption. Add: flag-ON new user → 4th `export_pdf` = 429; AI past `DAILY_AI_GENERATION_CAP` → rule-based; a guard test that rate-limit/AI-cap code references no `plan`/`hasPremium` symbol.

## 🟡 Low (cleanup / dead-but-confusing)
- **L1** Onboarding free-teaser branches + `writeFreeMovePreviewContext` + dashboard `freeMovePreview` go dead (pure upsell UI). Gate out or leave dormant; update `ux-experiments.test.ts`. ([onboarding-client.tsx:995](apps/web/src/app/onboarding/onboarding-client.tsx))
- **L2** `shouldShowOnboardingTeaser` `variant==='variant'` returns true even for premium → if the UX flag is left on "variant", ALL users get an extra paid-teaser interstitial before create. Pin/retire the experiment to "control" before launch. ([ux-experiments.ts:60](packages/shared/src/ux-experiments.ts))
- **L3** Trial-check/checkout-cleanup crons correctly mutate raw rows (keep) but their outbound "you'll be charged" notices must be gated dormant ([trial-check/route.ts:85,151](apps/web/src/app/api/cron/trial-check/route.ts)) — already in [09](09-PAYMENTS-BILLING-PRESERVED.md)/[11](11-COPY-I18N.md); just confirm.
- **L4** Free-only analytics (`planTier:'free'`, `move_teaser_viewed`, `UPGRADE_CLICKED`) stop firing — expected; audit dashboards so it doesn't read as a regression. → [10](10-ANALYTICS-FLAGS.md)
- **L5** Mobile add-all-essentials math is safe at a finite cap; only the now-permanently-false "Limit reached" label is dead copy → [06](06-MOBILE.md).
- **L6 (doc bug)** `entitlement.test.ts` is at `packages/shared/src/__tests__/entitlement.test.ts` (not `src/` root) — fixed in [01](01-ENTITLEMENTS-AND-GATES.md)/[12](12-TESTS.md). And `planFeatures` has **no** `fullAccess` param today — it's new work; inventory all call sites and label each "entitlement read (override)" vs "tier-literal (never override)".

## Net mechanism correction (carry into implementation)
1. **Two param-gated overrides only**: `getUserPlan` + `getEffectiveEntitlement`, via an explicit `applyConsumerFree` boolean passed by web consumer reads. **Drop the `planFeatures` global override (H2).** Keep `planFeatures` pure.
2. **Finite abuse caps** instead of `MAX_SAFE_INTEGER`, shared web↔mobile (H6+H8).
3. **`concurrentPlanLimit` unlimited under the flag** (H4).
4. **Payer-floor invariant** for future tiers (H5).
5. **Cache epoch + no-store on gated payloads + flip purge** (H7).
6. Everything still **param-gated & reversible**; admin always raw.
