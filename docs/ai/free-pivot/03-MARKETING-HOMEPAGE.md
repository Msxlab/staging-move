# 03 · Marketing Site & Homepage

The public marketing surface is built around a 4-tier paid model (Free teaser + Individual/Family/Pro, annual+monthly, 14-day trial, savings badges, upgrade CTAs, ~20-feature compare matrix). It must collapse to **one active "Free — everything included"** + **"Concierge" / "Business" coming-soon** placeholders, and every "upgrade/Pro-only/trial/price" value prop becomes "included for everyone."

The billing plumbing it calls (`resolveMarketingCtaTarget`, `getPublicSubscriptionOffersViewModel`, `BILLING_PLAN_DEFINITIONS`, Stripe checkout link-building) is **preserved but dormant** — public CTAs route to `/sign-up` / `/dashboard`, not checkout.

## Homepage · [apps/web/src/app/page.tsx](apps/web/src/app/page.tsx)

| Area | Line | Current | Change | Type |
|---|---|---|---|---|
| Hero "Cancel anytime" chip | 224 | implies paid sub | "Free — no credit card" (edit `landing.cancelAnytime`) | copy |
| Hero "Checkout terms" chip | 219 | "Checkout terms shown before purchase" (reused at 561) | "Free, full access — no purchase" (`landing.noCreditCard`) | copy |
| SoftwareApplication JSON-LD offers | 144 | Free $0 + Individual Annual $24 + Monthly $4.99 | single `$0` Offer; drop paid offers | seo |
| Imports `BILLING_PLAN_DEFINITIONS`/`TRIAL_DURATION_DAYS` | 36 | builds paid offers + FAQ | keep imports (infra) but stop rendering paid prices/trials | preserve |
| FAQ trial/cancel/refund entries | 107 | `pricing.faq_trial/cancel/refund_*` → FAQPage schema | reframe to free-access (shared keys → also fixes /pricing) | copy |
| Dossier showcase CTA | 347 | pitches PDF/neighborhood as Pro, links `/pricing` | "included for everyone" (see `dossier-showcase.tsx`) | copy |
| `<PricingSection>` mount | 460 | passes upgrade intent + paid offers | pass free CTA; rebuilt section | code |
| `primaryHref` CTA logic + comment | 93 | `/sign-up` vs `/dashboard`; comment "past the trial offer" | keep routing; fix comment | code |

## `/pricing` · [apps/web/src/app/pricing/page.tsx](apps/web/src/app/pricing/page.tsx)
- **Page becomes the canonical "Free active + Concierge/Business coming-soon" page.**
- `metadata` description (line 14) names Individual/Family/Pro + trial → rewrite to free positioning. (SEO → [05](05-SEO-GEO.md))
- SoftwareApplication JSON-LD `$24` Offer (line 47) → `$0` or drop. (SEO)
- FAQ (trial/cancel/refund) → free-access reframe.

## `PricingSection` (the big rebuild) · [apps/web/src/components/marketing/pricing-section.tsx](apps/web/src/components/marketing/pricing-section.tsx)

| Area | Line | Current | Change |
|---|---|---|---|
| 3 paid tier cards (PLAN_FEATURES/PLAN_COPY) | 31 | INDIVIDUAL/FAMILY/PRO cards + checkout CTAs | 1 active **Free** card (all features included) + **Concierge** + **Business** coming-soon cards (disabled/waitlist CTA, no price, no checkout) |
| Billing interval toggle + savings badge | 193 | Annual/Monthly + "save X%" | remove from public render |
| Trial badge / "after trial" / "Today: $0" | 271 | trial framing | remove; Free card = "$0 — everything included" |
| CTA labels ("Get …", "Upgrade") | (various) | upgrade/checkout intent | "Get started free" → `/sign-up`; coming-soon → waitlist/`concierge_interest_clicked` |
| `role="group"`+`aria-pressed` toggle | 204 | a11y billing toggle | removed with the toggle |

Coming-soon cards are a natural home for `offer_viewed`/`concierge_interest_clicked` analytics ([10](10-ANALYTICS-FLAGS.md)).

## Other marketing pages
- **how-it-works** [how-it-works/page.tsx:161](apps/web/src/app/how-it-works/page.tsx) — "Trial length, renewal date, price… at checkout" → all-free copy (HowTo schema unaffected). (Also in [05](05-SEO-GEO.md))
- **about** [about/page.tsx:8](apps/web/src/app/about/page.tsx) — optional relabel "Pricing" button; schema/metadata unaffected.
- **workspace-plans-section.tsx** [:136](apps/web/src/components/marketing/workspace-plans-section.tsx) — hardcoded "Family"/"Pro" + "Family & Pro" chip. Audit notes this component is **dead/never-rendered** — verify; if rendered, rename; if dead, ignore (flag only).
- **dossier-showcase.tsx** — reframe Pro/PDF/neighborhood pitch to "included." (mounted by homepage:347)

## Marketing CTA routing
- `resolveMarketingCtaTarget` / `getPublicSubscriptionOffersViewModel` — **preserve**, but they should return no public paid offer (driven by deactivating acquisition campaigns, see manual steps). Public CTAs → `/sign-up` (anon) / `/dashboard` (auth).

## Manual / admin steps
- **Acquisition campaigns are admin/DB-driven** (`acquisitionCampaign` table): an admin must deactivate/stop publishing the public Individual annual-trial and monthly-paid campaigns so `getPublicSubscriptionOffersViewModel` returns nothing public. (Data/admin action, not code.) See [10](10-ANALYTICS-FLAGS.md)/[09](09-PAYMENTS-BILLING-PRESERVED.md).
- Confirm final **"Concierge" / "Business"** labels for the coming-soon cards (orphaned `comingSoon`/`flagship` i18n keys exist).
- External paid-search/SEO ad copy + social bios (outside repo) → free-access message.

## Copy keys → [11-COPY-I18N](11-COPY-I18N.md) · SEO/JSON-LD → [05-SEO-GEO](05-SEO-GEO.md)
