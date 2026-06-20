# 05 · SEO & GEO

The paid model is baked into **machine-readable metadata** in three places that must be neutralized so Google / answer-engines stop surfacing stale prices & trials:
1. **Product/Offer JSON-LD** (`SoftwareApplication` with `offers`/`price`) on `/` and `/pricing` — emits real `$0 / $4.99 / $24` and plan names.
2. **FAQPage structured data** on `/`, `/pricing`, `/faq` — encodes free-trial / cancel / refund / free-plan-limits Q&A that becomes false.
3. **Discovery surfaces** — `sitemap` (`/pricing` priority 0.9), `llms.txt` / `llms-full.txt` ("Plans, trial details, billing, and refund context").

The **51 state guides + metro guides (GEO)** are mostly safe — their schema (Article/FAQ/HowTo/Breadcrumb) carries **no price** — only visible CTA copy ("Plans & pricing", "Trial length, renewal date, and price are shown before checkout") needs softening.

## JSON-LD / structured data

| Area | File | Line | Change | Type |
|---|---|---|---|---|
| `softwareApplicationSchema()` builder (optional Offer) | [components/seo/json-ld.tsx:126](apps/web/src/components/seo/json-ld.tsx) | 126 | **PRESERVE** builder; callers stop passing paid price (emit single `$0` Offer or omit) | preserve |
| Homepage SoftwareApplication offers array | [page.tsx:144](apps/web/src/app/page.tsx) | 144 | collapse to single `$0` Offer; drop Individual annual/monthly priced offers; stop importing `yearly/monthlyPriceUsd` for schema | seo |
| Homepage FAQPage (trial/cancel/refund) | [page.tsx:497](apps/web/src/app/page.tsx) | 497 | drop/rewrite trial/cancel/refund entries → "Is LocateFlow free? Yes…"; keep data/privacy entry | seo |
| /pricing SoftwareApplication `$24` Offer | [pricing/page.tsx:47](apps/web/src/app/pricing/page.tsx) | 47 | `price:'0'` or remove Offer; drop `INDIVIDUAL.yearlyPriceUsd` import | seo |
| /pricing metadata description | [pricing/page.tsx:14](apps/web/src/app/pricing/page.tsx) | 14 | "LocateFlow is free — every feature included… Concierge and Business coming soon." | copy/seo |
| /pricing FAQ source array | [pricing/page.tsx:32](apps/web/src/app/pricing/page.tsx) | 32 | rewrite trial/cancel/refund (shared i18n keys → fixes homepage too) | copy |
| Pricing FAQ i18n keys (en + es) | [i18n/messages/en.json:435](apps/web/src/i18n/messages/en.json) | 435 | **highest-leverage copy fix** — `faq_trial/cancel/refund_*` reused in rich-result markup; rewrite or remove (mirror es.json) | copy |
| /faq FAQPage + free-plan-limits | [faq/faq-data.ts:28](apps/web/src/app/faq/faq-data.ts) | 28 | rewrite "free plan = 3 addresses/10 providers, full plan requires Individual/Family/Pro" → "everything included free"; rewrite/remove billing/trial/refund group | seo |
| /faq metadata description | [faq/page.tsx:13](apps/web/src/app/faq/page.tsx) | 13 | drop "trials, refunds… mobile subscriptions" | copy |
| /faq linked-answer map | [faq/faq-content.tsx:19](apps/web/src/app/faq/faq-content.tsx) | 19 | keep map keys in sync if questions reworded | copy |
| Org/WebSite/Article/Breadcrumb/HowTo builders | [json-ld.tsx:69](apps/web/src/components/seo/json-ld.tsx) | 69 | **PRESERVE** — no price/plan fields | preserve |
| Sitewide Org/WebSite JSON-LD | [site-schemas.tsx:15](apps/web/src/components/seo/site-schemas.tsx) | 15 | **PRESERVE** | preserve |

## Discovery / crawl

| Area | File | Line | Change |
|---|---|---|---|
| llms.txt / llms-full.txt Pricing note | [public-ai-discovery.ts:10](apps/web/src/lib/public-ai-discovery.ts) | 10 | "LocateFlow is free — every feature included; Concierge/Business coming soon." Optionally add free line to `PRODUCT_SUMMARY`; bump `LLMS_LAST_UPDATED` |
| sitemap `/pricing` priority/changefreq | [sitemap.ts:37](apps/web/src/app/sitemap.ts) | 37 | keep indexable; optionally lower to `monthly` / ~0.6 (prices no longer churn) |
| robots.ts | [robots.ts:34](apps/web/src/app/robots.ts) | 34 | **PRESERVE** — keep `/pricing` + GEO crawlable |
| Default site title/description | [lib/seo.ts:4](apps/web/src/lib/seo.ts) | 4 | PRESERVE (optional: add "Free" to reinforce positioning) |

## GEO (state & metro programmatic SEO)

| Area | File | Line | Change |
|---|---|---|---|
| State guide CTA disclosure | [moving/[state]/page.tsx:529](apps/web/src/app/moving/[state]/page.tsx) | 529 | "Trial length, renewal date, and price are shown before checkout" → "LocateFlow is free — every feature included, no checkout." Keep "Start free" |
| State guide "Plans & pricing" link label | moving/[state]/page.tsx:495 | 495 | relabel "Pricing" / "Free — what's included"; keep target |
| Metro guide CTA disclosure | [moving/[state]/[city]/page.tsx:508](apps/web/src/app/moving/[state]/[city]/page.tsx) | 508 | same as state page (link label at 491) |
| GEO Article/FAQ/HowTo/Breadcrumb schema | moving/[state]/page.tsx:233 | 233 | **PRESERVE** — model-agnostic, no price |
| provider-coverage WebPage/FAQ | [provider-coverage/page.tsx:59](apps/web/src/app/provider-coverage/page.tsx) | 59 | PRESERVE — "price" refers to external providers, not plans |
| movers/apply (B2B) | [movers/apply/page.tsx:6](apps/web/src/app/movers/apply/page.tsx) | 6 | PRESERVE flag-gated stub (`MOVER_REGISTRATION_ENABLED`); keep noindex/flag-gated |

## Manual steps
- **Google Search Console**: after deploy, request re-crawl of `/`, `/pricing`, `/faq`; use Rich Results / URL Inspection to confirm no paid Offer / free-trial FAQPage remains. Resubmit `sitemap.xml`.
- Check Bing Webmaster / schema validators don't cache old priced offers.
- **Editorial DB content sweep** (not in repo): search published post bodies for "free trial", "$", "Individual/Family/Pro plan", "upgrade", "subscription".
- Bump `LLMS_LAST_UPDATED` + re-trigger `revalidatePath('/llms.txt'|'/llms-full.txt')`.
- Keep `MOVER_REGISTRATION_ENABLED` flag-gated/noindex until B2B launch.
