# Admin Analysis

Durum: 2026-06-08 ilk full-pass inceleme.

## Yapisi

- Ayrik Next.js App Router uygulamasi, port 3001.
- Admin API route handler: 107.
- Admin page/layout: 56.
- Ana admin page gruplari:
  - dashboard
  - users
  - workspaces
  - providers / provider coverage / provider governance
  - connectors / connector metrics / connector fallbacks
  - backups
  - billing / subscriptions
  - analytics / reports
  - logs
  - blog / email templates / help center
  - security / runtime config / feature flags / team / settings

## Guard Modeli

- `apps/admin/src/middleware.ts`:
  - IP rules + break-glass login bypass
  - CSP nonce
  - body size limit
  - in-memory admin route rate limit
  - CSRF checks
  - admin JWT cookie verification
  - forced password change gate
  - MFA setup gate
  - session fingerprint check
- `apps/admin/src/lib/auth.ts`:
  - DB-tracked admin sessions
  - role re-read from DB
  - permissions
  - password/MFA step-up confirmation
- `apps/admin/src/lib/page-guard.ts`:
  - server-side page role/permission guard
  - fail-closed missing permission rows except SUPER_ADMIN short-circuit

## Operasyon Modulleri

- Backups:
  - `apps/admin/src/app/api/backup/route.ts`
  - `apps/admin/src/app/api/backup/[id]/download/route.ts`
  - `apps/admin/src/lib/backup-job.ts`
  - SUPER_ADMIN + MFA step-up, audit log, encryption/signature/offsite policy.
- Runtime config:
  - `apps/admin/src/app/api/runtime-config/route.ts`
  - SUPER_ADMIN, MFA step-up, value length cap, value shape validation, audit metadata-only logging.
- Security/key rotation:
  - `apps/admin/src/app/api/security/key-rotation/route.ts`
  - SUPER_ADMIN, MFA step-up, distributed lock, dry-run, audit trail.
- Security readiness:
  - `apps/admin/src/lib/security-readiness.ts`
  - config, alerting, backup freshness/offsite, DB transport checks.
- Provider ops:
  - CRUD, coverage, governance, bulk ops, logo candidates/upload/auto-fetch.
- Billing/subscriptions:
  - subscription analytics, invoices, refunds, cancel/change/resync/revalidate, admin grants.
- Content:
  - blog editor, uploads, categories/tags, preview/publish, revalidate web.

## Bulgular

- F-003: Admin route sibling test kapsami web'den daha zayif: 107 route, 36 sibling route test, 71 sibling test eksigi.
- F-004: Middleware rate limit store in-memory `Map`; serverless/multi-instance ortamda global ve kalici degil.
- F-006: Runtime config katalog anahtarlarinin bir bolumu `.env.example` icinde yok.

## Notlar

- `apps/admin/src/app/api/blog/image/route.ts` route-level admin auth kullanmiyor; middleware ile korunan public web image redirect mirror oldugu goruldu. Simdilik confirmed bug degil.
- Admin permission modeli fail-closed tasarlanmis; bu guvenli ama seed/backfill ve health check olmadan operasyonel lockout yaratabilir. Backlog onerisi olarak takip edilmeli.
