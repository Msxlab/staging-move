# Adversarial Verification — route-map-01

**Finding under review:** Partner self-service pages (`/partners/apply`, `/partners/portal`) unreachable while logged out — missing public allow-list entry.
**Original severity:** High · **Category:** Logic
**Verdict:** CONFIRMED (and broader than originally reported)

## What the original finding claimed
- `apps/web/src/middleware.ts` `PUBLIC_PATHS` allow-lists `/movers/apply` and `/movers/portal` but NOT the `/partners/*` equivalents.
- The page-route branch redirects non-session requests to `/sign-in`.
- `partners/portal/page.tsx` renders a public magic-link request form that a logged-out partner can never reach.
- Impact: the entire partner acquisition + self-serve surface is dead from a clean browser.

## Evidence read in code

### 1. Allow-list is missing every `/partners` entry
`apps/web/src/middleware.ts:26-59` — `PUBLIC_PATHS` contains `/movers/apply` (line 56) and `/movers/portal` (line 57) but no `/partners/...` entry. A repo-wide grep for `partners` inside `middleware.ts` returns **zero matches** — the string never appears in any allow-list (`PUBLIC_PATHS`, `PUBLIC_API_EXACT` lines 87-117, `PUBLIC_API_PREFIXES` lines 76-86, `PUBLIC_API_GET` lines 118-126).

### 2. The page-route branch redirects logged-out visitors
`apps/web/src/middleware.ts:838-848`:
- `isPublicPath("/partners/portal")` → `isPublicStatePage` is false, and `matchesPathOrChild` (lines 128-130: exact match or `path + "/"` prefix) matches no `PUBLIC_PATHS` entry → returns `false`.
- `hasValidSession(request)` validates the **`user_session` JWT** (lines 575-607). A logged-out partner has no such cookie → `false`.
- Falls through to lines 846-848: `redirect(/sign-in?redirect=/partners/portal)`.

The matcher `["/((?!_next|.*\\..*).*)", "/api/(.*)"]` (line 852) matches `/partners/portal` and `/partners/apply` (no dot, not `_next`), so middleware definitely runs.

### 3. The pages are genuinely built to be public-facing
- `apps/web/src/app/partners/portal/page.tsx:22,26-36` — calls `getPartnerPortalSession()` and, when there is **no** session, renders `<PartnerPortalRequestForm />` (the magic-link request form). This is the signed-out entry point.
- `apps/web/src/lib/partner-portal-auth.ts:13,71-76` — `getPartnerPortalSession` reads the **`partner_portal`** cookie, a completely separate session from the consumer `user_session`. So holding a consumer session does not even grant portal access; the page is unambiguously meant for unauthenticated partners.
- `apps/web/src/app/partners/apply/page.tsx:16-45` — renders `<PartnerApplyForm />` behind a feature flag; comment at line 13 says "Server-rendered so the partner_registration_v1 gate is evaluated per request." Clearly a public acquisition page.
- The mover analog `apps/web/src/app/movers/portal/page.tsx:14-35` is the identical pattern and IS allow-listed — confirming the `/partners` omission is an oversight, not intent.

### 4. Scope is BROADER than originally reported
The original finding only named the two page roots. The break also takes down:
- **`/partners/portal/enter`** (`apps/web/src/app/partners/portal/enter/route.ts:10-15`) — the magic-link consumption endpoint. Not allow-listed, not an `/api/` path → middleware redirects a logged-out partner to `/sign-in` before the token is ever consumed. And the magic-link email points exactly here: `apps/web/src/app/api/partners/portal/request/route.ts:41` builds `absoluteUrl('/partners/portal/enter?token=...')`. So even an emailed magic link cannot complete sign-in.
- **The form-target APIs are also gated.** `partner-apply-form.tsx:50` POSTs to `/api/partners`; `partner-portal-request-form.tsx:21` POSTs to `/api/partners/portal/request`. Neither is in any `PUBLIC_API_*` list. For `/api/` paths, `middleware.ts:816-834` returns **401 `UNAUTHORIZED`** to any request without a valid `user_session`. The route handler comment at `apps/web/src/app/api/partners/route.ts:41` even says "public generic-partner self-service application" — but middleware never lets an anonymous caller reach it.

## Why this is real, not a false positive
- The guard is in middleware itself (not bypassed by a wrapper). There is no `(public)` route group or parent-path allow-list entry that would rescue `/partners/*` — `partners/` is a top-level app dir, not under `(app)`, so its pathname is literally `/partners/...`.
- The parallel `/movers/*` surface being explicitly allow-listed is direct evidence the `/partners` omission is unintended.

## Impact
A clean-browser visitor (no consumer account) cannot:
- open the partner application form (`/partners/apply` → `/sign-in`),
- open the partner portal login (`/partners/portal` → `/sign-in`),
- complete a magic link (`/partners/portal/enter` → `/sign-in`),
- or have any form succeed (`/api/partners`, `/api/partners/portal/request` → 401).

The entire generic-partner acquisition and self-serve funnel is dead unless the visitor already holds a consumer `user_session` — which partners, by design, do not. This is a functional (Logic) break of a whole product surface.

## Recommendation
Add `/partners/apply`, `/partners/portal`, and `/partners/portal/enter` to `PUBLIC_PATHS`, and add `/api/partners` plus the `/api/partners/portal/` request endpoint (mirroring how `/api/movers/portal/` is a public prefix and `/api/movers/apply` is public-exact) to the public API allow-lists. Keep the portal-cookie / feature-flag checks inside the routes as the real gate, exactly as the movers surface does.

## Severity assessment
Severity **High** is appropriate (arguably could be argued up given it kills an entire revenue/acquisition funnel, but High is defensible since it is a functional dead-surface, not a data-exposure issue). No downgrade warranted.
