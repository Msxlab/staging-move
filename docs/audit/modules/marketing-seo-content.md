# Module Audit: Marketing Homepage, SEO & Legal Content

> Read-only audit. Evidence cites source code paths relative to repo root
> `C:/Users/Windows/Desktop/Staging/staging-move`. Items that could not be
> confirmed from code are marked **[needs verification]**.

## 1. Module Summary

This module covers the public, unauthenticated surface of LocateFlow (Next.js 16
App Router web app): the marketing homepage, the supporting marketing pages
(`/about`, `/features`, `/pricing`, `/how-it-works`, `/why-free`, `/provider-coverage`,
`/faq`, `/help`, `/contact`), the programmatic-SEO moving guides
(`/moving/<state>` and `/moving/<state>/<city>`), the legal/policy pages
(`/terms`, `/privacy`, `/cookie-policy`, `/disclaimer`, `/refund`, `/billing-policy`,
`/data-deletion`, `/acceptable-use`, `/dpa`, `/security`, `/ccpa-privacy-notice`),
the machine-readable SEO surfaces (`robots.ts`, `sitemap.ts`, `llms.txt`,
`llms-full.txt`, `opengraph-image.tsx`, blog RSS/Atom), and the public-facing
capture/consent/tracking APIs (`/api/leads`, `/api/waitlist`, `/api/consent`,
`/api/consent/ccpa`, `/api/tracking/*`, `/api/legal/acceptance`, `/api/unsubscribe`).

Overall the SEO and legal infrastructure is unusually mature: JSON-LD is XSS-safe,
no-index environment gating is layered (env + request host), the FAQ structured
data is derived from the same source as the rendered copy, the consent/tracking
endpoints are PII-aware and consent-gated, and the unsubscribe flow is CSRF-safe.
The material risks are content/consistency rather than code defects:

1. **Free-tier messaging is internally contradictory by default.** `/why-free`
   unconditionally markets a $0 core move while the default (flag-off) `/pricing`
   and `/faq` describe paid Individual/Family/Pro plans and per-plan limits.
2. **Legal entity name and mailing address are placeholders** that fall back to a
   product name / "to be finalized" copy unless production env vars are set — a
   launch-blocking legal-completeness gap.
3. **An unsourced "4.9 on the App Store" rating claim** is hard-coded on the
   homepage hero (FTC/endorsement exposure).
4. **The default OG image renders an "M" glyph** as the brand mark instead of the
   LocateFlow logo — a brand inconsistency on every social share that lacks a
   page-specific image.

## 2. Related Files

SEO infrastructure / libs:
- `apps/web/src/lib/seo.ts` — canonical URL resolution, no-index gating, metadata factory
- `apps/web/src/lib/public-ai-discovery.ts` — llms.txt / llms-full.txt builders, public doc list
- `apps/web/src/lib/marketing-cta.ts` — state-aware pricing CTA target resolver
- `apps/web/src/lib/legal.ts`, `apps/web/src/lib/legal-info.ts`, `apps/web/src/lib/legal-acceptance.ts`
- `apps/web/src/lib/consent.ts`, `apps/web/src/lib/tracking-consent.ts`, `apps/web/src/lib/ccpa.ts`
- `apps/web/src/lib/blog/urls.ts`, `apps/web/src/lib/blog/queries.ts`
- `packages/shared/src/legal.ts`, `packages/shared/src/consumer-free.ts`

SEO route files:
- `apps/web/src/app/robots.ts`, `apps/web/src/app/sitemap.ts`
- `apps/web/src/app/opengraph-image.tsx`
- `apps/web/src/app/llms.txt/route.ts`, `apps/web/src/app/llms-full.txt/route.ts`
- `apps/web/src/app/blog/feed.xml/route.ts`, `apps/web/src/app/blog/atom.xml/route.ts`
- `apps/web/src/app/.well-known/{apple-app-site-association,assetlinks.json}/route.ts`

Pages:
- `apps/web/src/app/page.tsx` (homepage), `layout.tsx`
- `apps/web/src/app/{about,features,pricing,how-it-works,why-free,provider-coverage,faq,help,contact}/page.tsx`
- `apps/web/src/app/{terms,privacy,cookie-policy,disclaimer,refund,billing-policy,data-deletion,acceptable-use,dpa,security,ccpa-privacy-notice}/page.tsx`
- `apps/web/src/app/moving/[state]/page.tsx`, `apps/web/src/app/moving/[state]/[city]/page.tsx`
- `apps/web/src/app/unsubscribe/page.tsx`
- `apps/web/src/app/faq/{faq-content.tsx,faq-data.ts,faq-json-ld.tsx,structured-data.ts}`

Components:
- `apps/web/src/components/seo/{json-ld.tsx,site-schemas.tsx}`
- `apps/web/src/components/marketing/*` (header, footer, hero, hard-stats, social-proof, waitlist-form, early-access-capture, app-store-cta, pricing-section, public-page-shell, etc.)
- `apps/web/src/components/shared/cookie-consent.tsx`, `apps/web/src/components/tracking/google-analytics.tsx`

APIs:
- `apps/web/src/app/api/{leads,waitlist,consent,consent/ccpa,tracking/event,tracking/session,legal/acceptance,unsubscribe}/route.ts`

## 3. Related Routes / Screens

- Public homepage `/` (force-dynamic; session-aware CTA)
- Marketing: `/about`, `/features`, `/pricing`, `/how-it-works`, `/why-free`, `/provider-coverage`, `/faq`, `/help`, `/contact`
- Programmatic SEO: `/moving/<state>` (51 slugs), `/moving/<state>/<city>` (curated metros)
- Legal: `/terms`, `/privacy`, `/cookie-policy`, `/disclaimer`, `/refund`, `/billing-policy`, `/data-deletion`, `/acceptable-use`, `/dpa`, `/security`, `/ccpa-privacy-notice`
- Blog: `/blog`, `/blog/[slug]`, `/blog/category/[slug]`, `/blog/preview/[token]`
- Machine surfaces: `/robots.txt`, `/sitemap.xml`, `/llms.txt`, `/llms-full.txt`, `/opengraph-image`, `/blog/feed.xml`, `/blog/atom.xml`
- Public action: `/unsubscribe`

## 4. Related APIs

- `POST /api/leads` — auth-only, flag-gated, consent-required moving-quote lead (`apps/web/src/app/api/leads/route.ts`)
- `POST /api/waitlist` — IP-rate-limited, idempotent waitlist signup (`apps/web/src/app/api/waitlist/route.ts`)
- `GET/POST /api/consent` — append-only consent ledger (auth-only) (`apps/web/src/app/api/consent/route.ts`)
- `GET/POST /api/consent/ccpa` — Do-Not-Sell opt-out, works anonymously via cookie (`apps/web/src/app/api/consent/ccpa/route.ts`)
- `POST/PUT /api/tracking/event`, `POST/PATCH /api/tracking/session` — consent-gated analytics (`apps/web/src/app/api/tracking/*`)
- `POST /api/legal/acceptance` — auth-only legal acceptance record (`apps/web/src/app/api/legal/acceptance/route.ts`)
- `GET/POST /api/unsubscribe` — HMAC-token email opt-out (`apps/web/src/app/api/unsubscribe/route.ts`)

## 5. Related Components

- `JsonLd` + schema builders (`organizationSchema`, `webSiteSchema`, `softwareApplicationSchema`, `articleSchema`, `breadcrumbSchema`, `faqPageSchema`, `howToSchema`) — `apps/web/src/components/seo/json-ld.tsx`
- `SiteSchemas` (root-layout sitewide JSON-LD) — `apps/web/src/components/seo/site-schemas.tsx`
- `MarketingHeader`, `MarketingFooter`, `HeroPhoneShowcase`, `HardStats`, `SocialProof`, `RecognitionChipStorm`, `MovingMomentMock`, `DossierShowcase`, `BilingualShowcase`, `PricingSection`, `AppStoreCTA`, `LatestBlogPosts`, `EarlyAccessCapture`
- `WaitlistForm` (client) — `apps/web/src/components/marketing/waitlist-form.tsx`
- `CookieConsent` (client banner) — `apps/web/src/components/shared/cookie-consent.tsx`
- `GoogleAnalytics` (client, consent-gated) — `apps/web/src/components/tracking/google-analytics.tsx`

## 6. Related State / Hooks / Stores

- `WaitlistForm`: local `useState` for email/note/state/error; `useId` for a11y label wiring; posts to `/api/waitlist`.
- `CookieConsent`: `useState(visible)` + `useEffect` deferring banner 1.5s; reads/writes `localStorage` + `cookie_consent` cookie via `lib/consent.ts`.
- `GoogleAnalytics`: `useState(enabled)`, `useRef(lastPageView)`, subscribes to `COOKIE_CONSENT_CHANGE_EVENT`; gates pageviews behind `hasAnalyticsConsent`.
- Pending legal consents persisted in `sessionStorage` via `lib/legal.ts` (`readPendingLegalConsentsFromSession`, etc.).
- No global store for this module; marketing is server-rendered, capture is local component state.

## 7. Related Database / Models

- `BlogPost` (sitemap, llms.txt, feeds, blog pages — filtered `status:PUBLISHED, deletedAt:null, noIndex:false`)
- `Subscription` (read by `resolveMarketingCtaTarget` to pick CTA destination)
- `WaitlistSignup` (unique on `email_target`)
- `DataConsent` (append-only ledger; categories ANALYTICS/MARKETING/SENSITIVE/FUNCTIONAL/DO_NOT_SELL)
- `UserEvent`, `UserSession` (analytics persistence; consent-gated)
- `Lead` (via `createLead`), `Profile` (sensitive fields cleared on SENSITIVE consent revoke)
- `FeatureFlag` (`CONSUMER_FREE`, `FEATURE_API_CONNECTORS`, `WORKSPACE_MODEL_ENABLED`, offers flags)

## 8. Impact Map

- **UI:** Homepage hero, pricing/FAQ sections, marketing pages, legal pages, moving guides, cookie banner.
- **API:** leads, waitlist, consent, ccpa, tracking, legal acceptance, unsubscribe.
- **DB:** BlogPost, Subscription, WaitlistSignup, DataConsent, UserEvent/UserSession, Lead, Profile, FeatureFlag.
- **Auth:** Public surfaces are unauthenticated; capture/consent/tracking endpoints require auth except `/api/consent/ccpa` (intentionally anonymous-capable) and `/api/unsubscribe` (HMAC token instead of session).
- **Admin:** Waitlist signups + leads surface in admin views (per code comments).
- **Mobile:** Tracking-consent path differs for `x-client-type: mobile` (DB consent vs cookie); app-store CTA deep links.
- **Notifications:** Unsubscribe controls email opt-out; marketing emails reference `/unsubscribe`.
- **Integrations:** Stripe (subscription state for CTA), Google Analytics (consent-gated), Resend (email), AI crawlers (llms.txt/robots).
- **Analytics:** `UserEvent`/`UserSession`, GA4 pageviews, `trackEvent("waitlist_joined")`, route-derived events.
- **SEO:** robots, sitemap, canonical/hreflang, JSON-LD (Organization/WebSite/SoftwareApplication/FAQPage/Article/Breadcrumb/HowTo), OG/Twitter cards, llms.txt.
- **Tests:** `seo-launch-regression.test.ts`, `landing-accessibility-regression.test.ts`, `well-known.test.ts`, `faq/structured-data.test.ts`, blog `urls.test.ts`, `sanitize.test.ts`, `cookie-consent.test.ts`, `pricing-section.test.tsx`, `plan-compare-table.test.tsx`.

## 9. Buttons / Actions / Functions

**Homepage hero "Start your move - free" / "Go to Dashboard"** (`page.tsx:234-239`)
- Expected: anonymous → `/sign-up`; logged in → `/dashboard`.
- Actual: `primaryHref = userId ? "/dashboard" : "/sign-up"` — correct.
- Loading/disabled/error/success: N/A (plain link). Permission: session-derived. Edge: label text hard-coded "free" even when consumerFree flag is OFF and the move plan is actually paid (see FAQ copy). See marketing-seo-content-02.

**Pricing CTA (`PricingSection` via `resolveMarketingCtaTarget`)** (`marketing-cta.ts`)
- Expected: anonymous → `/sign-up` (intent `anonymous`); trialing/active/etc → `/settings/subscription` (manage); free/expired/canceled → `/settings/subscription` (upgrade).
- Actual: matches. `prisma.subscription.findUnique(...).catch(()=>null)` — DB failure degrades to `upgrade` intent (safe).
- Loading/disabled/error: server-resolved, no client state. Permission: session. Edge: a DB outage silently routes a manage-state user to the upgrade label; acceptable.

**WaitlistForm submit** (`waitlist-form.tsx:50-78`)
- Expected: POST `/api/waitlist`; show loading spinner, success card, or inline error.
- Actual: correct. `state==="loading"` guards re-entry (line 52); button `disabled` while loading; success swaps to confirmation; error rendered with `role="alert"`. `trackEvent` fires only on success.
- Edge: success state is **terminal** — once shown there is no path back to the form to add another email (acceptable for a single capture). Double-click guarded by the loading check. Server is idempotent on `email_target`.

**CookieConsent Accept / Decline / Dismiss (X)** (`cookie-consent.tsx:25-67`)
- Expected: Accept → store "accepted" + `consentGranted`; Decline/Dismiss → store "declined" + `consentDenied`.
- Actual: Accept and Decline correct. The X (close) button calls `handleDecline` (line 62) so dismissing defaults to **declined** — privacy-safe. Good.
- Edge: banner deferred 1.5s; if the user navigates before it appears, consent stays unset and analytics stays off (safe default).

**Contact page mailto links** (`contact/page.tsx`)
- Expected: open a prefilled email per request category.
- Actual: `mailto(item.email, item.subject)` — correct. No form, so no validation/loading/error states needed. Edge: the "Mailing address" block shows the legal-entity placeholder fallback (see marketing-seo-content-01).

**Unsubscribe confirm button** (`unsubscribe/page.tsx` → `POST /api/unsubscribe`)
- Expected: GET renders confirm step (no mutation); POST performs opt-out then 303 → `?done=1` read-only state.
- Actual: matches; HMAC token is the proof; bare GET / prefetch cannot opt a user out (well-designed).

## 10. UI/UX Audit

- **Footer copyright microcopy reads oddly.** `marketing-footer.tsx:69` renders
  ``&copy; {year} LocateFlow. {tCommon("privacy")}.`` producing
  "© 2026 LocateFlow. Privacy." — the privacy translation key is used as a
  standalone sentence, which reads as a stray word, not a rights statement.
  *Impact:* low polish issue on every public page footer. *Recommendation:* use a
  dedicated "All rights reserved." key. *Priority:* Low.
- **Default OG image shows an "M" brand glyph** (`opengraph-image.tsx:46`) for a
  product named "LocateFlow". Every social/link-preview share that falls back to
  the default image shows the wrong brand mark. *Recommendation:* render the
  LocateFlow logo mark or an "L". *Priority:* Medium (brand). See marketing-seo-content-03.
- **Hero trust chip "4.9 on the App Store"** (`page.tsx:249`) is a hard-coded,
  unsourced rating. *Priority:* High (legal/trust). See marketing-seo-content-04.
- **Hero CTA label "Start your move - free"** is always "free" even when the
  flag-off pricing is paid. *Priority:* Medium. See marketing-seo-content-02.
- **Bottom CTA subline mixes free + checkout copy.** `page.tsx:592` renders
  `t("trust_retention") · t("noCreditCard")` →
  "Export and deletion tools available in settings · Checkout terms shown before
  purchase". Under the consumerFree flag (everything free) the "checkout terms"
  half is misleading; under flag-off it is fine. Not flag-gated. *Priority:* Low/Medium.

## 11. Logic Audit

- **No-index gating** (`seo.ts:102-119`) is layered: explicit `APP_ENV` staging/preview/dev/test → noindex; unsafe public URL → noindex; production APP_ENV with safe canonical → index even if NODE_ENV is wrong. `robots.ts` and `llms.txt` additionally check the **request host** (`shouldBlockForRequestHosts`) so a staging host that slips a production canonical still serves `disallow: /`. Solid defense in depth.
- **Sitemap** (`sitemap.ts`) is `force-dynamic` specifically so a build-time DB outage cannot freeze an empty blog list into ISR — a deliberate, well-reasoned fix. DB failures are caught and logged (`console.warn`), degrading to the static+state+metro entries.
- **CTA resolver** correctly funnels eligible Free-Access users to the trial offer instead of silently past it (`page.tsx:92-95`, `marketing-cta.ts`).
- **Consent revoke side effect** (`consent/route.ts:121-137`): revoking SENSITIVE consent clears stored disability/immigrant/military profile fields in the same `$transaction` — prevents the ledger and stored data from drifting. Correct.
- **Free-tier copy is NOT centrally gated.** `consumerFree` is threaded through the
  homepage, `/pricing` metadata, and `llms.txt`, but `/why-free`, `/faq`
  (`faq-data.ts`), and the homepage bottom-CTA subline are NOT. Result: the
  *default* (flag-off) configuration ships contradictory free-vs-paid claims, and
  the *flag-on* configuration leaves `/faq` describing paid plans/limits. See
  marketing-seo-content-02 / marketing-seo-content-05.

## 12. Reverse Logic Audit

- **Unauthorized user:** all marketing/legal pages render publicly; `/api/leads`, `/api/consent`, `/api/tracking/*`, `/api/legal/acceptance` return 401 without a session; `/api/consent/ccpa` intentionally works anonymously (cookie); `/api/unsubscribe` uses HMAC token not session.
- **Empty data:** `LatestBlogPosts` renders nothing when no posts; sitemap/llms degrade to static entries; FAQ/legal are static.
- **API error:** waitlist/leads return typed 4xx/5xx; WaitlistForm surfaces server error message inline.
- **Slow network:** WaitlistForm shows spinner + disabled button; consent banner deferral avoids layout thrash.
- **Double-click:** WaitlistForm re-entry guard + idempotent server; leads endpoint computes an idempotency key including detail fields so a corrected resubmit is a new lead.
- **Stale data:** feature-flag cache TTL 60s (`feature-flags.ts`) — a flag flip can take up to a minute to reflect on marketing pages; acceptable.
- **Direct route access:** `/moving/<unknown>` hard-404s via `dynamicParams=false`; blog preview tokens are signed and `disallow`-ed in robots.
- **Mobile viewport:** hero/grids use responsive Tailwind breakpoints; cookie banner repositions for compact auth surfaces.
- **Dark theme:** marketing pages use semantic tokens (`bg-background`, `text-foreground`, `text-muted-foreground`); OG image is a fixed dark gradient (not theme-aware, expected).
- **Role change / token expiry:** marketing is public; capture endpoints recheck session per request.

## 13. Security Audit

### marketing-seo-content-06 — Anonymous DataConsent rows are non-rate-limited [needs verification on infra WAF] (Low)
- **Severity:** Low
- **Affected Area:** `POST /api/consent/ccpa` (`apps/web/src/app/api/consent/ccpa/route.ts`)
- **Evidence:** The CCPA opt-out endpoint has no `rateLimit(...)` call (compare `/api/leads`, `/api/waitlist`, `/api/legal/acceptance`, `/api/unsubscribe` which all rate-limit). For logged-in users each POST writes a new append-only `DataConsent` row (`ccpa/route.ts:93-104`); anonymous users only get a cookie set (no DB write).
- **Risk:** An authenticated client can spam toggle POSTs to inflate the append-only `DataConsent` table (storage/audit-noise amplification). Anonymous abuse only sets a cookie, so impact is limited.
- **Defensive Abuse Scenario (high-level):** A logged-in script loops the opt-out toggle to bloat the consent ledger and obscure genuine audit history.
- **Prevention:** Add an IP/user rate limit consistent with the other public POST endpoints.
- **Detection:** Alert on abnormal `DataConsent` insert rate per user.
- **Analysis (root cause):** Endpoint predates / omits the shared `rateLimit` wrapper the sibling endpoints use.
- **Recommendation:** Wrap with `rateLimit(getRateLimitKey(request, "consent:ccpa", {...}))`.
- **Tests To Add:** Endpoint test asserting 429 after N rapid POSTs.

### marketing-seo-content-07 — `/api/consent` POST has no rate limit (Low)
- **Severity:** Low
- **Affected Area:** `POST /api/consent` (`apps/web/src/app/api/consent/route.ts`)
- **Evidence:** No `rateLimit` call; each POST appends up to `CATEGORIES.length` rows (`consent/route.ts:102-113`).
- **Risk:** Authenticated ledger-bloat (same class as marketing-seo-content-06). Auth requirement caps blast radius.
- **Prevention/Recommendation:** Add a per-user rate limit. **Detection:** insert-rate alarm. **Tests:** 429-after-N.

### Positive security findings (no action)
- **JSON-LD XSS hardening** (`json-ld.tsx:34-41`, `faq/structured-data.ts:27-33`): `</` and U+2028/U+2029 escaped; nonce-stamped. Correct per OWASP.
- **Tracking PII scrubbing** (`tracking/event/route.ts:13-58`): key/value PII pattern filtering, email/long-digit value drop, length caps, phase-1 sanitizer. Strong.
- **Tracking session ownership** (`tracking/session/route.ts:79-89`): `updateMany where {id, userId}` prevents IDOR on session update.
- **Consent gating for analytics** (`tracking-consent.ts`): web requires `cookie_consent=accepted`; mobile requires a current `ANALYTICS` DataConsent row. Pageviews suppressed on sensitive prefixes (`google-analytics.tsx:19-32`).
- **Unsubscribe CSRF-safety** (`unsubscribe/page.tsx`, `api/unsubscribe/route.ts`): GET never mutates; opt-out only on token-bearing POST; rate-limited.
- **Leads** (`api/leads/route.ts`): auth + flag-gate (fail-closed) + `z.literal(true)` consent + rate limit + IP/UA hashing. Robust.
- **CCPA opt-out** cookie is `httpOnly`, `sameSite:lax`, `secure` per `shouldUseSecureSessionCookies()`.

### Minor: cookie_consent client cookie lacks `Secure`
- `lib/consent.ts:24` sets `cookie_consent` with `SameSite=Lax` but no `Secure`/`HttpOnly`. It is a non-sensitive consent flag set client-side (HttpOnly is impossible here), but `Secure` could be added in production. *Severity:* Info.

## 14. Performance Audit

- **All marketing/legal/moving pages are `force-dynamic`.** The 51 state pages +
  curated metro pages render on **every** request rather than being statically
  cached, because of a real CSP-nonce constraint (state page comment,
  `moving/[state]/page.tsx`). Functionally correct, but it forfeits static/ISR
  caching for high-volume programmatic-SEO pages, increasing TTFB and server cost
  under crawl/bursts. See marketing-seo-content-08. *[needs verification of CDN
  caching headers in front of these routes.]*
- Homepage issues 5 parallel awaits via `Promise.all` (`page.tsx:96-102`) — good;
  CTA resolver does one indexed `subscription.findUnique`.
- Sitemap caps blog at 5,000 and uses `select` projections — fine; will need a
  sitemap index past 5k (noted in code).
- OG image is edge-runtime `ImageResponse` — appropriate.
- Fonts: six Google font families loaded in `layout.tsx` (Geist, Geist_Mono,
  Fraunces, Playfair, DM_Sans, DM_Mono) with comments that Geist/Fraunces are
  legacy compatibility holdovers. This is extra font payload/CSS variables for
  fonts the design system says are superseded. See marketing-seo-content-09.
- `metaDescription` for state pages can exceed ~160 chars (`moving/[state]/page.tsx`
  template), risking SERP truncation. *Severity:* Info.

## 15. Reliability Audit

- `app/error.tsx` + `not-found.tsx` exist for the segment; legal/marketing are
  static so failure surface is small.
- Sitemap/category/blog queries are individually try/catch'd and logged
  (`sitemap.ts:116-141`) — partial DB failure degrades gracefully.
- `listLlmsBlogPosts` swallows errors → returns `[]` (`public-ai-discovery.ts:94-97`);
  acceptable for a discovery file.
- WaitlistForm has explicit error state; CTA resolver has `.catch(()=>null)`.
- Feature-flag loader returns the stale cache on DB error (`feature-flags.ts:45`),
  so marketing copy stays stable during a brief DB blip.
- No retry/backoff on client capture POSTs (single attempt) — acceptable for
  non-critical capture.

## 16. Dead Code / Cleanup

- **`testimonial-quote.tsx`** appears unused on the live homepage — `page.tsx:479-483`
  documents that the standalone `<TestimonialQuote/>` was intentionally removed
  (fabricated attribution). The component file still exists. **[needs verification]**
  that no other page imports it; if none, it is dead code that risks re-introducing
  the fabricated-testimonial issue. See marketing-seo-content-10.
- **Legacy fonts** (Geist, Geist_Mono, Fraunces) kept "for not-yet-migrated refs"
  (`layout.tsx:27-52`) — cleanup candidate once references are gone. **[needs
  verification]** of remaining usages.
- `SocialProof` renders `null` while placeholders remain (`social-proof.tsx:41-43`)
  — intentional safety gate, not dead code, but it ships a section that never
  displays until real testimonials exist.

## 17. Tests

Existing (read-only observed): `apps/web/src/app/seo-launch-regression.test.ts`,
`landing-accessibility-regression.test.ts`, `.well-known/well-known.test.ts`,
`faq/structured-data.test.ts`, `blog/urls.test.ts`, `blog/sanitize.test.ts`,
`components/shared/cookie-consent.test.ts`, `marketing/pricing-section.test.tsx`,
`marketing/plan-compare-table.test.tsx`, `phase1-ui-qa.test.tsx`.

Missing / suggested:
- **Free-tier consistency test:** assert that with `CONSUMER_FREE` ON, no public
  page (`/faq`, `/why-free`, homepage CTA subline) renders paid-plan/checkout copy;
  with it OFF, `/why-free` is reconciled with `/pricing`.
- **OG image brand test:** snapshot asserting the default OG mark is not "M".
- **Rate-limit tests** for `/api/consent` and `/api/consent/ccpa`.
- **No-index host test:** unit test for `shouldBlockForRequestHosts` across
  staging/production host mixes (some coverage may exist in seo-launch-regression).
- **Sitemap integrity test:** every `PUBLIC_AI_DOCS` path and every `POLICY_ROUTES`
  href appears in `sitemap.ts` staticRoutes (and vice versa) so the two lists can't
  drift. (`/help` is in llms.txt + sitemap but not `POLICY_ROUTES`; cross-list drift
  is currently manual.)
- **e2e:** waitlist happy path + duplicate idempotency; cookie banner decline keeps
  GA disabled; unsubscribe GET-no-mutation.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| marketing-seo-content-01 | High | Data | Legal entity name + mailing address are placeholders that fall back to product name / "to be finalized" copy if env unset | Legal pages (terms/privacy/contact/dpa) ship without a real legal entity/address — launch-blocking compliance gap | Set `NEXT_PUBLIC_LEGAL_ENTITY_NAME` / `NEXT_PUBLIC_COMPANY_ADDRESS` before launch; add a production readiness guard that fails if still placeholder | `lib/legal-info.ts:1-15`, `contact/page.tsx:124-130`, `.env.example:138-139` |
| marketing-seo-content-02 | Medium | Logic | Free-tier messaging contradicts default pricing: `/why-free` + homepage hero/CTA say core move is free/$0, but flag-off `/pricing` and `/faq` describe paid plans/limits | Confusing/contradictory marketing; potential deceptive-pricing exposure; weakens trust | Gate `/why-free` and homepage "free" CTA copy on `CONSUMER_FREE`, or reconcile the paid pages | `why-free/page.tsx:7-44`, `page.tsx:236,592`, `faq/faq-data.ts:27-31` |
| marketing-seo-content-03 | Medium | UI/UX | Default OG image renders an "M" glyph as the brand mark for "LocateFlow" | Wrong brand mark on every social/link-preview share lacking a page image | Replace the "M" with the LocateFlow logo mark / "L" | `opengraph-image.tsx:46` |
| marketing-seo-content-04 | High | Logic | Unsourced "4.9 on the App Store" rating hard-coded in hero | FTC/endorsement risk: an unsubstantiated rating claim shown to all visitors | Remove or back with a real, attributable store rating; gate behind a verified-config value | `page.tsx:249` |
| marketing-seo-content-05 | Medium | Logic | `/faq` page + its FAQPage JSON-LD always describe paid plans/trials/limits, not gated by `CONSUMER_FREE` | Under the free flag, FAQ rich results and on-page copy advertise paid plans that don't exist | Thread `consumerFree` into `faq-data.ts`/`structured-data` like the homepage/pricing | `faq/faq-data.ts:27-62`, `faq/structured-data.ts:37-54` |
| marketing-seo-content-06 | Low | Security | `POST /api/consent/ccpa` has no rate limit (authenticated rows append per call) | Authenticated ledger-bloat / audit-noise amplification | Add `rateLimit` consistent with sibling public POST endpoints | `api/consent/ccpa/route.ts:77-104` |
| marketing-seo-content-07 | Low | Security | `POST /api/consent` has no rate limit | Authenticated consent-ledger bloat | Add per-user rate limit | `api/consent/route.ts:85-139` |
| marketing-seo-content-08 | Low | Performance | All 51 state + metro programmatic-SEO pages are `force-dynamic` (no static/ISR cache) | Higher TTFB/server cost under crawl/burst on the highest-volume SEO pages | Verify CDN caching in front; if absent, explore static + nonce-free CSP or signed static nonces | `moving/[state]/page.tsx`, `moving/[state]/[city]/page.tsx` |
| marketing-seo-content-09 | Low | Performance | Three legacy font families (Geist, Geist_Mono, Fraunces) loaded alongside the canonical 3 | Extra font/CSS payload for superseded fonts | Remove once no references remain | `layout.tsx:27-52` |
| marketing-seo-content-10 | Low | Dead Code | `testimonial-quote.tsx` appears unused (removed from homepage due to fabricated attribution) [needs verification] | Risk of re-introducing a fabricated-testimonial component | Confirm no imports and delete, or keep behind a real-quote gate | `components/marketing/testimonial-quote.tsx`, `page.tsx:479-483` |
| marketing-seo-content-11 | Low | UI/UX | Footer copyright uses the "privacy" i18n key as a standalone sentence ("© 2026 LocateFlow. Privacy.") | Odd/unpolished copyright line on every public page | Use a dedicated "All rights reserved." key | `marketing-footer.tsx:69` |

## 19. Module TODO

- [ ] **marketing-seo-content-01 (High)** — Set/enforce real legal entity name + mailing address.
  - Reason: legal-page completeness/compliance. Files: `lib/legal-info.ts`, `contact/page.tsx`, all legal pages. Suggested fix: production readiness check that errors when values equal the placeholder; populate env. Dependencies: ops/legal sign-off. Complexity: low. Risk: low.
- [ ] **marketing-seo-content-04 (High)** — Remove/substantiate the "4.9 on the App Store" hero claim.
  - Reason: FTC/endorsement risk. Files: `page.tsx:249`. Suggested fix: delete chip or wire to a verified store-rating config. Complexity: low. Risk: low.
- [ ] **marketing-seo-content-02 (Medium)** — Reconcile free vs paid messaging across `/why-free`, homepage hero/CTA, `/pricing`, `/faq`.
  - Reason: contradictory pricing claims. Files: `why-free/page.tsx`, `page.tsx`, `faq/faq-data.ts`. Suggested fix: gate all "free" copy on `CONSUMER_FREE` or settle on one model. Dependencies: product decision on default flag state. Complexity: medium. Risk: medium (copy changes across pages).
- [ ] **marketing-seo-content-05 (Medium)** — Thread `consumerFree` into `/faq` content + structured data.
  - Reason: FAQ rich results must match the live offer. Files: `faq/faq-data.ts`, `faq/structured-data.ts`, `faq/page.tsx`. Complexity: medium. Risk: medium.
- [ ] **marketing-seo-content-03 (Medium)** — Fix default OG brand mark ("M" → LocateFlow logo).
  - Reason: brand correctness on shares. Files: `opengraph-image.tsx`. Complexity: low. Risk: low.
- [ ] **marketing-seo-content-06 / 07 (Low)** — Add rate limits to `/api/consent` and `/api/consent/ccpa`.
  - Reason: ledger-bloat protection. Files: both routes. Complexity: low. Risk: low.
- [ ] **marketing-seo-content-08 (Low)** — Confirm CDN caching for state/metro pages; revisit `force-dynamic`.
  - Reason: SEO-page perf/cost. Files: moving pages. Complexity: medium. Risk: medium (CSP interaction).
- [ ] **marketing-seo-content-09 (Low)** — Drop legacy fonts once unreferenced.
  - Files: `layout.tsx`. Complexity: low. Risk: low. Dependencies: verify no remaining CSS var refs.
- [ ] **marketing-seo-content-10 (Low)** — Verify and remove `testimonial-quote.tsx` if unused.
  - Files: component + grep callers. Complexity: low. Risk: low.
- [ ] **marketing-seo-content-11 (Low)** — Fix footer copyright microcopy.
  - Files: `marketing-footer.tsx`. Complexity: low. Risk: low.
