# Route Auth Matrix: First-Pass Static Inventory

Date: 2026-06-22
Scope: `apps/web/src/app/api/**/route.ts` and `apps/admin/src/app/api/**/route.ts`

This is a static first-pass route matrix. It is useful for prioritization, but it is not yet a completed manual proof for every endpoint.

## Method

The pass scanned every API `route.ts` file for:

- exported HTTP methods
- route family from path
- route-level guard helpers such as `requireDbUserId`, `requireVerifiedUser`, `requireAppMutationUser`, `getUserSession`, `requirePermission`, `requirePasswordConfirm`, `requireWorkspaceStepUp`, `guardCronRequest`, `verifyInternalAuth`, webhook signature checks, tracking consent helpers, and portal-session helpers

Middleware was reviewed separately because some intentionally public endpoints rely on central allowlists.

Evidence:

- Web middleware public API allowlists begin at `apps/web/src/middleware.ts:76`.
- Web middleware matcher includes `/api/(.*)` at `apps/web/src/middleware.ts:852`.
- Admin public exact paths begin at `apps/admin/src/middleware.ts:24`.
- Admin middleware matcher covers the admin app at `apps/admin/src/middleware.ts:809`.

## Summary Counts

| Surface | Category | Route files |
| --- | --- | ---: |
| web | user-auth | 79 |
| web | cron | 29 |
| web | auth-bootstrap | 24 |
| web | no route guard detected by static scan | 19 |
| web | other-guarded | 7 |
| web | webhook | 4 |
| web | partner/mover portal | 4 |
| web | internal | 3 |
| web | tracking-auth | 2 |
| admin | admin-permission | 105 |
| admin | auth-bootstrap | 12 |
| admin | no route guard detected by static scan | 4 |
| admin | cron | 2 |
| admin | internal | 2 |

## Middleware-Public Or Middleware-Only Routes

These routes were detected without a route-level guard by the static scan. Many are expected public routes by middleware allowlist; they still require manual review for rate limiting, input validation, privacy, and abuse resistance.

| Surface | Route | Methods | Current interpretation |
| --- | --- | --- | --- |
| admin | `blog/image` | GET | Middleware-only admin route; not in admin public exact paths. Route validates `key` and redirects. |
| admin | `build-info` | GET | Public exact path in admin middleware. |
| admin | `healthz` | GET | Public exact path in admin middleware. |
| admin | `ready` | GET | Public exact path in admin middleware. |
| web | `account/restore` | GET | Public GET exact/prefix route; comment says emailed HMAC token is auth. Needs token-flow review. |
| web | `acquisition/public-trial-campaign` | GET | Public GET route. |
| web | `blog/indexnow-key/[key]` | GET | Public blog/search route. |
| web | `blog/posts` | GET | Public blog route. |
| web | `blog/posts/[slug]` | GET | Public blog route. |
| web | `blog/view` | POST | Public tracking-style write; route-level rate limit observed. |
| web | `build-info` | GET | Public exact path. |
| web | `health` | GET | Public prefix. |
| web | `help` | GET | Public prefix. |
| web | `help/feedback` | POST | Public feedback write; route-level rate limit observed. |
| web | `mobile/iap/products` | GET | Public exact path for product metadata. |
| web | `movers/apply` | POST | Public mover application intake; route-level rate limit, body limits, file checks observed. |
| web | `movers/portal/logout` | POST | Public portal prefix; should be harmless logout. |
| web | `partners` | POST | Public partner application intake; route-level rate limit and consent schema observed. |
| web | `partners/portal/logout` | POST | Public partner portal logout. |
| web | `providers` | GET | Public provider catalog. |
| web | `providers/[id]` | GET | Public provider detail. |
| web | `providers/popular` | GET | Public provider listing. |
| web | `ready` | GET | Public exact path. |

## Public Write / Intake Review Queue

These are not confirmed vulnerabilities. They are endpoints where public access is intended or likely intended, but abuse, spam, data retention, and PII handling should be checked first in the next pass.

| Route | Evidence | Why review |
| --- | --- | --- |
| `POST /api/movers/apply` | Public route in middleware at `apps/web/src/middleware.ts:116`; route rate limit at `apps/web/src/app/api/movers/apply/route.ts:66`; local content-length cap at `apps/web/src/app/api/movers/apply/route.ts:74-75`; file count/type/size checks at `apps/web/src/app/api/movers/apply/route.ts:98-123`; creates `MoverApplication` at `apps/web/src/app/api/movers/apply/route.ts:136`. | Public multipart DB/R2 write path; verify abuse controls, storage cleanup, PII minimization, and admin review workflow. |
| `POST /api/partners` | Route comment says public self-service application at `apps/web/src/app/api/partners/route.ts:41-45`; rate limit at `apps/web/src/app/api/partners/route.ts:52`; consent schema at `apps/web/src/app/api/partners/route.ts:16-29`; creates partner row at `apps/web/src/app/api/partners/route.ts:69`. | Public partner application DB write; verify feature gate behavior, spam controls, consent wording, and review workflow. |
| `POST /api/help/feedback` | Rate limit at `apps/web/src/app/api/help/feedback/route.ts:8`; public prefix in middleware at `apps/web/src/middleware.ts:80`. | Public feedback write; verify dedupe/spam handling and data retention. |
| `POST /api/blog/view` | Rate limit at `apps/web/src/app/api/blog/view/route.ts:45`; public exact path in middleware at `apps/web/src/middleware.ts:111`. | Public analytics-style write; verify volume controls and privacy. |

## Step-Up Review Queue

The static scan flagged mutating routes with sensitive path keywords and no detected `requirePasswordConfirm` or `requireWorkspaceStepUp`. Most are not necessarily bugs; many are normal authenticated actions. The standout issue promoted to a finding is workspace membership administration.

| Route | Methods | Auth signal | Step-up signal | Status |
| --- | --- | --- | --- | --- |
| `web/workspaces/[id]/invitations` | POST | `getUserSession` and workspace `can(...)` checks | none detected | Finding `SEC-WORKSPACE-001` |
| `web/workspaces/[id]/members/[memberId]` | PATCH, DELETE | `getUserSession` and workspace `can(...)` checks | none detected | Finding `SEC-WORKSPACE-001` |
| `web/workspaces/[id]` | PATCH | `getUserSession` and workspace `can(...)` checks | none detected | Manual review |
| `web/workspaces/[id]/rename` | PATCH | auth detected | none detected | Manual review |
| `web/custom-providers/[id]` | PATCH, DELETE | user auth detected | none detected | Manual review |
| `web/subscription/change-plan` | POST | user auth detected | none detected | Manual review with billing matrix |
| `web/subscription/switch-cycle` | POST | user auth detected | none detected | Manual review with billing matrix |
| `admin/providers` | POST, PUT | `requirePermission` detected | none detected | Manual review; creation/update may not need password step-up |
| `admin/connectors/test-connection` | POST | `requirePermission` detected | none detected | Manual review; external integration boundary |
| `admin/connectors/healthcheck` | POST | `requirePermission` detected | none detected | Manual review; external integration boundary |
| `admin/connector-fallbacks` | POST, DELETE | `requirePermission` detected | none detected | Finding `SEC-CONNECTOR-001`; URL type validation and audit reduce severity |

## Promoted Finding

### SEC-WORKSPACE-001: Workspace member administration lacks step-up parity

See:

- `docs/audit/10_GLOBAL_FINDINGS.md`
- `docs/audit/reports/medium.md`
- `docs/audit/modules/workspaces-household.md`

Additional connector step-up finding:

- `SEC-CONNECTOR-001` is tracked in `docs/audit/reports/low.md` and `docs/audit/reports/connectors-address-change-route-matrix.md`.

## Next Matrix Work

1. Convert this first-pass matrix into a full route-by-route table with one row per route.
2. Add columns for public/middleware/auth helper, mutation type, data class, CSRF boundary, rate limit key, step-up requirement, and test coverage.
3. Manually inspect every route listed in `Step-Up Review Queue`.
4. Treat billing, connectors, account deletion, backup/import, webhooks, and admin mutations as high-risk rows.
