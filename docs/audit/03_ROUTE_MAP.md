# Route Map

This is an inventory-level map, not a completed route-by-route authorization proof.

## Counts

| Surface | Count |
| --- | ---: |
| Web pages, `apps/web/src/app/**/page.tsx` | 74 |
| Web API route files, `apps/web/src/app/api/**/route.ts` | 171 |
| Admin pages, `apps/admin/src/app/**/page.tsx` | 62 |
| Admin API route files, `apps/admin/src/app/api/**/route.ts` | 125 |
| Mobile screen files, `apps/mobile/app/**/*.tsx` | 54 |

## Web Route Families

| Family | Path pattern | Guard pattern observed | Audit status |
| --- | --- | --- | --- |
| Public content/pages | `apps/web/src/app/**/page.tsx` | Middleware public path classification plus app-level data loading. | needs deep dive |
| User account/auth APIs | `apps/web/src/app/api/auth/**` | Auth helpers and middleware. | needs deep dive |
| Workspace APIs | workspace-scoped API paths | Expected to use `requireWorkspaceContext`. | needs verification |
| Tracking/analytics | `apps/web/src/app/api/tracking/**` | Auth plus consented tracking session in sampled route. | finding logged |
| Cron | `apps/web/src/app/api/cron/**` | Shared cron guard/internal auth observed. | sampled |
| Internal | `apps/web/src/app/api/internal/**` | `verifyInternalAuth` observed. | sampled |
| Webhooks | `apps/web/src/app/api/webhooks/**` | Apple/Google signature and package/audience checks observed in sampled files. | sampled |
| Affiliate postbacks | `apps/web/src/app/api/affiliate/postback/**` | HMAC signature verification observed. | sampled |

## Admin Route Families

| Family | Path pattern | Guard pattern observed | Audit status |
| --- | --- | --- | --- |
| Admin pages | `apps/admin/src/app/**/page.tsx` | Middleware session, MFA, and password-rotation gates. | needs visual/permission deep dive |
| Admin auth APIs | `apps/admin/src/app/api/auth/**` | Admin auth helpers and session checks. | sampled |
| Admin analytics/billing/users/providers | `apps/admin/src/app/api/**` | `requirePermission` widely observed. | needs full matrix |
| Admin backup/import/export | `apps/admin/src/app/api/backup/**` | Permission and password-confirm helpers observed in sampled files. | high-risk deep dive required |
| Admin cron/internal | `apps/admin/src/app/api/cron/**`, `apps/admin/src/app/api/internal/**` | `verifyInternalAuth` observed. | sampled |
| Admin blog image proxy | `apps/admin/src/app/api/blog/image/route.ts` | Route relies on admin middleware for access boundary. | needs deployment/matcher verification |

## Required Next Route Work

First-pass static matrix added:

- `docs/audit/reports/route-auth-matrix.md`
- `docs/audit/reports/billing-iap-route-matrix.md`
- `docs/audit/reports/connectors-address-change-route-matrix.md`
- `docs/audit/reports/privacy-export-deletion-matrix.md`
- `docs/audit/reports/admin-backup-import-matrix.md`

Remaining route work:

1. Convert the first-pass matrix into a full one-row-per-route proof table.
2. Mark each route as public, user-authenticated, workspace-authenticated, admin-authenticated, cron, internal, or webhook.
3. Verify each mutating route has CSRF or an explicit non-browser authentication boundary.
4. Verify each destructive/admin-sensitive route uses `requirePasswordConfirm`, `requireWorkspaceStepUp`, or an explicitly accepted no-step-up rationale.
5. Link every route to tests, or record `not verified in code`.
