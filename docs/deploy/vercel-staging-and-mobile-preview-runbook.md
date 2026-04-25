# Vercel Staging And Mobile Preview Runbook

Current PR: `#15 Current product readiness epic`
Current branch: `pr/current-product-readiness-epic`

This runbook prepares protected staging and mobile preview QA. It does not deploy production and does not add product scope.

## 1. Required Credentials

Core:

- [ ] Staging `DATABASE_URL`
- [ ] `USER_JWT_SECRET`
- [ ] `ADMIN_JWT_SECRET`
- [ ] `FIELD_ENCRYPTION_KEY`
- [ ] `CRON_SECRET`
- [ ] `INTERNAL_WEBHOOK_SECRET`
- [ ] `IMPERSONATION_HANDOFF_SECRET`

Vendor:

- [ ] Google OAuth credentials, if testing Google sign-in
- [ ] Apple OAuth credentials, if testing Apple sign-in
- [ ] Stripe test-mode key, price IDs, webhook secret
- [ ] Resend key and sender domain
- [ ] Sentry DSN and alert routes
- [ ] Backup object storage credentials
- [ ] EAS token and Android signing credentials
- [ ] Apple Developer credentials for iOS build

## 2. Vercel Project Setup

Create two projects:

| Project | Root directory | Framework | Purpose |
|---|---|---|---|
| `locateflow-web-staging` | `apps/web` | Next.js | User app and API |
| `locateflow-admin-staging` | `apps/admin` | Next.js | Admin console |

Build:

- Install: Vercel auto pnpm install, or explicit `pnpm install --frozen-lockfile`.
- Web build: `pnpm build` from `apps/web`, or `pnpm --filter @locateflow/web build` from repo root.
- Admin build: `pnpm build` from `apps/admin`, or `pnpm --filter @locateflow/admin build` from repo root.
- Migrations: run separately, not during Vercel build.

## 3. Vercel Env Setup

Use `docs/deploy/staging-env-inventory.md`.

Minimum web staging:

- `DATABASE_URL`
- `USER_JWT_SECRET`
- `ADMIN_JWT_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL=https://locateflow-web-staging.vercel.app`
- `CRON_SECRET`
- `INTERNAL_WEBHOOK_SECRET`
- `IMPERSONATION_HANDOFF_SECRET`

Minimum admin staging:

- `DATABASE_URL`
- `ADMIN_JWT_SECRET`
- `USER_JWT_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `NEXT_PUBLIC_APP_URL=https://locateflow-web-staging.vercel.app`
- `CRON_SECRET`
- `INTERNAL_WEBHOOK_SECRET`
- `IMPERSONATION_HANDOFF_SECRET`

Add OAuth, Stripe, email, maps, monitoring, Redis, and backup values as they become available.

## 4. Staging DB Setup

- [ ] Create DigitalOcean Managed MySQL staging DB.
- [ ] Enable backups/PITR where available.
- [ ] Require TLS.
- [ ] Configure Vercel-compatible network access.
- [ ] Use separate staging and production databases.
- [ ] Confirm migration user and app user strategy.

## 5. Migration Steps

```bash
pnpm --filter @locateflow/db generate
pnpm --filter @locateflow/db prisma migrate deploy
pnpm verify:typecheck
```

Checklist:

- [ ] Take pre-migration backup.
- [ ] Run migration against staging only.
- [ ] Verify `MoveTask`, `UserCustomProvider`, `ProviderGovernanceIssue`.
- [ ] Verify indexes.
- [ ] Seed or create admin/test users.
- [ ] Run smoke tests.
- [ ] Run backup after migration.

## 6. Web Deployment Steps

Preview deployment command, after env values are configured:

```bash
vercel --cwd apps/web
```

If Vercel CLI is not installed globally:

```bash
pnpm dlx vercel --cwd apps/web
```

Do not run production deploy unless explicitly approved.

Smoke:

- [ ] Homepage loads.
- [ ] Signup/login works.
- [ ] Legal acknowledgement required.
- [ ] Onboarding works.
- [ ] Services/providers/custom providers work.
- [ ] Move tasks generate and complete locally.
- [ ] Export/delete endpoints work.
- [ ] Stripe/email/OAuth disabled states are honest when credentials are missing.

## 7. Admin Deployment Steps

Preview deployment command, after env values are configured:

```bash
vercel --cwd apps/admin
```

If Vercel CLI is not installed globally:

```bash
pnpm dlx vercel --cwd apps/admin
```

Smoke:

- [ ] Admin login works.
- [ ] Dashboard loads.
- [ ] Users, services, custom providers, move tasks visible.
- [ ] Provider governance queues load.
- [ ] Queue safe actions are permission-gated and audited.
- [ ] Backup/security/log/runtime pages load.

## 8. Deployment Protection

Admin staging:

- [ ] Enable Vercel Deployment Protection.
- [ ] Prefer Vercel Authentication for authorized team members.
- [ ] Use password protection or trusted IPs if Vercel Authentication is not available.
- [ ] Keep admin app login enabled.
- [ ] Ensure admin URL is not indexed or linked publicly.

Web staging:

- [ ] Protect public web staging pages if possible.
- [ ] Decide mobile API access strategy before enabling full-site protection.

Mobile API warning:

- If `locateflow-web-staging` is protected by Vercel Authentication, Android/iOS API calls from the app may fail before reaching app auth.
- Do not embed a Vercel protection bypass secret in the app bundle.
- Safest practical staging path is an API-accessible web staging deployment with app auth/rate limits and non-production data, while admin remains protected.

## 9. Mobile Android Preview Build

Use staging profile:

```bash
cd apps/mobile
eas build --platform android --profile staging-preview --non-interactive
```

If building locally:

```bash
cd apps/mobile
eas build --platform android --profile staging-preview --local --non-interactive
```

Expected:

- Android APK points to `https://locateflow-web-staging.vercel.app/api`.
- Real-device smoke passes for auth, onboarding, custom providers, move tasks, settings, support, and logout.

## 10. iOS Build Readiness

Cloud build:

```bash
cd apps/mobile
eas build --platform ios --profile staging-preview --non-interactive
```

Requires Apple Developer credentials, bundle ID access, certificates, and provisioning profiles. Local build also requires macOS and Xcode.

## 11. OAuth Setup

Use `docs/deploy/oauth-setup-checklist.md`.

Staging callbacks:

- Google: `https://locateflow-web-staging.vercel.app/api/auth/oauth/google/callback`
- Apple: `https://locateflow-web-staging.vercel.app/api/auth/oauth/apple/callback`

## 12. Stripe Setup

Use `docs/deploy/billing-and-iap-setup-checklist.md`.

Webhook:

- `https://locateflow-web-staging.vercel.app/api/webhooks/stripe`

Use Stripe test mode only for staging.

## 13. Email Setup

Use `docs/deploy/email-alerts-setup-checklist.md`.

Validate password reset, email verification, and alert recipient delivery before launch.

## 14. Sentry / Alerts

Use `docs/deploy/monitoring-alert-validation.md`.

Validate redaction and alert delivery in staging.

## 15. Backup / Offsite

Use `docs/deploy/backup-digitalocean-setup-checklist.md`.

Launch remains YELLOW until backup after migration and restore drill are complete.

## 16. Smoke Test Checklist

- [ ] Web signup/login/logout.
- [ ] Mobile signup/login/logout.
- [ ] Admin login.
- [ ] Onboarding.
- [ ] Listed provider add.
- [ ] Custom provider create/edit/delete.
- [ ] Moving plan create/edit.
- [ ] Move task generate/accept/complete/dismiss/reopen.
- [ ] Billing active/expired states.
- [ ] Export/delete.
- [ ] Provider governance queues.
- [ ] Backup creation/verify.
- [ ] Sentry/log redaction.

Manual QA checklist: `docs/qa/current-product-readiness-epic-manual-qa.md`
QA execution tracker: `docs/qa/current-product-qa-execution-tracker.md`

## 17. Known Blockers

- Vercel staging env values not present in this workspace.
- Native Android/iOS builds not proven.
- Restore drill not complete.
- Legal review pending.
- Provider source validation backlog remains.
- Production env validation pending.

## 18. Testable Without Missing Credentials

- Local typecheck/tests/builds.
- Expo JS export.
- Email/password auth with local env.
- Core services/providers/custom providers/move tasks with local/staging DB.
- Admin governance surfaces with seeded data.

## 19. Not Testable Until Credentials Are Provided

- Vercel deployment.
- Google/Apple OAuth live callbacks.
- Stripe checkout/webhook/portal.
- Resend delivery.
- Sentry alerting.
- Offsite backup upload/download.
- Android native build.
- iOS native build.
- Store IAP validation.
