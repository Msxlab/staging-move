# 19 · Monetization Engine — Category-Based Partner Marketplace

The "other half" of the free pivot: LocateFlow is free for consumers and earns by monetizing the **high-intent moving moment** — movers, renters insurance, internet setup, storage, cleaning/junk, utilities — via **affiliate click-out + lead-gen + sponsored placement**, by category.

> **TL;DR — the spine already exists.** A full affiliate click→conversion→payout pipeline, a sponsored-placement system (FTC-labeled), a complete mover registration+verification portal, a multi-signal recommendation engine, the category taxonomy, and Stripe/webhook rails are all built. The work is to **(1) generalize** the mover-only onboarding into a category-agnostic Partner, **(2) connect** the "partner registers" side to the "offer that earns" side, **(3) add a lead-gen layer** (the biggest new revenue, for movers/cleaners), and **(4) surface** offers in the high-intent surfaces that don't show them yet. This is **plan/notes only — no code.**

## 1) What already exists (reuse map)

| Building block | Where | Status |
|---|---|---|
| Affiliate fields on catalog | `ServiceProvider.affiliateUrl/affiliateNetwork/affiliateActive` [schema:734](packages/db/prisma/schema.prisma) | ✅ live (admin-curated) |
| Server-owned click attribution | `AffiliateClick` + [api/affiliate/click](apps/web/src/app/api/affiliate/click/route.ts) (no open-redirect, rate-limited, dedup, address attribution) | ✅ live (web list/detail/recommendation/services) |
| Conversion / commission ledger | `AffiliateConversion` + HMAC [api/affiliate/postback/[network]](apps/web/src/app/api/affiliate/postback/[network]/route.ts) (idempotent, PENDING→PAID) | ✅ live (inbound commission only) |
| Sponsored slot (FTC-labeled ad) | `SponsoredPlacement` (kind mover\|provider, category/state scope, flight window, counters) [schema:2334](packages/db/prisma/schema.prisma); `SPONSORED_ENABLED` flag | ✅ live for **movers**; `kind=provider` modeled, **not rendered** |
| Mover registration portal | `MoverApplication`→`MoverDocument`(R2)→admin FMCSA verify→`MovingCompany`; `MoverPortalToken` magic-link; partner dashboard | ✅ full, **FMCSA/USDOT-specific** |
| Recommendation engine | [recommendation-engine.ts](packages/shared/src/recommendation-engine.ts) multi-signal scorer, transitive comparator, RuntimeConfig weights | ✅ live — **deliberately ignores sponsorship** (integrity line) |
| Category taxonomy | `PROVIDER_CATEGORY_VALUES` (~70: utilities, internet, renters/home insurance, storage, moving, cleaning) | ✅ — **junk-removal missing** |
| Lead/email capture pattern | `WaitlistSignup` (target, source, notifiedAt/convertedAt) [schema:1784](packages/db/prisma/schema.prisma) | ✅ marketing only (not partner-routed leads) |
| Rails | Admin RBAC+audit, `FeatureFlag`, `RuntimeConfig`, `DataConsent`, `UserEvent`, Stripe `Subscription`+`ProcessedWebhookEvent` (idempotency) | ✅ reusable |
| Compliance | FTC "Sponsored" label mandatory on sponsored cards; "unverified directory data" warning; data-disclaimer pattern | ✅ partial |

## 2) Three revenue primitives (everything maps to these)

1. **Affiliate / click-out** — user clicks "Get started" → server-owned redirect → partner network pays per click/sale (CPC/CPA). Best for **companies with affiliate programs or just official sign-up links** (utilities, internet, insurance aggregators, storage brands, payment apps). *Mostly built.*
2. **Lead-gen** — user submits a structured quote request → routed to N registered local partners → partner pays **per lead** (CPL). Best for **local services that bid on jobs**: **moving companies, cleaners, junk removal**. *This is the biggest NEW build and the biggest revenue.*
3. **Sponsored placement** — a labeled "Sponsored" slot above/within organic results (CPM/flat/auction). Layerable on **any** category. *Built for movers; extend to all + surface in catalog.*

> Categories pick a mix: movers = lead-gen + sponsored; cleaning/junk = lead-gen + sponsored; utilities/internet/storage = affiliate + sponsored; insurance = affiliate/lead-gen (regulated) + sponsored.

## 3) Layered architecture

### Layer 1 — Affiliate / click-out (EXISTS → extend)
- Generalize `AffiliateClick` → a polymorphic **`ClickEvent`** (target = provider | offer | placement | partner; nullable user for anon; `utm`/`clickToken`; offer/placement ref). Keep the server-owned, no-open-redirect, dedup, rate-limit guarantees.
- **Monetize the unmonetized exits:** today when `affiliateActive=false` the user leaves via a raw `website`/phone link with no attribution ([detail-client.tsx:194](apps/web/src/app/(app)/providers/[id]/detail-client.tsx)). Add a **category-level fallback offer** (e.g. an internet-aggregator affiliate when the specific ISP has no deal).
- **Mobile parity:** extract a shared mobile affiliate CTA and put it on `ProviderCard`/`RecommendedRow`/list (today mobile only fires on detail [providers/[id].tsx:502](apps/mobile/app/providers/[id].tsx)).
- **Multiple offers per category:** affiliate config is one flat URL per provider — move offer economics to an `Offer` row (below) so a category can run competing partner offers.

### Layer 2 — Sponsored placement (EXISTS for movers → generalize + surface)
- Add a `kind=provider` (and new kinds) **reader** mirroring `getActiveSponsoredMover`, and render an FTC-labeled slot in the high-intent catalog/recommendation surfaces (§7). One labeled slot per surface; **never** mixed into organic ranking.
- Replace `SponsoredPlacement.targetId` (loose, no FK) with an **`Offer` FK**; add pricing/flight/budget to the Offer.

### Layer 3 — Lead-gen marketplace (NEW — biggest revenue)
- **`Lead`** model: category, structured payload (move date, from/to ZIP, home size, etc.), `partnerId`/`offerId` routed-to, attribution (`clickToken`/source), status `NEW|SENT|ACCEPTED|REJECTED|BILLED`, price (CPL), dedupe, **consent snapshot** (reuse the `AcquisitionRedemption` consent-snapshot pattern).
- **Capture:** a lead form on the high-intent surfaces (movers/cleaners "Get N quotes"). Generalize `WaitlistSignup`'s capture; add `CONCIERGE`/`PARTNER_INTEREST`/category targets.
- **Routing/delivery:** reuse the **`ConnectorDispatch` transactional-outbox pattern** ([schema:1981](packages/db/prisma/schema.prisma)) to deliver the lead to partners (email/webhook) with retry/idempotency.
- **Billing:** charge partners per accepted lead (Layer 4).

### Layer 4 — Partner platform (NEW — generalize the mover portal)
- **`Partner`** (category-agnostic: name, `category` enum incl. movers/cleaning/junk/utility/internet/insurance/storage, status, billing identity) — generalize `MovingCompany` (which stays as the FMCSA catalog feeding mover Partners).
- **`PartnerApplication`** / **`PartnerDocument`** / **`PartnerUser`(auth)** — generalize `MoverApplication`/`MoverDocument`/`MoverPortalToken`, parameterized by category (category-specific verification: USDOT for movers, license/COI for cleaners, etc.). Reuse the admin verification-queue + step-up pattern.
- **Self-serve:** partner dashboard showing **own** clicks/leads/conversions/spend (today only movers see sponsored counts; affiliate conversions are admin-only). Self-serve offer/placement purchase via **Stripe** (today placement = email-to-ops); reuse `ProcessedWebhookEvent` idempotency.
- **`PartnerInvoice`/`Payout`/`PartnerLedger`** — bill partners (placements/leads) and remit rev-share; roll up `AffiliateConversion` + lead/placement charges per partner per period. (None exist today.)

## 4) Category playbook

| Category | Revenue model | Reuse | Build |
|---|---|---|---|
| **Moving companies** | Lead-gen (CPL) + sponsored + featured listing | mover portal (full), `SponsoredPlacement(mover)`, FMCSA catalog | `Lead` + routing + CPL billing; surface lead form at the move moment |
| **Cleaning / junk removal** | Lead-gen (CPL) + sponsored | generic Partner onboarding template | generic `Partner`/`PartnerApplication`; **add junk-removal category**; lead form |
| **Utilities / internet / storage** | Affiliate (CPC/CPA) + sponsored | affiliate pipeline (live), catalog categories | per-category fallback offer, mobile CTA, `kind=provider` sponsored slot |
| **Renters / home insurance** | Affiliate or lead-gen (**regulated**) + sponsored | affiliate pipeline, disclaimer pattern | **state-eligibility gating + licensing/"not a binding quote" disclosure** (§9) |
| **Payment apps / banking / misc** | Affiliate | affiliate pipeline | offer rows only |

## 5) Data model — reuse + NEW
**Reuse:** `AffiliateClick`/`AffiliateConversion`, `SponsoredPlacement`, `MoverApplication`/`MoverDocument`/`MoverPortalToken` (as the template), `WaitlistSignup` (capture pattern), Stripe `Subscription`/`ProcessedWebhookEvent`, Admin*/`FeatureFlag`/`RuntimeConfig`/`DataConsent`, `ConnectorDispatch` (outbox for lead delivery).

**Add (generalize, don't re-clone per vertical):**
1. `Partner` (+ `PartnerCategory` if many-to-many) — category-agnostic partner account.
2. `PartnerUser`/`PartnerAuth` (generalize `MoverPortalToken`), `PartnerApplication` (generalize `MoverApplication`), `PartnerDocument` (generalize `MoverDocument`).
3. `Offer` (FK `Partner`: pricing `CPC|CPL|CPA|FLAT`, rate, budget/cap, creative, category/geo scope, schedule) + `Placement` (where an Offer renders; generalizes `SponsoredPlacement` with an `Offer` FK, replacing loose `targetId`).
4. `Lead` (FK `Partner`+`Offer`: payload, attribution, status, price, dedupe, consent snapshot) — generalize `WaitlistSignup`.
5. `ClickEvent` (polymorphic target, nullable user, offer/placement ref, utm/clickToken) — generalize `AffiliateClick`.
6. `PartnerInvoice`/`Statement` + `Payout`/`RevShare` + `PartnerLedgerEntry` (period rollup).
- Link the registration side to the money side: a `Partner` owns its `ServiceProvider` catalog row(s) and `Offer`s (today disconnected — the #1 structural gap).

## 6) High-intent surfaces to monetize (placement map)
1. **The move-task transition — `MoveTask.destinationProvider`** ("set up service with X at your new home" [schema:952](packages/db/prisma/schema.prisma)) — the **single most monetizable moment**; today renders **no** offer. Highest priority.
2. **Per-category "Best matches near {city}"** in [api/providers/recommendations](apps/web/src/app/api/providers/recommendations/route.ts) — inject one labeled sponsored slot per category cluster.
3. Provider detail + compare (affiliate CTA exists; add fallback offer + mobile parity).
4. Services screen / "Recommended for you" (web has CTA; mobile gap).
5. Movers list (sponsored live) + a **lead form** ("get N quotes").
6. Onboarding "smart setup" + post-move monitoring nudges.

## 7) Ranking integrity (hard rule — do not break)
The recommendation engine **deliberately does not weight sponsorship** (docs/sponsored-placements.md §8 "No selling organic rankings"). **Keep it that way.** Sponsored revenue comes from a **separate, FTC-labeled slot**, never from boosting organic order. This is both a trust and a (FTC) compliance asset — design every placement as an explicit labeled box, not a ranking lever.

## 8) Compliance (must-build before going live)
- **FTC affiliate / material-connection disclosure** adjacent to every affiliate "Get started" CTA (web + mobile) — currently **missing** (only sponsored placements and data-verification warnings exist). "We may earn a commission."
- **Regulated categories (insurance/financial):** licensing/producer-status disclosure, **state-eligibility gating**, "not a binding quote," possible state-by-state suppression. Attach **per-offer compliance copy** to the Offer/CTA (none today — every category renders the same generic CTA).
- **Lead consent:** capture an immutable consent snapshot when a user submits a lead that will be shared with partners (reuse `AcquisitionRedemption` pattern); update Privacy/Terms with the affiliate + lead-sharing clause.
- Keep the existing "unverified directory data, not an official partnership" honesty warning.

## 9) Analytics + partner reporting
- Register `offer_viewed` / `offer_clicked` / `lead_submitted` / `concierge_interest_clicked` in [phase1-experiment-analytics.ts](packages/shared/src/phase1-experiment-analytics.ts) (use `offer_key`, not `offer_name` — PII sanitizer). Funnel = view→click→lead→conversion; hard revenue stays on the `ClickEvent`/`AffiliateConversion`/`Lead` path (not the soft consented UserEvent log).
- **Partner-facing reporting for ALL partners** (today only movers see counts; affiliate conversions are admin-only): per-partner clicks/leads/conversions/spend, scoped by `PartnerUser` auth.
- EPC/revenue-per-surface reporting to optimize placement.

## 10) Feature-flag rollout (lowest-risk first)
1. **Surface what's already built** — turn on `kind=provider` sponsored slot + affiliate CTA mobile parity + the move-task offer (no new models; uses existing affiliate/sponsored). Flag: `offers_affiliate_v1`.
2. **Compliance** — affiliate disclosure + regulated-category gating (block before scaling). 
3. **Generic Partner + onboarding** (cleaning/junk first — simplest, no FMCSA). Flags: `offers_cleaning_junk_v1`, generalize `MOVER_REGISTRATION_ENABLED` → `partner_registration_v1`.
4. **Lead-gen** (movers first — portal exists): `Lead` + form + routing + CPL. Flags: `offers_moving_quotes_v1`.
5. **Self-serve partner billing + payout/invoicing** (Stripe Connect).
6. Insurance/financial last (regulatory load). Flags: `offers_renters_insurance_v1`.
All gated by the existing DB `FeatureFlag` (fail-closed); client surfaces get flags prop-drilled from the server snapshot (client-flag gap, [10](10-ANALYTICS-FLAGS.md)).

## 11) Open decisions → tracked in [18-OPEN-ITEMS](18-OPEN-ITEMS.md)
- Per-category pricing model + rates (CPC/CPL/CPA/flat) and who sets them.
- Self-serve advertiser checkout vs ops-managed sales (today email-to-ops).
- Lead-sharing consent + privacy/terms update scope (legal).
- Insurance/financial: license/agency model — affiliate-only vs licensed lead-gen (big legal call).
- Payout/rev-share mechanics (Stripe Connect vs manual).
- First category to launch (recommend: **affiliate surfacing + movers lead-gen** — both ride existing infra).

---
**Bottom line:** this is the revenue half of the strategy I recommended ([free is the enabler, this is the business]). The infra maturity means **first dollars are close** — surfacing the already-built affiliate/sponsored systems + a mover lead form earns before the full generic Partner platform is done.
