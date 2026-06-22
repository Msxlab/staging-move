# 03 — Route Map (Web / Admin / Mobile)

Area slug: `route-map`. Read-only audit. Evidence is source code only.

## How auth was determined (authoritative, per app)

### Web (`apps/web/src/middleware.ts`)
- Matcher: `["/((?!_next|.*\\..*).*)", "/api/(.*)"]` — runs on every page + API route (lines 851-853).
- Page routing logic (lines 838-848): if `isPublicPath(pathname)` → allowed. Else if `hasValidSession(request)` (JWT verify of `user_session` cookie or `Bearer`) → allowed. Else **redirect to `/sign-in?redirect=<path>`**.
- `isPublicPath` (lines 132-138) matches the `PUBLIC_PATHS` allow-list (lines 26-59) via `matchesPathOrChild` (exact or child), plus the curated public `/moving/<state>` + `/moving/<state>/<city>` marketing slugs (lines 68-74).
- **Therefore every route NOT in `PUBLIC_PATHS` (and not a public state page) requires a valid user session.** All `(app)/*` routes are gated this way. The `(app)/layout.tsx` adds a second server-side gate via `requireDbUserId()` + post-auth redirect resolution (lines 57-110), so DB-row validation (isActive/expiry) also runs.
- noindex is applied by `pathShouldNoIndex` (lines 640-663) for all app/auth/token routes.

### Admin (`apps/admin/src/middleware.ts`)
- Matcher: `["/((?!_next/static|_next/image|favicon.ico).*)"]` (lines 808-810).
- Everything except `PUBLIC_EXACT_PATHS` (`/login`, `/set-password`, a few API) and static assets requires an `admin_session` cookie (lines 666-688); missing/invalid token → redirect `/login` (page) or 401 (API).
- JWT-claim gates run in middleware: forced password rotation (`mcp` claim, lines 704-727) restricts to `/set-password/change`; MFA-setup gate for `SUPER_ADMIN`/`ADMIN` (`adminRoleRequiresMfa`, lines 735-763) restricts to `/settings/two-factor`; session-fingerprint check (lines 766-792).
- Page-level role/permission is enforced server-side. `(admin)/layout.tsx` calls `requirePageAdmin()` (any active admin) (layout line 17). Privileged pages additionally call `requirePageRole`/`requirePagePermission`/`requirePermission` at the top of the server component — verified per-page below via grep of `apps/admin/src/app/(admin)`.

### Mobile (`apps/mobile/app/_layout.tsx`)
- Client-side `AuthGuard` (lines 139-411). Effect 4 (lines 277-328): if no `token` and not in `(auth)` / `oauth` / `reset-password` / `blog` segment → `router.replace("/(auth)/sign-in")`. So **all screens outside those four segments require a session**; onboarding completion also routes the user between `/onboarding` and `/(tabs)`.
- Theme is global: `ThemeProvider` + `useThemePreference` (light/dark, lines 13, 420-444). Mobile screens are RN (inherently responsive); no SEO.

---

## Web pages (`apps/web/src/app`)

Layouts: `RootLayout` = `app/layout.tsx` (global theme via `next-themes` `ThemeProvider`, locale, CSP nonce, SEO defaults). `AppLayout` = `(app)/layout.tsx` (AppShell + auth gate). `BlogLayout` = `blog/layout.tsx`. `OnboardingLayout` = `onboarding/layout.tsx` (auth gate). Theme is handled globally for the whole web app via the root `ThemeProvider`; "Light/Dark" column below = "Yes (global)" unless a page hard-codes. Responsiveness assumed via Tailwind utility classes (sampled pages use `sm:`/`md:` and `max-w-*`); marked "needs verification" where not directly inspected.

| Route | File | Layout | Auth required? | Role/perm | APIs called | Loading/Empty/Error state | Theme | Responsive | SEO/meta |
|---|---|---|---|---|---|---|---|---|---|
| `/(app)/addresses` | `(app)/addresses/page.tsx` | App | Yes (mw + layout `requireDbUserId`) | user | server prisma; client → `/api/addresses` | Yes (in `addresses-client.tsx`: empty/length checks) | Yes (global) | needs verification | noindex (mw) |
| `/(app)/addresses/[id]` | `(app)/addresses/[id]/page.tsx` | App | Yes | user | server prisma / client | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/addresses/[id]/edit` | `(app)/addresses/[id]/edit/page.tsx` | App | Yes | user | client form → `/api/addresses/[id]` | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/addresses/new` | `(app)/addresses/new/page.tsx` | App | Yes | user | client → `/api/addresses` | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/budget` | `(app)/budget/page.tsx` | App | Yes | user | client (19 state markers) | Yes (client) | Yes (global) | needs verification | noindex |
| `/(app)/budget/[month]` | `(app)/budget/[month]/page.tsx` | App | Yes | user | server prisma | Yes — `notFound()` on bad month/missing budget; `length===0` empties (lines 22-36,131) | Yes (global) | needs verification | noindex |
| `/(app)/dashboard` | `(app)/dashboard/page.tsx` | App | Yes | user | server prefs; client → dashboard APIs | Yes (in `dashboard-client.tsx`, 17 markers) | Yes (global) | needs verification | noindex |
| `/(app)/moving` | `(app)/moving/page.tsx` | App | Yes | user | server prisma | Yes — `EmptyState` when `plans.length===0` (lines 81-85) | Yes (global) | needs verification | noindex |
| `/(app)/moving/new` | `(app)/moving/new/page.tsx` | App | Yes | user | client → `/api/moving` | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/moving/plan/[id]` | `(app)/moving/plan/[id]/page.tsx` | App | Yes | user | server → `MovingPlanDetailClient` | needs verification (delegated to client) | Yes (global) | needs verification | noindex |
| `/(app)/notifications` | `(app)/notifications/page.tsx` | App | Yes | user | client (9 markers) | Yes (client) | Yes (global) | needs verification | noindex |
| `/(app)/providers` | `(app)/providers/page.tsx` | App | Yes | user | server; `providers-client.tsx` | Yes (client, 17 markers) | Yes (global) | needs verification | noindex |
| `/(app)/providers/[id]` | `(app)/providers/[id]/page.tsx` | App | Yes | user | server prisma → `ProviderDetailClient` | Yes — `notFound()` (line 155), in-page `redirect` to sign-in (line 146) | Yes (global) | needs verification | noindex |
| `/(app)/services` | `(app)/services/page.tsx` | App | Yes | user | server; `services-client.tsx` | Yes (client, 20 markers) | Yes (global) | needs verification | noindex |
| `/(app)/services/[id]` | `(app)/services/[id]/page.tsx` | App | Yes | user | server/client | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/services/[id]/edit` | `(app)/services/[id]/edit/page.tsx` | App | Yes | user | client → `/api/services/[id]` | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/services/new` | `(app)/services/new/page.tsx` | App | Yes | user | client → `/api/services` | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/settings` | `(app)/settings/page.tsx` | App | Yes | user | client | partial (2 markers) | Yes (global) | needs verification | noindex |
| `/(app)/settings/address-changes` | `(app)/settings/address-changes/page.tsx` | App | Yes | user | needs verification | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/settings/connections` | `(app)/settings/connections/page.tsx` | App | Yes | user | needs verification | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/settings/export` | `(app)/settings/export/page.tsx` | App | Yes | user | needs verification | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/settings/notifications` | `(app)/settings/notifications/page.tsx` | App | Yes | user | needs verification | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/settings/privacy` | `(app)/settings/privacy/page.tsx` | App | Yes | user | needs verification | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/settings/profile` | `(app)/settings/profile/page.tsx` | App | Yes | user | needs verification | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/settings/subscription` | `(app)/settings/subscription/page.tsx` | App | Yes | user | Stripe billing APIs | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/settings/workspace` | `(app)/settings/workspace/page.tsx` | App | Yes | user (workspace owner/member) | needs verification | needs verification | Yes (global) | needs verification | noindex |
| `/(app)/support` | `(app)/support/page.tsx` | App | Yes | user | client (6 markers) | Yes (client) | Yes (global) | needs verification | noindex |
| `/(app)/support/[id]` | `(app)/support/[id]/page.tsx` | App | Yes | user (`"use client"`) | client → `/api/support/...` | needs verification | Yes (global) | needs verification | noindex |
| `/about` | `about/page.tsx` | Root | No (public) | — | static | n/a (static) | Yes (global) | needs verification | Yes (metadata) |
| `/acceptable-use` | `acceptable-use/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/account/delete` | `account/delete/page.tsx` | Root | No (in PUBLIC_PATHS) | — | client → delete API | needs verification | Yes | needs verification | Yes |
| `/account/setup-password` | `account/setup-password/page.tsx` | Root | **Yes (NOT in PUBLIC_PATHS)** — mw gates; intended for logged-in users (`/api/auth/security`) | user | `/api/auth/security` | has loading/sent/error state (lines 18-20) | Yes | needs verification | noindex (mw) |
| `/billing-policy` | `billing-policy/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/blog` | `blog/page.tsx` | Blog | No | — | server prisma | needs verification | Yes | needs verification | Yes |
| `/blog/[slug]` | `blog/[slug]/page.tsx` | Blog | No | — | server prisma | Yes — `notFound()` if no post (line 124) | Yes | needs verification | Yes (generateMetadata) |
| `/blog/category/[slug]` | `blog/category/[slug]/page.tsx` | Blog | No | — | server prisma | needs verification | Yes | needs verification | Yes |
| `/blog/preview/[token]` | `blog/preview/[token]/page.tsx` | Blog | Token-gated (HMAC) — `notFound()` if unverified (line 37) | preview token | server | Yes — `notFound()` | Yes | needs verification | Yes (noindex expected) |
| `/ccpa-privacy-notice` | `ccpa-privacy-notice/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/contact` | `contact/page.tsx` | Root | No | — | client form | needs verification | Yes | needs verification | Yes |
| `/cookie-policy` | `cookie-policy/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/data-deletion` | `data-deletion/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/disclaimer` | `disclaimer/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/dpa` | `dpa/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/expenses` | `expenses/page.tsx` | Root | **Yes (NOT in PUBLIC_PATHS)** — mw gates before redirect | user | none — `redirect("/budget")` | n/a (redirect) | n/a | n/a | noindex (mw) |
| `/faq` | `faq/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/features` | `features/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/forgot-password` | `forgot-password/page.tsx` | Root | No (public) | — | `/api/auth/forgot-password` | needs verification | Yes | needs verification | noindex (mw) |
| `/help` | `help/page.tsx` | Root | No | — | `/api/help` | needs verification | Yes | needs verification | Yes |
| `/how-it-works` | `how-it-works/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/invitations/[token]` | `invitations/[token]/page.tsx` | Root | No (landing public; accept is auth-gated) `"use client"` | invite token | `/api/invitations` (GET) | redirects to sign-in/up for accept (lines 114,186) | Yes | needs verification | noindex (mw) |
| `/movers/apply` | `movers/apply/page.tsx` | Root | No (in PUBLIC_PATHS; route-level feature gate) | — | `/api/movers/apply` | needs verification | Yes | needs verification | Yes |
| `/movers/portal` | `movers/portal/page.tsx` | Root | No (in PUBLIC_PATHS; cookie-gated in page) | mover portal session | `getMoverPortalSession`; redirect to dashboard if session | n/a (login form) | Yes | Yes (`max-w-md`) | Yes (noindex) |
| `/movers/portal/dashboard` | `movers/portal/dashboard/page.tsx` | Root | Yes (in-page: `redirect("/movers/portal")` if no session, line 18) | mover portal session | server prisma | redirect when no session/company | Yes | needs verification | noindex |
| `/movers/portal/placements` | `movers/portal/placements/page.tsx` | Root | Yes (mover portal session in-page) | mover portal session | server | needs verification | Yes | needs verification | Yes |
| `/moving/[state]` | `moving/[state]/page.tsx` | Root | No (public state page allow-list) | — | server prisma | Yes — `notFound()` (line 207) | Yes | needs verification | Yes (generateMetadata) |
| `/moving/[state]/[city]` | `moving/[state]/[city]/page.tsx` | Root | No (public metro allow-list) | — | server prisma | needs verification (`notFound` expected) | Yes | needs verification | Yes |
| `/offline` | `offline/page.tsx` | Root | No (PWA offline fallback) | — | none | n/a | Yes | needs verification | noindex (mw) |
| `/onboarding` | `onboarding/page.tsx` | Onboarding | Yes (`OnboardingLayout` `requireDbUserId`, lines 10-37) | user | client | needs verification | Yes | needs verification | noindex (mw) |
| `/partners/apply` | `partners/apply/page.tsx` | Root | **Yes (NOT in PUBLIC_PATHS)** — mw redirects to /sign-in. Page is a public self-service form → likely-unintended gate. See `route-map-01`. | — | `/api/partners/...` | needs verification | Yes | needs verification | Yes |
| `/partners/portal` | `partners/portal/page.tsx` | Root | **Yes (NOT in PUBLIC_PATHS)** — mw redirects to /sign-in, but page implements its OWN magic-link/partner cookie session (`getPartnerPortalSession`). Public surface is unreachable while logged out. See `route-map-01`. | partner portal session | server prisma; `/api/partners/portal/*` | Yes — empty-leads message (lines 113-117) | Yes | Yes (`max-w-md`/`max-w-3xl`) | Yes (noindex) |
| `/pricing` | `pricing/page.tsx` | Root | No | — | static/Stripe | needs verification | Yes | needs verification | Yes |
| `/privacy` | `privacy/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/provider-coverage` | `provider-coverage/page.tsx` | Root | No | — | server/client | needs verification | Yes | needs verification | Yes |
| `/refund` | `refund/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/reset-password/[token]` | `reset-password/[token]/page.tsx` | Root | No (public; token is auth) | reset token | `/api/auth/reset-password` | needs verification | Yes | needs verification | noindex (mw) |
| `/security` | `security/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/sign-in` | `sign-in/page.tsx` | Root | No (public) | — | `/api/auth/login` | needs verification | Yes | needs verification | noindex (mw) |
| `/sign-up` | `sign-up/page.tsx` | Root | No (public) | — | `/api/auth/register` | needs verification | Yes | needs verification | noindex (mw) |
| `/terms` | `terms/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/unsubscribe` | `unsubscribe/page.tsx` | Root | **Yes (NOT in PUBLIC_PATHS)** — mw gates page; `/api/unsubscribe` API is public, but the page itself is not allow-listed. See `route-map-02`. | — | `/api/unsubscribe` | needs verification | Yes | needs verification | noindex (mw) |
| `/verify-email` | `verify-email/page.tsx` | Root | No (public) | — | `/api/auth/verify-email` | needs verification | Yes | needs verification | noindex |
| `/verify-email/[token]` | `verify-email/[token]/page.tsx` | Root | No (public; token is auth) | verify token | `/api/auth/verify-email` | needs verification | Yes | needs verification | noindex |
| `/why-free` | `why-free/page.tsx` | Root | No | — | static | n/a | Yes | needs verification | Yes |
| `/` (home) | `page.tsx` | Root | No | — | server/client | needs verification | Yes | needs verification | Yes |

---

## Admin pages (`apps/admin/src/app`)

Layout: `(admin)/layout.tsx` (Sidebar/Topbar/SubNav + `requirePageAdmin()`). Root `app/layout.tsx`. All admin pages are noindex (mw `applySecurityHeaders` sets `X-Robots-Tag: noindex`, lines 252-258). Theme is global (admin theme system). Most list pages are `"use client"` and rely on the layout guard for page auth + their data APIs for role enforcement; server pages call an explicit page-guard. "Role/perm" = the explicit guard at the top of the page when present, else "active admin (layout) + API-enforced".

| Route | File | Auth | Role/permission (guard) | APIs / data | Loading/Empty/Error state | Notes |
|---|---|---|---|---|---|---|
| `/` (dashboard) | `(admin)/page.tsx` | admin_session (mw) | `requirePageAdmin()` (line 405) | server prisma | needs verification | server component |
| `/acquisition-campaigns` | `(admin)/acquisition-campaigns/page.tsx` | mw | `requirePagePermission("acquisition_campaigns","canRead", ADMIN)` | server/client | needs verification | |
| `/affiliate` | `(admin)/affiliate/page.tsx` | mw | `requirePagePermission("providers","canRead", VIEWER)` | client | needs verification | |
| `/analytics` | `(admin)/analytics/page.tsx` | mw | active admin (layout) + API | client (4 state markers) | partial | `"use client"`, no top-level guard |
| `/analytics/intelligence` | `(admin)/analytics/intelligence/page.tsx` | mw | `requirePagePermission("users","canRead", ADMIN)` | server/client | needs verification | |
| `/backups` | `(admin)/backups/page.tsx` | mw | `requirePagePermission("settings","canRead", ADMIN)` | `/api/backup` | needs verification | |
| `/billing` | `(admin)/billing/page.tsx` | mw | `requirePagePermission("subscriptions","canRead", …)` | server/client | needs verification | |
| `/blog` | `(admin)/blog/page.tsx` | mw | `requirePermission("blog","canRead", MODERATOR)` (line 79) | server prisma | needs verification | server, force-dynamic |
| `/blog/[id]/edit` | `(admin)/blog/[id]/edit/page.tsx` | mw | `requirePermission("blog","canUpdate", MODERATOR)` | editor shell | needs verification | |
| `/blog/analytics` | `(admin)/blog/analytics/page.tsx` | mw | `requirePermission("blog","canRead", MODERATOR)` | server prisma (BlogView) | needs verification | |
| `/blog/new` | `(admin)/blog/new/page.tsx` | mw | `requirePermission("blog","canCreate", MODERATOR)` | editor shell | needs verification | |
| `/connector-fallbacks` | `(admin)/connector-fallbacks/page.tsx` | mw | `requirePagePermission("connectors","canRead", ADMIN)` | client | needs verification | |
| `/connector-metrics` | `(admin)/connector-metrics/page.tsx` | mw | `requirePagePermission("connectors","canRead", ADMIN)` | client | needs verification | |
| `/connectors` | `(admin)/connectors/page.tsx` | mw | `requirePagePermission("connectors","canRead", ADMIN)` | client | needs verification | |
| `/connectors/[connectorKey]` | `(admin)/connectors/[connectorKey]/page.tsx` | mw | `requirePagePermission("connectors","canRead", ADMIN)` | client | needs verification | |
| `/email-templates` | `(admin)/email-templates/page.tsx` | mw | `requirePagePermission("settings","canRead", ADMIN)` | client | needs verification | |
| `/feature-flags` | `(admin)/feature-flags/page.tsx` | mw | `requirePagePermission("settings","canRead", ADMIN)` | client | needs verification | |
| `/forbidden` | `(admin)/forbidden/page.tsx` | mw | active admin (layout) — 403 landing | none | n/a | `"use client"` static |
| `/help-center` | `(admin)/help-center/page.tsx` | mw | active admin (layout) + API | client (8 markers) | partial | `"use client"`, no top-level guard |
| `/insights` | `(admin)/insights/page.tsx` | mw | `requirePagePermission("users","canRead", VIEWER)` | server/client | needs verification | |
| `/leads` | `(admin)/leads/page.tsx` | mw | `requirePagePermission("providers","canRead", VIEWER)` | client | needs verification | |
| `/logs` | `(admin)/logs/page.tsx` | mw | `requirePagePermission("audit_logs","canRead", ADMIN)` | client | needs verification | |
| `/logs/activity` | `(admin)/logs/activity/page.tsx` | mw | `requirePagePermission("audit_logs","canRead", ADMIN)` | client | needs verification | |
| `/movers` | `(admin)/movers/page.tsx` | mw | `requirePagePermission("providers","canRead", …)` | client | needs verification | test pins guard string |
| `/movers/applications` | `(admin)/movers/applications/page.tsx` | mw | `requirePagePermission("providers","canRead", VIEWER)` | client | needs verification | |
| `/moving` | `(admin)/moving/page.tsx` | mw | active admin (layout) + API | client | needs verification | `"use client"`, no top-level guard |
| `/moving/[id]` | `(admin)/moving/[id]/page.tsx` | mw | `requirePagePermission("moving_plans","canRead", VIEWER)` | server | needs verification | |
| `/moving/at-risk` | `(admin)/moving/at-risk/page.tsx` | mw | `requirePagePermission("moving_plans","canRead", VIEWER)` | server | needs verification | |
| `/notifications` | `(admin)/notifications/page.tsx` | mw | `requirePagePermission("settings","canRead", ADMIN)` | client | needs verification | |
| `/partners` | `(admin)/partners/page.tsx` | mw | `requirePagePermission("providers","canRead", VIEWER)` | client | needs verification | |
| `/plans` | `(admin)/plans/page.tsx` | mw | `requirePagePermission("subscriptions","canRead", …)` (line 117) | server/client | needs verification | |
| `/provider-governance` | `(admin)/provider-governance/page.tsx` | mw | active admin (layout) + API | client (18 markers) | Yes (client) | `"use client"`, no top-level guard |
| `/provider-quality` | `(admin)/provider-quality/page.tsx` | mw | `requirePagePermission("providers","canRead", …)` | client | needs verification | |
| `/providers` | `(admin)/providers/page.tsx` | mw | active admin (layout) + API | client (bulk/import/export) | needs verification | `"use client"`, no top-level guard |
| `/providers/[id]` | `(admin)/providers/[id]/page.tsx` | mw | active admin (layout) + API | client | needs verification | `"use client"` |
| `/providers/[id]/edit` | `(admin)/providers/[id]/edit/page.tsx` | mw | active admin (layout) + API | client | needs verification | `"use client"` |
| `/providers/coverage` | `(admin)/providers/coverage/page.tsx` | mw | active admin (layout) + API | client | needs verification | `"use client"` |
| `/providers/needs-logo` | `(admin)/providers/needs-logo/page.tsx` | mw | active admin (layout) + API | client (auto-fetch logos) | needs verification | `"use client"` |
| `/providers/new` | `(admin)/providers/new/page.tsx` | mw | active admin (layout) + API | client form | needs verification | `"use client"` |
| `/reports` | `(admin)/reports/page.tsx` | mw | active admin (layout) + API | client (7 markers) | partial | `"use client"`, no top-level guard |
| `/runtime-config` | `(admin)/runtime-config/page.tsx` | mw | `requirePageRole("SUPER_ADMIN")` | client | needs verification | strictest gate |
| `/security` | `(admin)/security/page.tsx` | mw | `requirePagePermission("settings","canRead", ADMIN)` | client | needs verification | |
| `/security/dashboard` | `(admin)/security/dashboard/page.tsx` | mw | `requirePagePermission("audit_logs","canRead", ADMIN)` | client | needs verification | |
| `/settings` | `(admin)/settings/page.tsx` | mw | `requirePagePermission("settings","canRead", ADMIN)` | client | needs verification | |
| `/settings/health` | `(admin)/settings/health/page.tsx` | mw | active admin (layout) + API | client | needs verification | `"use client"`, no top-level guard |
| `/settings/two-factor` | `(admin)/settings/two-factor/page.tsx` | mw (MFA-setup surface, allow-listed) | active admin (layout); reachable during MFA enroll | `/api/auth/mfa/*` | has setup/verify/disable flow | `"use client"` |
| `/sponsored` | `(admin)/sponsored/page.tsx` | mw | `requirePagePermission("providers","canRead", …)` | client | needs verification | test pins guard |
| `/state-rules` | `(admin)/state-rules/page.tsx` | mw | active admin (layout) + API; step-up on write | client | needs verification | `"use client"`, no top-level guard |
| `/subscriptions` | `(admin)/subscriptions/page.tsx` | mw | `requirePagePermission("subscriptions","canRead", …)` | client | needs verification | |
| `/support` | `(admin)/support/page.tsx` | mw | active admin (layout) + API | client | needs verification | `"use client"`, no top-level guard |
| `/support/[id]` | `(admin)/support/[id]/page.tsx` | mw | `requirePagePermission("tickets","canRead", MODERATOR)` | server/client | needs verification | |
| `/team` | `(admin)/team/page.tsx` | mw | `requirePagePermission("admin_users","canRead", …)` | client | needs verification | |
| `/tickets` | `(admin)/tickets/page.tsx` | mw | redirect → `/support` | none | n/a | alias |
| `/tickets/[id]` | `(admin)/tickets/[id]/page.tsx` | mw | redirect → `/support/[id]` | none | n/a | alias |
| `/users` | `(admin)/users/page.tsx` | mw | active admin (layout) + API; step-up on export/delete | client | needs verification | `"use client"`, no top-level guard |
| `/users/[id]` | `(admin)/users/[id]/page.tsx` | mw | `requirePagePermission("users","canRead", VIEWER)` | server/client | needs verification | |
| `/waitlist` | `(admin)/waitlist/page.tsx` | mw | active admin (layout) + API; step-up on export | client | needs verification | `"use client"`, no top-level guard |
| `/workspaces` | `(admin)/workspaces/page.tsx` | mw | `requirePagePermission("users","canRead", VIEWER)` | server/client | needs verification | |
| `/workspaces/[id]` | `(admin)/workspaces/[id]/page.tsx` | mw | `requirePagePermission("users","canRead", VIEWER)` | server/client | needs verification | |
| `/login` | `login/page.tsx` | Public (PUBLIC_EXACT) | none | `/api/auth/login` | needs verification | |
| `/set-password` | `set-password/page.tsx` | Public (token-gated) | invite token | `/api/auth/set-password` | needs verification | |
| `/set-password/change` | `set-password/change/page.tsx` | mw (forced-rotation surface, allow-listed) | admin during rotation | `/api/auth/force-password-change` | needs verification | reachable when `mcp` claim set |

**Note on "no top-level guard" admin pages:** these client pages still require `admin_session` (middleware) and `requirePageAdmin()` (layout) to render, and their data APIs re-validate role/permission (per `page-guard.ts` doc: "server APIs remain authoritative"). They do NOT fail-closed at the page level for role tiers, so a low-tier admin can load the page chrome before APIs 403. Lower risk than a missing session guard, but inconsistent with the privileged pages that call `requirePagePermission`. Flagged as `route-map-03`.

---

## Mobile screens (`apps/mobile/app`)

Auth gate = `AuthGuard` in `_layout.tsx`. Public-without-session segments: `(auth)`, `oauth`, `reset-password`, `blog`. Everything else requires a session token. Theme = global light/dark via `ThemeProvider`. Responsive = native (RN). SEO = n/a. Screens predominantly use `@tanstack/react-query` (loading/empty/error markers confirmed on sampled screens).

| Screen | File | Auth required? | State (loading/empty/error) | Notes |
|---|---|---|---|---|
| `(auth)/_layout` | `(auth)/_layout.tsx` | No (auth group) | n/a | layout |
| `(auth)/forgot-password` | `(auth)/forgot-password.tsx` | No | needs verification | |
| `(auth)/sign-in` | `(auth)/sign-in.tsx` | No | needs verification | OAuth + password |
| `(auth)/sign-up` | `(auth)/sign-up.tsx` | No | needs verification | |
| `(tabs)/_layout` | `(tabs)/_layout.tsx` | Yes | n/a | tab bar |
| `(tabs)/addresses` | `(tabs)/addresses.tsx` | Yes | Yes (29 markers) | |
| `(tabs)/index` (home) | `(tabs)/index.tsx` | Yes | Yes (41 markers) | dashboard |
| `(tabs)/more` | `(tabs)/more.tsx` | Yes | needs verification | menu |
| `(tabs)/moving` | `(tabs)/moving.tsx` | Yes | needs verification | |
| `(tabs)/services` | `(tabs)/services.tsx` | Yes | Yes (36 markers) | |
| `+not-found` | `+not-found.tsx` | No | n/a | 404 |
| `_layout` (root) | `_layout.tsx` | n/a | n/a | AuthGuard host |
| `addresses/[id]/edit` | `addresses/[id]/edit.tsx` | Yes | needs verification | |
| `addresses/[id]/index` | `addresses/[id]/index.tsx` | Yes | needs verification | |
| `addresses/new` | `addresses/new.tsx` | Yes | needs verification | |
| `blog/[slug]` | `blog/[slug].tsx` | No (public blog segment) | needs verification | |
| `blog/_layout` | `blog/_layout.tsx` | No | n/a | |
| `blog/index` | `blog/index.tsx` | No | needs verification | |
| `budget/[id]` | `budget/[id].tsx` | Yes | needs verification | |
| `budget/index` | `budget/index.tsx` | Yes | needs verification | |
| `budget/new` | `budget/new.tsx` | Yes | needs verification | |
| `custom-providers/[id]` | `custom-providers/[id].tsx` | Yes | needs verification | |
| `custom-providers/[id]/edit` | `custom-providers/[id]/edit.tsx` | Yes | needs verification | |
| `custom-providers/index` | `custom-providers/index.tsx` | Yes | needs verification | |
| `help/index` | `help/index.tsx` | Yes | needs verification | |
| `help/tickets` | `help/tickets.tsx` | Yes | needs verification | |
| `help/tickets/[id]` | `help/tickets/[id].tsx` | Yes | needs verification | |
| `invitations/[token]` | `invitations/[token].tsx` | Yes (token captured pre-auth, joins after auth) | needs verification | deep link |
| `moving/[id]` | `moving/[id].tsx` | Yes | Yes (50 markers) | |
| `moving/new` | `moving/new.tsx` | Yes | needs verification | |
| `notifications/index` | `notifications/index.tsx` | Yes | Yes (21 markers) | |
| `oauth` | `oauth.tsx` | No (oauth segment) | needs verification | callback |
| `onboarding` | `onboarding.tsx` | Yes (session, pre-onboarding) | needs verification | gated by completion flag |
| `providers/[id]` | `providers/[id].tsx` | Yes | needs verification | |
| `providers/compare` | `providers/compare.tsx` | Yes | needs verification | |
| `providers/index` | `providers/index.tsx` | Yes | Yes (26 markers) | |
| `reminders/index` | `reminders/index.tsx` | Yes | needs verification | |
| `reset-password/[token]` | `reset-password/[token].tsx` | No (reset-password segment) | needs verification | |
| `search` | `search.tsx` | Yes | needs verification | |
| `services/[id]` | `services/[id].tsx` | Yes | needs verification | |
| `services/[id]/edit` | `services/[id]/edit.tsx` | Yes | needs verification | |
| `services/new` | `services/new.tsx` | Yes | needs verification | |
| `settings/address-changes` | `settings/address-changes.tsx` | Yes | needs verification | |
| `settings/connections` | `settings/connections.tsx` | Yes | needs verification | |
| `settings/delete-account` | `settings/delete-account.tsx` | Yes | needs verification | |
| `settings/export` | `settings/export.tsx` | Yes | needs verification | |
| `settings/notifications` | `settings/notifications.tsx` | Yes | needs verification | |
| `settings/privacy` | `settings/privacy.tsx` | Yes | needs verification | |
| `settings/profile` | `settings/profile.tsx` | Yes | needs verification | |
| `settings/subscription` | `settings/subscription.tsx` | Yes | needs verification | IAP billing |
| `settings/two-factor` | `settings/two-factor.tsx` | Yes | needs verification | |
| `settings/workspace` | `settings/workspace.tsx` | Yes | needs verification | |
| `setup-password` | `setup-password.tsx` | Yes (session; OAuth-only users opt-in) | needs verification | |
| `workspace/accept-invite` | `workspace/accept-invite.tsx` | Yes | needs verification | |

---

## Deep-dive findings

### route-map-01 (High) — Partner self-service pages are unreachable while logged out (missing public allow-list entry)
`/partners/apply` and `/partners/portal` are NOT in web `PUBLIC_PATHS` (`apps/web/src/middleware.ts:26-59`). The page-route branch (lines 838-848) redirects any request without a valid `user_session` to `/sign-in`. But `partners/portal/page.tsx` implements its OWN magic-link/partner-cookie session (`getPartnerPortalSession`, line 22) and renders a public sign-in form — which a logged-out partner can never reach because the middleware intercepts first. Compare with movers, where BOTH `/movers/apply` and `/movers/portal` are explicitly allow-listed (lines 56-57). Impact: partners cannot self-apply or sign into their portal unless they already hold a consumer `user_session`; the entire partner acquisition + self-serve surface is effectively dead from a clean browser. Recommendation: add `/partners/apply` and `/partners/portal` to `PUBLIC_PATHS` (mirroring movers), keeping the in-page partner-session gate on `/partners/portal`. [needs verification of business intent — but the code path is unambiguous.]

### route-map-02 (Medium) — `/unsubscribe` page is session-gated though its API is public
`/api/unsubscribe` is in `PUBLIC_API_EXACT` (`middleware.ts:104`) and `/unsubscribe` is in the noindex list (line 660), yet `/unsubscribe` is NOT in `PUBLIC_PATHS`. Email recipients (typically logged out, clicking from their inbox) hit the page route, get redirected to `/sign-in?redirect=/unsubscribe`, and cannot complete an unsubscribe without authenticating. Impact: broken one-click unsubscribe for logged-out users — a compliance/UX problem for transactional + marketing email. Recommendation: add `/unsubscribe` to `PUBLIC_PATHS`. [needs verification: confirm the unsubscribe page does not require the session and operates purely on a token/email param.]

### route-map-03 (Medium) — Privileged admin pages with no page-level role guard (fail-open chrome)
Several admin pages are `"use client"` with no `requirePagePermission`/`requirePageRole` call, relying only on `(admin)/layout.tsx`'s `requirePageAdmin()` (any active admin) plus API-level checks: `analytics`, `help-center`, `moving`, `provider-governance`, `providers` (+ `[id]`, `[id]/edit`, `coverage`, `needs-logo`, `new`), `reports`, `settings/health`, `state-rules`, `support`, `users`, `waitlist`. A VIEWER-tier admin can load the page chrome (and any data the page fetches before the API 403s) for surfaces that peers gate at ADMIN (e.g. `security`, `feature-flags`). `page-guard.ts` (lines 1-22) explicitly states privileged pages "MUST fail closed before rendering". `users`/`waitlist`/`providers` perform destructive/export actions and lean on per-action step-up + API checks. Impact: inconsistent fail-closed posture; potential pre-API data exposure for under-privileged admins. Recommendation: add an explicit `requirePagePermission(...)` to each privileged client page (a thin server wrapper) to match the rest of the panel. [needs verification: confirm each listed page's data API enforces the intended minimum role.]

### route-map-04 (Low) — Server list pages with no own empty/error state delegate entirely to client companions
Web `(app)` server pages (`addresses`, `dashboard`, `providers`, `services`) fetch data server-side and render only `<XClient initial={…}/>` with no own empty/error branch; the states live in the `-client.tsx` companion (confirmed: empty/length markers present in each). `(app)/error.tsx` + root `error.tsx` provide a render-error boundary. No `loading.tsx` route files exist anywhere (`Glob` for `**/loading.tsx` = none), so there are no route-level Suspense fallbacks — first paint depends on in-component skeletons. Impact: low; acceptable pattern but undocumented and inconsistent. Recommendation: none required; noted for completeness.

### route-map-05 (Info) — Token/cookie sub-sessions outside the primary auth model
Three independent session systems beyond `user_session`/`admin_session`: mover-portal (`getMoverPortalSession`), partner-portal (`getPartnerPortalSession`), and short-lived HMAC tokens for blog preview (`blog/preview/[token]`), invitations, password reset, email verify, set-password. These pages sit on the web `PUBLIC_PATHS` allow-list (or should — see route-map-01) and gate in-page. Documented here so downstream auth/security audits treat them as distinct trust boundaries.
