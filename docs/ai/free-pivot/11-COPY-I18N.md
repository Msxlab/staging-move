# 11 · Copy & i18n — Free / Concierge / Business

Plan-name copy lives in **three layers**. The central one renames most surfaces dynamically; the other two need direct edits. **Never rename the DB plan keys** (FREE_TRIAL/INDIVIDUAL/FAMILY/PRO) — only display names/copy.

## Layer 1 — Central display names (single highest-leverage edit)
[packages/shared/src/billing.ts:62](packages/shared/src/billing.ts) `BILLING_PLAN_DEFINITIONS[*].displayName` — `FREE_TRIAL="Free"`, `INDIVIDUAL="Individual"` (79), `FAMILY="Family"` (105), `PRO="Pro"` (129). Rendered dynamically by mobile subscription screen, mobile plan-comparison, web PricingSection (`def.displayName`), web compare table, admin.
- Change `displayName` to the Free/Concierge/Business story. Keep KEYS + price/isPaid fields. Also update `shortDescription` (63/80/106/130) and `features[]` arrays ("Everything in Individual/Family").
- **Naming model = "Free + coming-soon Concierge/Business"**: simplest is to keep DB display names as-is/dormant and present the coming-soon Concierge/Business as **pure marketing cards** in PricingSection (decoupled from DB keys), since they aren't sold. Decide with product (see [03](03-MARKETING-HOMEPAGE.md)).

## Layer 2 — i18n string values (edit VALUES, keep keys; en + es in lockstep)

### Web · [apps/web/src/i18n/messages/en.json](apps/web/src/i18n/messages/en.json) + es.json
- `pricing.plan_free_name`/`plan_individual_name`/`plan_family_name` (370,377,386); `pricing.individualName/familyName/proName` (407,414,422); `pricing.compare.planFree/Individual/Family/Pro` (447-450).
- `premiumReveal.tier_pro/family/individual` + `sub_*` (112-118) — post-purchase modal.
- Pricing **FAQ** `faq_trial/cancel/refund_*` (435+) — also feed FAQPage schema → highest SEO leverage ([05](05-SEO-GEO.md)).
- es.json mirrors: `plan_free_name="Gratis"`, `planFamily="Familiar"`, etc. (370,386,447,449,414,113) — localize Concierge/Business.
- `proShowcase_*` (1360) — delete if showcase removed, else neutral coming-soon.

### Mobile · [apps/mobile/src/i18n/messages/en.json](apps/mobile/src/i18n/messages/en.json) + es.json
- `settings.planFree/planIndividual/planFamily/planPro` (64-67); `dashboard.planIndividual/Family/Pro`; `pricing.title`/`cta_*` (1369); `subscription.upgradeTitle` "Unlock your move plan" (780).
- `teaser.unlockCta="Unlock with Individual"` / `unlockHint` (1041); `proShowcase_*` (1112); `moving_description` "preview" (1108); `providers_limitHint`/`limitReached`.
- es.json mirrors (113, 64-67 region, etc.).

## Layer 3 — Hardcoded component literals (not driven by i18n/billing.ts — direct edits)
- `pricing-section.tsx` — eyebrow chip "Individual, Family, Pro" (384), `PLAN_COPY` (100-115), `PLAN_FEATURES` "Everything in Family" (60-98).
- `workspace-plans-section.tsx` — `name="Family"`/`"Pro"`, "Family & Pro" chip (125,136,144) — **verify if rendered** (audit flagged it dead).
- `pricing/page.tsx` metadata (14); `about/page.tsx` "Pricing" button.
- Acquisition copy: `acquisition.ts` (4,151,213,230 — "Individual Annual", price labels, consent label), `scripts/lib/acquisition-campaign-sync.ts` (39,54), `acquisition-campaigns.ts` (213). ⚠️ Consent/disclosure strings have **evidentiary/legal value** — coordinate with legal; only swap tier noun, keep disclosure structure; check `TERMS_VERSION`.

## Emails (copy)
- `trial-expiring` template seed [email-templates.ts:241](packages/db/prisma/seed-data/email-templates.ts) — drop "annual plan is scheduled to start" framing (sender deactivated anyway → [09](09-PAYMENTS-BILLING-PRESERVED.md)).
- **Live email rows are admin-editable DB** (`EmailTemplate`) — already-seeded envs need a **manual** edit/deactivate.

## Manual / external copy
- App Store + Play **store listings** (description, what's-new, screenshots, promo) — console only ([07](07-APPLE-APP-STORE.md)/[08](08-GOOGLE-PLAY.md)).
- Admin labels (analytics/signups-trend/user-detail/workspaces `planLabel`) — **billing-keep**, internal; optional cosmetic realign later, keep DB keys as join keys.

## Rule of thumb
Edit **values not keys**; **en + es together**; never touch DB plan keys; legal/disclosure copy needs sign-off.
