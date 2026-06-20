# 14 · Execution Checklist

Ordered, phase-by-phase. `[code]` = repo edit · `[manual]` = console/DB/external · `[verify]` = check. Nothing here is done yet.

## Phase 0 — Decisions & setup
- [x] **Everyone = PRO** (incl. Pro mobile theme). — decided
- [x] **Everything free, but caching + cost/API/abuse limits preserved** ([15](15-COST-CACHE-LIMITS.md)). — decided
- [x] **apiConnectors ON for all** (part of PRO) **with cost caps** — confirm cap numbers ([13](13-RISKS-ROLLBACK.md), [15](15-COST-CACHE-LIMITS.md)).
- [ ] Confirm final coming-soon names: **Concierge** / **Business** (and es localization).
- [ ] `[code]` Choose `CONSUMER_FREE` representation: DB flag (web) + env constant (shared). ([01](01-ENTITLEMENTS-AND-GATES.md))
- [ ] `[manual]` Create `CONSUMER_FREE` FeatureFlag row (`ALL`, enabled) and/or set `CONSUMER_FREE=1` env in each environment.

## Phase 1 — Entitlement switch (the core) ([01](01-ENTITLEMENTS-AND-GATES.md))
- [ ] `[code]` `getUserPlan` → full access for all (flag on); keep ladder as else.
- [ ] `[code]` `planFeatures`/`FEATURES` → PRO feature set for all (flag/param; shared pure).
- [ ] `[code]` `getEffectiveEntitlement` → post-process free/unknown → PRO; **leave provider-paid/refund/cancel/grace + admin branches untouched**.
- [ ] `[code]` Ensure admin reads RAW entitlement (`fullAccess:false`).
- [ ] `[verify]` New free account: create move plan, tasks, unlimited addresses/services, AI briefing, full dossier (+PDF, neighborhood), invite member. Provider-paid + refunded users still correct in admin.

### Phase 1b — Guardrails (do NOT regress) ([15](15-COST-CACHE-LIMITS.md))
> **Sequenced FIRST** (the agreed start). Full diff spec + locked numbers: [exec/STEP-1-GUARDRAILS.md](exec/STEP-1-GUARDRAILS.md) — custom-provider cap, durable per-section geo dossier cache, global circuit-breaker.
- [ ] `[verify]` Override path grants **no** rate-limit / AI-cap bypass (limits are IP/user-keyed, not plan-keyed — confirm untouched).
- [ ] `[verify]` Caching preserved: web maps/static LRU + dossier cache + SW cache; mobile offline/home-dossier/last-plan caches still cache-first.
- [ ] `[code]` Confirm per-user/day caps on AI generation + dossier external lookups + export/PDF; add generous ceilings + global spend alert where missing.
- [ ] `[code]` apiConnectors cost caps (per-user connector count + sync frequency) confirmed before enabling at scale.

## Phase 2 — In-app UI cleanup
- [ ] `[verify]` Web teasers dead (briefing, dossier, service-limit modal). ([02](02-WEB-APP.md))
- [ ] `[code]` Mobile onboarding: remove isPremium branch, service cap, teaser/ProShowcase, upgrade routes. ([06](06-MOBILE.md))
- [ ] `[code]` Mobile + web subscription screens → read-only "Free — everything included" + coming-soon.
- [ ] `[verify]` No flow opens an IAP/checkout sheet.

## Phase 3 — Marketing / pricing / SEO ([03](03-MARKETING-HOMEPAGE.md), [05](05-SEO-GEO.md))
- [ ] `[code]` Rebuild `PricingSection`: Free active + Concierge/Business coming-soon (waitlist CTA, no price/checkout).
- [ ] `[code]` Homepage + /pricing + /faq: JSON-LD → single `$0` Offer; FAQPage trial/cancel/refund reworded; metadata descriptions.
- [ ] `[code]` GEO state/metro + how-it-works CTA disclosure copy → all-free.
- [ ] `[code]` `llms.txt` pricing note + bump `LLMS_LAST_UPDATED`; sitemap `/pricing` freq/priority.
- [ ] `[code]` Blog per-article CTA supporting copy ([04](04-BLOG-CONTENT.md)).

## Phase 4 — Copy & i18n ([11](11-COPY-I18N.md))
- [ ] `[code]` Plan-name/trial/upgrade strings: web en+es, mobile en+es; hardcoded literals.
- [ ] `[code]` Legal/acquisition disclosure copy (with sign-off); check `TERMS_VERSION`.

## Phase 5 — Analytics & flags ([10](10-ANALYTICS-FLAGS.md))
- [ ] `[code]` Register 7 events in `phase1-experiment-analytics.ts`; emit (server: move_created/provider_added/address_task_completed; client: document_uploaded/offer_viewed/offer_clicked/concierge_interest_clicked).
- [ ] `[code]` Define 8 future-offer flags + `// TODO(monetization)` stubs (default off, fail-closed).

## Phase 6 — Comms / acquisition dormancy ([09](09-PAYMENTS-BILLING-PRESERVED.md))
- [ ] `[code]` Gate `trial-expiring` email + `trial-check` cron (free-access-ending + annual-renewal notices) to no-op.
- [ ] `[code]` `acquisition-campaigns` / public-trial-campaign route → return no public campaign.
- [ ] `[manual]` Admin: deactivate public acquisition campaigns (DB); deactivate/edit `trial-expiring` EmailTemplate row per env.

## Phase 7 — Stores (manual + flags) ([07](07-APPLE-APP-STORE.md), [08](08-GOOGLE-PLAY.md))
- [ ] `[code]` `eas.json` production: all three store-purchase flags = false.
- [ ] `[manual]` App Store Connect: keep products, disable advertising, App Review notes, listing copy, privacy labels.
- [ ] `[manual]` Play Console: keep subscriptions, disable purchases, listing copy, data safety.

## Phase 8 — Tests, docs, verify ([12](12-TESTS.md))
- [ ] `[code]` Update gating-policy tests; add reversibility + payer-integrity tests; preserve engine/security tests.
- [ ] `[verify]` `pnpm verify:typecheck` + suites in a deps-installed checkout / CI (worktree has no node_modules).
- [ ] `[code]` Update `docs/ai` Product Brain to record the pivot.
- [ ] `[manual]` Google Search Console re-crawl `/`,`/pricing`,`/faq`; resubmit sitemap; re-fetch `/llms.txt`.
- [ ] `[manual]` Update analytics funnels for the now-quiet upgrade/teaser events.

## Suggested PR slicing
1. **PR1** Entitlement switch + tests (Phase 1, 8-partial) — the functional core, flag-gated.
2. **PR2** In-app UI + mobile onboarding (Phase 2).
3. **PR3** Marketing/pricing/SEO/blog (Phase 3).
4. **PR4** Copy/i18n (Phase 4).
5. **PR5** Analytics + flags + comms dormancy (Phase 5–6).
6. **PR6** Store flags (Phase 7 code) + manual checklist handoff.
