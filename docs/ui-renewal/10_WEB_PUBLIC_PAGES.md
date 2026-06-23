# 10 — Web Public / Marketing / Legal Pages

Theme-renewal inventory of every web surface under `apps/web/src/app` that is **NOT** in `(app)/` and **NOT** `api/`. One row per page from the authoritative `docs/audit/_inventory/web-pages.txt` list. Captures what EXISTS — shell, sections, components, theme handling, hardcoded values, responsiveness, brand usage, states. No redesign proposals.

Repo root: `C:/Users/Windows/Desktop/Staging/staging-move`. Paths below are relative to `apps/web/src/app/` unless noted. Companion docs: `01_THEME_SYSTEM.md` (tokens), `02_COMPONENT_CATALOG.md`, `03_BRAND_AND_LAYOUT.md` (shells, brand, fonts).

---

## 0. TL;DR — highest-signal facts for a reskin of the public surface

| # | Fact | Evidence |
|---|------|----------|
| 1 | **Three shell idioms only.** (a) `MarketingHeader`+`MarketingFooter` direct (home, pricing, help-loggedout, blog, moving guides); (b) `PublicPageShell` (every legal/info page + features/why-free/how-it-works/about/contact/faq/provider-coverage/account-delete); (c) **shell-less** standalone `<main>` (all auth pages, movers/partners apply + portals, onboarding, offline, unsubscribe, invitations, verify, blog/preview). | `public-page-shell.tsx`, `marketing-header.tsx`, per-page |
| 2 | **Nearly all public pages are token-only** (`bg-background`, `text-foreground`, `text-primary`, `bg-card`, `border-border`, `text-muted-foreground`, tone-`*` triplets, `text-success`/`text-destructive`). Light+dark both work via `next-themes`. | grep across `**/page.tsx` |
| 3 | **Hardcoded colors are rare and localized:** Google "G" SVG brand hexes (`#FFC107/#FF3D00/#4CAF50/#1976D2`) on `sign-in` + `sign-up`; the Google/Apple SSO buttons use raw `slate-*`/`white` utility classes (intentional brand-button styling, NOT tokens); `text-green-500` on `invitations/[token]` (raw, should be `text-success`); blog placeholder gradient fallback hex `#37C2C9` (`blog/page.tsx:137`). | §3 notes |
| 4 | **Legal/info pages are data-driven**, not hand-coded layouts. `terms`/`privacy`/`security`/`refund`/`disclaimer`/`billing-policy`/`acceptable-use`/`ccpa`/`dpa`/`cookie-policy` map a `LEGAL_*_DOCUMENT` object (`@/lib/legal`) → `highlights` card grid + `PublicSection` per heading. Reskinning the 2 shell components reskins ~15 pages at once. | `terms/page.tsx`, `disclaimer/page.tsx` |
| 5 | **Auth pages (sign-in, sign-up) use a 2-column split:** left brand `<aside>` (`hidden lg:flex`, `bg-gradient-to-br from-card to-background`, blur blob, `Wordmark`) + right form panel `max-w-[380px]`. Forgot/reset/verify/setup-password/unsubscribe/invitations use a **single centered card** pattern instead. No shared auth-shell component — each re-implements the card. | `sign-in/page.tsx:141`, `forgot-password/page.tsx:55` |
| 6 | **Movers & Partners portals/apply have NO marketing chrome** — bare `<main class="mx-auto max-w-* px-5 py-*">` with a per-page `<header>`. Tone tokens used: mover dashboard leans `tone-orange-*` (sponsored) + `tone-sage-*` (verified); partner uses plain `text-primary`. | `movers/portal/page.tsx:26`, `partners/portal/page.tsx` |
| 7 | **`force-dynamic` is near-universal** for public pages (CSP nonce + per-request locale/session/flags). Moving guides are the exception note: comment says they were moved OFF `force-static` to dynamic so the per-request nonce matches. | `page.tsx:87`, `moving/[state]/page.tsx:53-60` |
| 8 | **Feature-flag forks change content, not theme:** `CONSUMER_FREE_FLAG` (home/pricing hide trial/refund FAQ + swap offers), `WORKSPACE_MODEL_ENABLED` + `FEATURE_API_CONNECTORS` (home extra sections), `MOVER_REGISTRATION_ENABLED`/`PARTNER_REGISTRATION_FLAG` (apply forms ↔ "paused" card). | `page.tsx:96-102`, `movers/apply/page.tsx:36` |
| 9 | **Mascot/brand accents:** `RaccoonReading` illustration appears on home (how-it-works section), `blog` index, and every `moving/[state]` + `[city]` guide. `Wordmark` is the only logo on all auth/onboarding cards. No raster logo on public pages besides OG. | `page.tsx:382`, `blog/page.tsx:22` |
| 10 | **`/help` and `/expenses` are special:** `/help` renders the authenticated `AppShell` when a session exists, else the marketing shell (dual-mode). `/expenses` is a pure `redirect("/budget")`. `/onboarding` is auth-gated (its `layout.tsx` redirects unauthenticated → sign-in). | `help/page.tsx:50`, `expenses/page.tsx`, `onboarding/layout.tsx` |

Recurring CTA card pattern (≈8 pages): `rounded-[26px] border border-primary/30 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent p-8 text-center` — a single reskin target.

---

## 1. Shared shells & primitives referenced below

| Name | File | What it provides |
|------|------|------------------|
| `MarketingHeader` | `components/marketing/marketing-header.tsx` | sticky `h-16` header, `Wordmark`, desktop nav (Features/Why free/Pricing/Help/Blog/FAQ — hardcoded English), `MarketingMobileNav` sheet, LanguageSelector, `LandingThemeToggle`, sign-in/up CTAs or `MarketingUserMenu`. `bg-background/95 backdrop-blur`. |
| `MarketingFooter` | `components/marketing/marketing-footer.tsx` | `border-t bg-card py-12`, 4-col grid + bottom bar (copyright/lang/theme). |
| `PublicPageShell` | `components/marketing/public-page-shell.tsx` | header + `<main>` with 2 decorative blur blobs (`bg-primary/10`,`bg-info/10`) + hero (eyebrow pill, `font-display` h1, desc, `border-b`) + `container max-w-6xl py-14 lg:py-20` + footer. |
| `PublicSection` | same file | `rounded-[22px] border border-border bg-card/70 p-6 backdrop-blur` card with `font-display` h2. |
| `Button` | `components/ui/button.tsx` | variants: default/outline/ghost/secondary; sizes sm/lg. |
| `Wordmark` / `LogoMark` | `components/marketing/logo.tsx` | brand lockup; `animated` prop is dead (ignored). |

---

## 2. Page-by-page inventory

Legend: **Shell** = a/b/c per §0#1. Theme cell: "tokens" = uses only semantic CSS vars (light+dark OK). Responsive default for shell pages = `container`/grid `md:`/`lg:` breakpoints, mobile single-column.

### 2.1 Home & core marketing

| Route | File | Shell | Key sections/blocks | Components | Theme handling | Responsive | Brand/logo | States | Renewal notes |
|-------|------|-------|---------------------|-----------|----------------|------------|-----------|--------|---------------|
| `/` | `page.tsx` | a (direct) | hero (eyebrow pill, gradient-shimmer h1, dual CTA, trust chips, `HeroPhoneShowcase`), scope strip (3-col divided), `RecognitionChipStorm`, `HardStats`, risk grid (5 cards), `MovingMomentMock`, features grid (6), `DossierShowcase`, how-it-works (3 steps), flag-gated connector+family sections, `BilingualShowcase`, `SocialProof`, `PricingSection`, `LatestBlogPosts`, scope (3), FAQ `<details>`, `EarlyAccessCapture`, mobile-app CTA + `MobileMockup`, final CTA banner | MarketingHeader/Footer, Button, many `marketing/*` client components, `RaccoonReading`, JsonLd | tokens + `aurora-blob`; accent `bg-tone-foil-bg/-br/-fg`, `text-success`; gradient `from-primary via-primary/80 to-foreground` clip-text | `md:grid-cols-[1.15fr_1fr]`, `lg:grid-cols-5`, heavy `md:`/`lg:` | Wordmark (header), RaccoonReading | `force-dynamic`; no explicit loading/empty (server-rendered); SocialProof/LatestBlog render-nothing-if-empty | Largest page; densest token usage. Hero shimmer animation + aurora blobs are signature. Preserve flag forks (consumer-free, workspace, connectors). |
| `/features` | `features/page.tsx` | b (PublicPageShell) | 3 `PublicSection` groups × 3 feature cards (icon tile + title + body), `Sparkles` CTA card, "Trust boundary" section | PublicPageShell/Section, Button, lucide | tokens (`bg-primary/10 text-primary`, `border-border bg-background/60`) | `md:grid-cols-3` | Wordmark via shell | static, no states | Pure static content array. |
| `/pricing` | `pricing/page.tsx` | a (direct) | `PricingSection` (h1 level), disclaimer card, billing FAQ `<details>` (hidden under consumer-free), softwareApplication + breadcrumb JsonLd | MarketingHeader/Footer, PricingSection, JsonLd, Button(Link) | tokens; `bg-muted/40`, `border bg-card` | `container max-w-3xl`, FAQ stacked | Wordmark | `force-dynamic`; consumer-free flag removes FAQ | PricingSection is the load-bearing component (see catalog). |
| `/how-it-works` | `how-it-works/page.tsx` | b | "four things" (4 numbered step cards w/ mono step nums + scroll-mt anchors), "what makes it different" (3 pillars), "a typical week" list, CTA card, HowTo JsonLd | PublicPageShell/Section, Button, JsonLd | tokens; `text-success` checks | `md:grid-cols-2`/`-3` | Wordmark via shell | static | Steps array drives both UI + HowTo schema. |
| `/why-free` | `why-free/page.tsx` | b | 3 principle cards, "what users should know" check list, Sparkles CTA card | PublicPageShell/Section, Button | tokens; `text-success` | `md:grid-cols-3` | shell | static | — |
| `/about` | `about/page.tsx` | b | "what it is", "what it does not do" (card list), "who it is for", "where to learn more" gradient CTA, breadcrumb JsonLd | PublicPageShell/Section, Button, JsonLd | tokens | `flex-wrap` CTA, prose | shell | static | — |
| `/provider-coverage` | `provider-coverage/page.tsx` | b | how-info-used, coverage limits (card list), what-to-verify, coverage FAQ `<details>`, related-policies; webPage+breadcrumb+faq JsonLd | PublicPageShell/Section, JsonLd, Link | tokens | `space-y` stacked, no grid | shell | static | FCC/coverage legal copy embedded — preserve wording. |
| `/contact` | `contact/page.tsx` | b | 6 contact-path cards (icon + mailto), mailing-address section, policy-links button row, account-help gradient CTA | PublicPageShell/Section, Button, mailto from `legal-info` | tokens | `md:grid-cols-2`, `flex-wrap` | shell | conditional address (configured-or-fallback note) | Emails from `LEGAL_CONTACTS`. |
| `/faq` | `faq/page.tsx` | b | `policyLastUpdatedLabel`, grouped `<details>` accordions (`faqGroups` from `faq-content`), "still have a question" CTA, FaqJsonLd | PublicPageShell/Section, Button, native `<details>`/`<summary>` | tokens; `border-border bg-background/60` accordions | stacked | shell | static | Accordion via `<details>` (no JS). |
| `/help` | `help/page.tsx` | **dual: AppShell if logged-in, else a (direct marketing)** | logged-out: gradient hero band + `HelpCenterContent` (search + articles + faqs); logged-in: same content inside `AppShell` | AppShell OR MarketingHeader/Footer, `HelpCenterContent` | tokens; hero `bg-gradient-to-br from-primary/10` | `container py-*` | Wordmark (marketing) / app sidebar | `force-dynamic`; ES/EN copy fork; HelpCenterContent has its own search/empty | Only public page that can swap into the authenticated shell. |

### 2.2 Legal / policy set (all Shell **b**, all token-only, all data-driven from `@/lib/legal` unless noted)

| Route | File | Key sections/blocks | Theme | Notes / unique bits |
|-------|------|--------------------|-------|---------------------|
| `/terms` | `terms/page.tsx` | last-updated + entity/contact card, 4 highlight cards (`LEGAL_TERMS_DOCUMENT.highlights`), `PublicSection` per `sections[]`, related-legal pill links | tokens | Embedded counsel-action HTML comment (Delaware venue). Pill links row. |
| `/privacy` | `privacy/page.tsx` (181 ln) | highlight cards + section map (`LEGAL_PRIVACY_DOCUMENT`), likely contact/rights blocks | tokens | Longest legal page; same shell pattern. |
| `/security` | `security/page.tsx` | highlight cards + sections (`LEGAL_SECURITY_DOCUMENT`) | tokens | — |
| `/refund` | `refund/page.tsx` | highlight cards + sections | tokens | — |
| `/disclaimer` | `disclaimer/page.tsx` | last-updated, 4 highlight cards, section map (`LEGAL_DISCLAIMER_DOCUMENT`) | tokens | Canonical minimal example of the pattern. |
| `/cookie-policy` | `cookie-policy/page.tsx` | category cards, sections, **`CookiePreferenceControls`** (interactive consent manager) | tokens | Only legal page with an interactive client widget (manage cookies). References `locateflow_cookie_consent` / `cookie_consent` / `ccpa_opt_out`. |
| `/ccpa-privacy-notice` | `ccpa-privacy-notice/page.tsx` | highlight cards + sections | tokens | CA-specific; links from cookie-policy/account-delete. |
| `/acceptable-use` | `acceptable-use/page.tsx` | highlight cards + sections | tokens | — |
| `/billing-policy` | `billing-policy/page.tsx` | highlight cards + sections | tokens | — |
| `/dpa` | `dpa/page.tsx` (137 ln) | highlight cards + sections (subprocessors etc.) | tokens | — |
| `/data-deletion` | `data-deletion/page.tsx` | sections (deletion process) | tokens | Sibling of `/account/delete` (store-policy landing). |

States for all legal pages: static, no loading/empty/error; `policyLastUpdatedLabel()` from `@/lib/legal-info`. Renewal note: reskinning `PublicPageShell` + `PublicSection` + the shared highlight-card markup covers this entire set; copy lives in `@/lib/legal` (don't touch).

### 2.3 Auth & account

| Route | File | Shell | Key sections/blocks | Components | Theme handling | Responsive | Brand | States | Renewal notes |
|-------|------|-------|---------------------|-----------|----------------|------------|-------|--------|---------------|
| `/sign-in` | `sign-in/page.tsx` | c (2-col split) | left brand aside (`hidden lg:flex`, gradient + blur blob + Wordmark + headline + "Secure access"), right form: Google/Apple SSO buttons, email+`PasswordInput`, MFA step, submit, legal links | Wordmark, PasswordInput, AuthFormSkeleton (Suspense fallback), lucide | tokens **except** Google "G" SVG hexes + SSO buttons styled with raw `slate-*`/`white`/`dark:` utilities (brand-correct, intentional) | `lg:grid-cols-[1.05fr_0.95fr]`; aside hidden < lg | Wordmark | loading (`Loader2` on submit), error (alert box), MFA-required, OAuth-readiness note (`tone-honey`) | SSO buttons are the only deliberately non-token color block on public web — keep their brand hexes. |
| `/sign-up` | `sign-up/page.tsx` | c (2-col split) | same split as sign-in + success/check-email state card (`accountReady`/`checkEmail`), invite-redirect copy | Wordmark, PasswordInput, lucide | tokens + same SSO brand hexes | `lg:grid-cols-[1.05fr_0.95fr]` | Wordmark | loading, error, success/verify-email, invite-aware | Mirror of sign-in; consolidate the duplicated split-panel into one shell at reskin. |
| `/forgot-password` | `forgot-password/page.tsx` | c (single centered card) | `rounded-[1.75rem] border bg-card/75 backdrop-blur-xl` card, KeyRound icon, email form; submitted-state success card | Wordmark, lucide | tokens; `text-sage` on success | centered `max-w-md`, `p-4` | Wordmark | loading, submitted-success (always-generic, no enumeration) | — |
| `/reset-password/[token]` | `reset-password/[token]/page.tsx` (144 ln) | c (centered card) | token-driven new-password form (client) | Wordmark, PasswordInput likely | tokens [needs verification - body not fully read] | centered | Wordmark | loading/success/error (token invalid) [needs verification] | Dynamic token param. |
| `/verify-email` | `verify-email/page.tsx` | c (centered card) | gradient-bg card, MailCheck tile, sent-to-email copy, `ResendVerificationButton`, sign-in/home links | Wordmark, ResendVerificationButton | tokens; `bg-gradient-to-br from-card to-background` + blur blob | centered `max-w-md` | Wordmark | server-resolves session → redirect if verified; pending view | Server component. |
| `/verify-email/[token]` | `verify-email/[token]/page.tsx` | c (centered card) | auto-verify on mount; verifying/ok/error tri-state | lucide | tokens **but uses `tone-orange-*` + `tone-emerald-fg` + `text-white`**; `style={{background:var(--surface)}}` | centered `max-w-md` | none (no Wordmark) | loading(verifying)/ok/error explicit | Uses `tone-orange-fg` button + raw `text-white` — inconsistent with primary buttons elsewhere. |
| `/account/setup-password` | `account/setup-password/page.tsx` | c (centered card) | request-set-password vs sent state, "continue without" skip; ShieldCheck/MailCheck tiles | Wordmark, lucide | tokens; `tone-sage-*` tile; `style={{background:var(--surface)}}` | centered `max-w-md` | Wordmark | loading/sent/error | Suspense wrapper. |
| `/account/delete` | `account/delete/page.tsx` | b (PublicPageShell) | in-app path (ordered list), email-request path, what's-deleted/retained lists, timeline, store-billing warning card, privacy-settings CTA | PublicPageShell/Section, Link, mailto | tokens; `bg-muted/30` callouts, `text-destructive` Trash2/CTA | `md:flex-row` CTA | shell | static | Mixes PublicPageShell with destructive-tone CTA. |
| `/onboarding` | `onboarding/page.tsx` + `onboarding/layout.tsx` | own onboarding layout (`max-w-2xl`, Wordmark header, "set up your account") | `OnboardingClient` (flag-driven teaser variant) | OnboardingClient, Wordmark | tokens (`bg-background text-foreground`) | `max-w-2xl px-4` | Wordmark | auth-gated layout: redirects to sign-in / handles ACCOUNT_DELETED; `force-dynamic` | Layout enforces access; UI is in `OnboardingClient` (not read here) [needs verification - client body]. |
| `/invitations/[token]` | `invitations/[token]/page.tsx` (242 ln) | c (centered `Shell` card) | invalid / accepted / invite-detail (role pill, sync-warning honey card, sign-up/in or accept buttons, email-mismatch switch) | client Shell, lucide | tokens **except `text-green-500`** (raw — should be `text-success`); `tone-orange-*` role tile, `tone-honey-*` warning | centered card | none (icon tiles only) | loading/error/accepted/multiple auth branches | Fix `text-green-500` → token at reskin. |
| `/unsubscribe` | `unsubscribe/page.tsx` | c (centered `Shell` card) | invalid-link / confirm-step (POST form) / done-step; email-on-file mono block | Wordmark, lucide | tokens; `bg-destructive/10` for invalid | centered `max-w-md` | Wordmark | invalid/confirm/done; no-mutation-on-GET design | Server component; POSTs to `/api/unsubscribe`. |

### 2.4 Blog

| Route | File | Shell | Key sections/blocks | Components | Theme handling | Responsive | Brand | States | Renewal notes |
|-------|------|-------|---------------------|-----------|----------------|------------|-------|--------|---------------|
| `/blog` | `blog/page.tsx` (301 ln) | a (direct, marketing) | "Moving guides" eyebrow + serif headline, RaccoonReading, featured wide card, 3-col guide-card grid (real image OR gradient+category-emoji fallback tile), pagination, RSS link | MarketingHeader/Footer [needs verification - footer in body], Next `Image`, RaccoonReading, lucide `Rss` | tokens **+ one fallback hex** `#37C2C9` via `color-mix(... var(--color-info, #37C2C9) ...)` (`blog/page.tsx:137`) | `grid` 1→3 col | Wordmark, RaccoonReading | `force-dynamic`; empty (no posts → english fallback, then empty), locale fallback | Category→emoji map is a content device; gradient placeholder is theme-aware except the info fallback hex. |
| `/blog/[slug]` | `blog/[slug]/page.tsx` (341 ln) | a (direct) | magazine article: hero (BlogHeroFallback when no image), sanitized `dangerouslySetInnerHTML` body (`prose`), author/meta, "keep reading" related rail, Article+Breadcrumb JsonLd, BlogViewTracker | Next Image, BlogHeroFallback, Button, JsonLd, BlogViewTracker | tokens; `prose` typography | article column + rail | Wordmark | `force-dynamic`; `notFound()` on missing; locale fallback; noIndex per-post | Body styling depends on `prose` (Tailwind typography) + sanitized HTML — verify prose color tokens in dark. |
| `/blog/category/[slug]` | `blog/category/[slug]/page.tsx` (257 ln) | a (direct) | category header + filtered post grid (same card pattern as index) | MarketingHeader/Footer, Image, lucide | tokens (+ likely same `#37C2C9` fallback) [needs verification] | grid 1→3 | Wordmark | `notFound()` on unknown category; empty | Shares card markup with index. |
| `/blog/preview/[token]` | `blog/preview/[token]/page.tsx` | **c (bare `max-w-3xl` main)** | preview banner (`tone-honey`), header (category/title/excerpt/meta), cover Image, `prose` body | Next Image, native | tokens; `prose prose-zinc dark:prose-invert`; `tone-honey-*` banner | `max-w-3xl px-4` | none | `notFound()` on bad/expired token; `noindex,nofollow`; `revalidate=0` | Internal admin-preview surface; minimal chrome by design. |

### 2.5 Movers / Partners (all Shell **c**, bare `<main>`, NO marketing header/footer)

| Route | File | Key sections/blocks | Components | Theme handling | Responsive | Brand | States | Renewal notes |
|-------|------|--------------------|-----------|----------------|------------|-------|--------|---------------|
| `/movers/apply` | `movers/apply/page.tsx` | `max-w-2xl` main, eyebrow pill + h1 + intro, `MoverApplyForm` OR "applications paused" card; terms footnote | MoverApplyForm, Link | tokens (`bg-primary/10 text-primary` pill) | `max-w-2xl px-5` | none | `MOVER_REGISTRATION_ENABLED` gate → form/paused; form has own states | FMCSA/USDOT copy. Note: links `/legal/terms` (vs `/terms` elsewhere) — possible dead link. |
| `/movers/portal` | `movers/portal/page.tsx` | `max-w-md` main, centered `<header>` (mono kicker + h1 + sub), `MoverPortalLogin` | MoverPortalLogin | tokens; uses `.h1` utility | `max-w-md px-5` | none | redirect→dashboard if session; `?error=invalid` flag; `noindex` | Magic-link login. |
| `/movers/portal/dashboard` | `movers/portal/dashboard/page.tsx` | `max-w-3xl`, header + sign-out form, listing-status card (sage verified / border inactive pills), 2 `Stat` cards, sponsored-placement card (orange tone) | lucide, prisma data | tokens **heavy tone usage**: `tone-sage-*` (verified), `tone-orange-*`/`tone-orange-fg` (sponsored, `text-white` button) | `grid-cols-2` stats | none | redirect if no session/company; active-vs-no-placement; `SPONSORED_ENABLED` gate | Sponsored button `bg-tone-orange-fg ... text-white` — raw white on gold. |
| `/movers/portal/placements` | `movers/portal/placements/page.tsx` | `max-w-md`, back link, h1+intro, `MoverPlacementRequest` OR ineligible card | MoverPlacementRequest, lucide | tokens; `bg-foreground/5` ineligible card | `max-w-md px-5` | none | redirect if no session; eligible (active+HHG) vs ineligible | — |
| `/partners/apply` | `partners/apply/page.tsx` | `max-w-2xl`, mono kicker + h1 + intro, `PartnerApplyForm` OR paused card | PartnerApplyForm, Link | tokens | `max-w-2xl px-5` | none | `PARTNER_REGISTRATION_FLAG` gate; form states | Links `/terms` (correct). |
| `/partners/portal` | `partners/portal/page.tsx` (151 ln) | signed-out: `max-w-md` + `PartnerPortalRequestForm` (magic link); signed-in: `max-w-3xl` header + sign-out, 2 stat cards, lead-delivery toggle form, **recent-leads `<table>`** (Area/Job date/Status/Received) | PartnerPortalRequestForm, prisma data, native table | tokens; `tone-rose-fg` error; `border-border bg-card` cards/table | `grid-cols-2 sm:grid-cols-3`, `overflow-x-auto` table | none (mono/text kicker) | signed-out vs signed-in; `?error=invalid`; empty-leads message; `noindex` | Only public surface with a real data table — preserve table semantics at reskin. |

### 2.6 Moving guides (programmatic SEO) — Shell **a** (MarketingHeader/Footer)

| Route | File | Key sections/blocks | Components | Theme handling | Responsive | Brand | States | Renewal notes |
|-------|------|--------------------|-----------|----------------|------------|-------|--------|---------------|
| `/moving/[state]` | `moving/[state]/page.tsx` (565 ln) | hero card (breadcrumb nav, title, intro), 5 rule cards (DMV/voter/utilities/taxes/insurance — icon grid), ordered relocation CHECKLIST, FAQ, related-states rail (4), CTA; Article+FAQ+HowTo+Breadcrumb JsonLd | MarketingHeader/Footer, Button, RaccoonReading, JsonLd, lucide | tokens; `rounded-3xl border bg-card/80 backdrop-blur` hero; mono breadcrumb | `mx-auto max-w-5xl px-4`, card grids | Wordmark, RaccoonReading | `force-dynamic` (was static — nonce fix); `notFound()` for unknown slug (`dynamicParams=false`); 51 slugs | Content from `@/lib/states/data` seed. 89 className occurrences — densest token layout outside home. |
| `/moving/[state]/[city]` | `moving/[state]/[city]/page.tsx` (545 ln) | same structure scoped to a metro: hero, 5 rule cards (state rules), checklist, FAQ, sibling-metros rail; Article+JsonLd | same as state page | tokens (identical pattern) | `max-w-5xl` | Wordmark, RaccoonReading | `notFound()` for unknown metro; sibling rail | Near-clone of state page — reskin both together. |

### 2.7 Utility / misc

| Route | File | Shell | Key sections/blocks | Theme handling | States | Renewal notes |
|-------|------|-------|---------------------|----------------|--------|---------------|
| `/offline` | `offline/page.tsx` | c (centered card) | WifiOff tile, title/desc (i18n `errors.*`), reload button, "cached pages" mono note | tokens (`bg-primary/10 text-primary`, `rounded-[26px] border bg-card/60`) | static (client, `window.location.reload`) | PWA offline fallback. No Wordmark. |
| `/expenses` | `expenses/page.tsx` | — | `redirect("/budget")` only | n/a | n/a | Pure redirect; no UI. (Note: target `/budget` is in `(app)/`, outside this doc.) |

---

## 3. Theme-handling exceptions & hardcoded values (full list for the public surface)

| Location | Hardcoded / raw value | Token-correct? | Action for reskin |
|----------|----------------------|----------------|-------------------|
| `sign-in/page.tsx` + `sign-up/page.tsx` (Google "G" SVG) | `#FFC107 #FF3D00 #4CAF50 #1976D2` | Intentional brand mark | Keep (Google brand-guideline colors). |
| `sign-in` / `sign-up` SSO buttons | raw `border-slate-200 bg-white text-slate-950 dark:...` + multi-stop box-shadows | Intentional (SSO button must be neutral/white per Google/Apple guidelines) | Keep, but note these are the only non-token button styles on public web. |
| `invitations/[token]/page.tsx:144` | `text-green-500` | No (should be `text-success`) | Replace with token. |
| `verify-email/[token]/page.tsx` | `tone-orange-fg` button + `text-white`; `tone-emerald-fg` | Tone tokens (gold) used where other pages use `primary` | Normalize to `primary` button language for consistency. |
| `movers/portal/dashboard/page.tsx:106` | `bg-tone-orange-fg ... text-white` | gold + raw white | Normalize; confirm contrast. |
| `blog/page.tsx:137` (+ likely `blog/category`) | `var(--color-info, #37C2C9)` fallback hex inside `color-mix` | Token with hardcoded fallback | Fallback only fires if `--color-info` missing; low risk, but align fallback with token. |
| `setup-password`, `verify-email/[token]` | `style={{ background: "var(--surface)" }}` inline | Token via inline style | Fine; just inline rather than class. |

Everything else across the public surface resolves through semantic tokens (`background/foreground/card/border/muted/primary/primary-foreground/destructive/success/ring/input` + `tone-foil/orange/sage/honey/rose/emerald-bg/-br/-fg`) and works in light + dark.

---

## 4. Coverage check vs `web-pages.txt`

All 60 non-`(app)`/non-`api` entries covered: home(1), about, acceptable-use, account/delete, account/setup-password, billing-policy, blog(4: index/[slug]/category/preview), ccpa-privacy-notice, contact, cookie-policy, data-deletion, disclaimer, dpa, expenses, faq, features, forgot-password, help, how-it-works, invitations/[token], movers(4: apply/portal/dashboard/placements), moving(2: [state]/[city]), offline, onboarding, partners(2: apply/portal), pricing, privacy, provider-coverage, refund, reset-password/[token], security, sign-in, sign-up, terms, unsubscribe, verify-email(2), why-free. The 14 `(app)/*` rows are intentionally out of scope for this doc.

`[needs verification - runtime]`: dark-mode rendering of `prose` blog bodies; exact states of `reset-password/[token]` and `OnboardingClient` (client bodies not fully read); whether `blog/category` reuses the `#37C2C9` fallback; live appearance of marketing footer inside blog index/category bodies.
