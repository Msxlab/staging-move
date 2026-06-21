# 2026-06-21 Design Zip Theme Integration Memory

## Source bundle

- Design source: `design-src/initial-check-requested/project`
- Primary handoff file: `Admin.dc.html`
- Design index: `Index.dc.html`
- Confirmed palette in pushed zip bundle: default `Gold` with optional `Sapphire` and `Emerald` variants. The current default theme is not the older cool-blue palette.
- Core visual system: dark navy canvas, Move wordmark, Playfair Display headings, DM Sans UI, simple raccoon mark, primary gold `#CBA45E`, champagne highlight `#DCBC7C`, gold shadow `#B0852F`, green success `#54CB7E`, amber warning `#E0A85A`, red risk `#E25C5C`, teal info `#37C2C9`.

## Route and surface matrix

| Zip/prototype surface | Production equivalent | Status |
| --- | --- | --- |
| `Web.dc.html` router | `apps/web/src/components/marketing/marketing-header.tsx` plus public routes | Aligned to `Features / Why free / Guides`; `Pricing` remains reachable from footer and direct route. |
| `Move Web.dc.html` landing | `apps/web/src/app/page.tsx` | Theme/brand tokens aligned; OG and public icons updated. Runtime visual QA still required after Docker build. |
| `Web Features.dc.html` | `apps/web/src/app/features/page.tsx` | Was missing as a standalone route; added. |
| `Web Why-Free.dc.html` | `apps/web/src/app/why-free/page.tsx` | Was missing as a standalone route; added. |
| `Web Blog.dc.html` | `apps/web/src/app/blog/**`, `apps/web/public/blog/*.svg` | Route existed; blog SVG/card palette and brand updated. |
| `Web Login.dc.html` | `apps/web/src/app/sign-in/page.tsx` | Route existed; shared brand/theme tokens now feed page. |
| `Web Onboarding.dc.html` | `apps/web/src/app/onboarding/**` | Route existed; visible product brand updated. |
| `Move.dc.html` mobile app | `apps/mobile/app/(tabs)/**` plus detail stacks | Route/screen set exists; theme, icon, splash, search, and visible brand updated. |
| `Auth.dc.html` | `apps/mobile/app/(auth)/**`, reset/setup screens | Exists; theme and brand updated through shared mobile theme/i18n. |
| `Onboarding.dc.html` | `apps/mobile/app/onboarding.tsx` | Exists; theme and brand updated. |
| `Providers.dc.html` | `apps/mobile/app/providers/**`, web providers routes | Exists; theme tokens corrected so provider primary accents are gold, risk stays red. |
| `CustomProviders.dc.html` | `apps/mobile/app/custom-providers/**` | Exists; theme tokens corrected. |
| `Reminders.dc.html` | `apps/mobile/app/reminders/index.tsx` | Exists and linked through mobile search/i18n coverage. |
| `Help.dc.html` | `apps/mobile/app/help/**`, `apps/web/src/app/help` | Exists; visible brand updated. |
| `Search.dc.html` | `apps/mobile/app/search.tsx` | Expanded earlier to include services, addresses, moving, budget, tasks, providers, custom providers, blog/help targets. |
| `Invitations.dc.html` | `apps/mobile/app/invitations/[token].tsx`, web invitation routes | Exists. |
| `Admin.dc.html` overview/users/moves/analytics/content/providers/support/data/settings | `apps/admin/src/app/(admin)/**` | Core surfaces exist; admin has many extra operational modules beyond the prototype. Theme tokens and visible admin brand updated. |

## Applied integration fixes

- Removed old blue palette remnants from TS/TSX/CSS/JSON/SVG scans.
- Updated shared design tokens so `orange`/`foil` represent Move Gold, `rose` semantic tone represents risk/error red, and `sky`/`cyan` represent teal info.
- Updated web/admin CSS token scopes, dark/light tone aliases, focus rings, semantic warning/info colors, and OG image colors.
- Replaced web/admin/mobile logo, favicon, manifest, PWA, app icon, splash, and public SVG/blog image assets with the Move/raccoon/gold visual system.
- Updated web/admin/mobile visible product brand from `LocateFlow` to `Move` across UI/metadata/i18n while preserving technical domains, package names, API headers, and storage namespaces.
- Updated public legal/help fallback copy so `/terms`, `/disclaimer`, and Help fallback content no longer expose the old product brand on user-facing pages.
- Added missing web routes `/features` and `/why-free`.
- Updated admin theme regression expectations to check the new split: legacy primary aliases remain gold; semantic `tone-rose` remains risk red.

## Known non-page brand remnants

- Transactional email templates, PDF report metadata, native mobile user-agent/session labels, service-worker cache names, alert subjects, and package/API identifiers still contain `LocateFlow`.
- These are intentionally outside this page/theme integration pass because changing them affects deliverability tests, mobile session fingerprinting, legal/audit evidence, and support workflows. Treat them as a separate brand-copy sweep if the product rename must extend beyond visible web/admin/mobile pages.

## Runtime validation

- Docker Node 22 `pnpm verify:typecheck`: passed.
- Docker Node 22 `pnpm verify:tests`: passed across web, admin, mobile, shared, and connectors.
- Docker Node 22 `pnpm --filter @locateflow/db exec prisma validate` with a dummy MySQL `DATABASE_URL`: passed.
- `git diff --check`: passed with CRLF-only warnings on Windows checkout.
- Old cool-blue palette scan over app/package TS/TSX/CSS/JSON/SVG sources: clean.
- Visible page/component old-brand scan over web/admin/mobile routes/components/i18n/legal/help: clean.

## Remaining runtime checks

- Browser QA must compare staging/home, `/features`, `/why-free`, `/blog`, `/sign-in`, `/onboarding`, app dashboard, mobile web-embed surfaces, and admin overview/users/moves/analytics/providers/support/settings.
- Native Android launcher `mipmap-*` WebP assets may still need regeneration from the new PNG/SVG source because local tooling could not write WebP during the pre-audit pass.
- Staging deploy must only be considered complete after the branch is pushed, Dokploy rebuilds, and `/api/build-info` on staging reflects the pushed commit.
