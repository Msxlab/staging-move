# Module Map

Durum: 2026-06-08 ilk full-pass modul ve baglanti haritasi.

## Ust Seviye Baglanti Haritasi

```text
apps/mobile
  -> packages/shared (tipler, validators, ApiClient, domain kurallari)
  -> apps/web /api/* (Bearer JWT ile)

apps/web
  -> packages/shared (billing, entitlement, recommendations, provider coverage, task lifecycle)
  -> packages/db (Prisma client, coverage metadata)
  -> packages/connectors (connector registry/runtime)
  -> dis servisler: Stripe, Resend, Google/Apple OAuth, Google Maps/Places, App Store, Play Store, Upstash, R2/imgproxy, FCC BDC

apps/admin
  -> packages/shared (billing, entitlement, runtime/shared helpers)
  -> packages/db (Prisma client)
  -> packages/connectors (connector admin/health yuzeyi)
  -> apps/web internal endpoints (impersonation, blog revalidate vb. secret-auth ile)

packages/db
  -> Prisma schema, migrations, seed scripts, soft-delete extension

packages/connectors
  -> connector core: manifest, registry, dispatcher, executor, OAuth, retry, circuit breaker, HTTP client
  -> usps connector module

packages/shared
  -> framework-agnostic domain: billing, entitlement, permissions, workspace, relocation checklist, provider scoring, move lifecycle, validators, API client
```

## Ana Moduller

### Auth/session

- Web user auth: `apps/web/src/lib/user-auth.ts`.
- Web API/page middleware: `apps/web/src/middleware.ts`.
- Admin auth: `apps/admin/src/lib/auth.ts`.
- Admin middleware/page guard: `apps/admin/src/middleware.ts`, `apps/admin/src/lib/page-guard.ts`.
- Mobile token store: `apps/mobile/src/lib/auth-store.ts`, `apps/mobile/src/lib/auth.ts`.

Fonksiyonlar:

- Web cookie ve mobile bearer JWT kabul eder.
- DB-backed session row, fingerprint, expiry, soft-delete user ve email/legal gate kontrol eder.
- Admin role/permission DB'den tekrar okunur; hassas admin islemleri password/MFA step-up ister.

### User domain

- Profile: `apps/web/src/app/api/profile/route.ts`.
- Addresses: `apps/web/src/app/api/addresses/**`.
- Services: `apps/web/src/app/api/services/**`.
- Moving plans: `apps/web/src/app/api/moving/**`.
- Move tasks: `apps/web/src/app/api/move-tasks/route.ts`.
- Budget: `apps/web/src/app/api/budget/route.ts`.

Fonksiyonlar:

- Address/service/move CRUD, soft delete, workspace scope, plan limit, validation ve move-task sync.
- Sensitive service fields ve formatted address encryption/redaction.
- Budget write premium gate, workspace view/manage ayrimi.

### Providers/recommendations

- Public/provider API: `apps/web/src/app/api/providers/**`.
- User services API: `apps/web/src/app/api/services/**`.
- Admin provider ops: `apps/admin/src/app/api/providers/**`.
- Shared scoring/coverage: `packages/shared/src/recommendation-engine.ts`, `provider-coverage.ts`, `provider-integrity.ts`.

Fonksiyonlar:

- Provider catalog, coverage, compare, recommendations, public detail/list.
- Recommendation engine urgency, coverage, profile/state/community/FCC signals ile deterministic scoring yapar.
- Public popularity endpoint F-002 mahremiyet riski tasiyor.

### Billing/entitlement

- Shared resolver: `packages/shared/src/entitlement.ts`.
- Billing config/plans: `packages/shared/src/billing.ts`, `apps/web/src/lib/billing.ts`.
- Web plan limits: `apps/web/src/lib/plan-limits.ts`.
- Stripe/IAP endpoints: `apps/web/src/app/api/stripe/**`, `apps/web/src/app/api/mobile/iap/**`, `apps/web/src/app/api/webhooks/**`.

Fonksiyonlar:

- Stripe Checkout/Portal/subscription actions.
- Stripe webhook: signature, body cap, idempotency, out-of-order protection, subscription sync.
- App Store/Play Store: JWS/OIDC verification, store refresh, receipt ownership guard.
- Workspace seat reconciliation when owner plan changes.

### Workspace/family model

- Feature flag: `WORKSPACE_MODEL_ENABLED`.
- Context/scope: `apps/web/src/lib/workspace-context.ts`, `apps/web/src/lib/workspace-data-scope.ts`.
- API: `apps/web/src/app/api/workspaces/**`.
- Web UI: `apps/web/src/app/(app)/settings/workspace/page.tsx`.
- Mobile UI: `apps/mobile/app/settings/workspace.tsx`.
- Shared permissions: `packages/shared/src/permissions.ts`.

Fonksiyonlar:

- Owner/admin/member/child/view-only roles.
- Workspace scope for addresses/services/moves/budgets/tasks.
- Seat limits from Family/Pro entitlement.
- F-005 connector sync drift workspace/member entitlement tarafinda risk yaratiyor.

### Connectors

- Web runtime: `apps/web/src/lib/connector-runtime.ts`, `connector-oauth.ts`, `connector-registry.ts`.
- Web APIs: `/api/connectors/*`, `/api/connector-dispatch`, `/api/partner-consents/*`, `/api/workspaces/[id]/sync`.
- Admin APIs/UI: `apps/admin/src/app/(admin)/connectors/**`, `apps/admin/src/app/api/connectors/**`.
- Package: `packages/connectors/**`.

Fonksiyonlar:

- Manifest registry, mode resolver, OAuth consent, address change queue, retry/circuit breaker, fallback actions.
- USPS reference connector exposes COA push/readback/healthcheck.
- HTTP client HTTPS + allowlisted host + redirect auth stripping davranisi var.

### Admin operations

- Backups: `apps/admin/src/app/api/backup/**`, `apps/admin/src/lib/backup-*`.
- Runtime config: `apps/admin/src/app/api/runtime-config/route.ts`, `apps/admin/src/lib/runtime-config.ts`.
- Security: `apps/admin/src/app/api/security/**`, `apps/admin/src/lib/security-readiness.ts`.
- Logs/audit: `apps/admin/src/app/api/logs/**`, `apps/admin/src/lib/audit.ts`.

Fonksiyonlar:

- Backup create/download/import/verify/retention with SUPER_ADMIN + MFA + audit.
- Runtime config value validation, encryption-at-rest, metadata-only audit.
- Key rotation with distributed lock and dry-run.
- Security readiness for config, alerting, backups and DB transport.

### Blog/content/public

- Public blog pages/API in web.
- Admin editor/content APIs with Tiptap.
- R2/imgproxy-backed uploads and public image route.
- Public homepage in `apps/web/src/app/page.tsx`.

Fonksiyonlar:

- SEO/OpenGraph/Twitter/JSON-LD.
- Blog listing/detail/feed/IndexNow.
- Public waitlist, pricing, app CTA, feature flag controlled connector/workspace copy.

### Ops/scripts/deployment

- Cron schedules: `docker/ofelia.ini`.
- Docker/deploy surfaces: root `Dockerfile`, `docker-compose*.yml`, `docker/`.
- Scripts: seeds, backup/ops helpers, connector scaffold, FCC ingest placeholder.

Not:

- Cron endpoints generally use shared `guardCronRequest()`.
- F-001 is the outlier: partner consent refresh is not under `/api/cron`.
- F-007 tracks script placeholder risk.
