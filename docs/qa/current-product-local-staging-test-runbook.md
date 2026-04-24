# Current Product Local And Staging Test Runbook

Use this runbook with `docs/qa/current-product-readiness-epic-manual-qa.md` before treating the current-product readiness epic as launch-ready.

Expected product posture: manual LocateFlow guidance, local task tracking, private user-created providers, and listed/unverified provider data unless a future source-backed validation workflow exists.

## Required Local Prerequisites

- Node.js 20 or newer.
- pnpm 9.x.
- MySQL-compatible database for local/staging tests.
- Git.
- Expo CLI through `pnpm exec expo`.
- For native Android builds: EAS account/token, Java, Android SDK, `ANDROID_HOME` or `ANDROID_SDK_ROOT`, and signing credentials.
- For native iOS builds: macOS, Xcode, EAS account/token or Apple developer credentials, bundle identifier access, certificates, and provisioning profiles.

## Required Environment Variables

Minimum local app variables:

- `DATABASE_URL`
- `USER_JWT_SECRET` with at least 32 characters.
- `ADMIN_JWT_SECRET` with at least 32 characters.
- `FIELD_ENCRYPTION_KEY` as a 64-character hex key.
- `NEXT_PUBLIC_APP_URL`, usually `http://localhost:3000`.

Minimum mobile local variable:

- `EXPO_PUBLIC_API_URL`, usually `http://localhost:3000/api` for local testing or the staging API for staging builds.

Production/staging readiness variables to validate before launch:

- OAuth: `GOOGLE_OAUTH_CLIENT_ID`, `GOOGLE_OAUTH_CLIENT_SECRET`, `APPLE_OAUTH_CLIENT_ID`, `APPLE_OAUTH_TEAM_ID`, `APPLE_OAUTH_KEY_ID`, `APPLE_OAUTH_PRIVATE_KEY`.
- Billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_INDIVIDUAL`, `STRIPE_PRICE_INDIVIDUAL_YEARLY`.
- Email/alerts: `RESEND_API_KEY`, alert recipient settings.
- Error monitoring: `NEXT_PUBLIC_SENTRY_DSN`.
- Maps/autocomplete if enabled: `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`.
- Backup/offsite: `BACKUP_STORAGE_PROVIDER`, `BACKUP_STORAGE_BUCKET`, `BACKUP_STORAGE_REGION`, `BACKUP_STORAGE_ENDPOINT`, `BACKUP_STORAGE_ACCESS_KEY_ID`, `BACKUP_STORAGE_SECRET_ACCESS_KEY`.

## Optional Environment Variables

- OAuth and IAP variables can remain blank locally. The UI should show disabled/unavailable social or store flows honestly.
- Sentry can remain blank locally.
- Email providers can remain blank locally if the app logs or no-ops transactional sends.

## Install

```bash
pnpm install --frozen-lockfile
```

## Prisma Generate

```bash
pnpm --filter @locateflow/db generate
```

## Run Migrations

Local development:

```bash
pnpm --filter @locateflow/db prisma migrate dev
```

Staging/prod-like deploy:

```bash
pnpm --filter @locateflow/db prisma migrate deploy
pnpm --filter @locateflow/db generate
pnpm verify:typecheck
```

Staging migration checklist:

1. Take a database backup before migration.
2. Confirm `DATABASE_URL` points to staging, never production unless this is the approved production window.
3. Run `pnpm --filter @locateflow/db prisma migrate deploy`.
4. Run `pnpm --filter @locateflow/db generate`.
5. Verify these tables exist: `MoveTask`, `UserCustomProvider`, `ProviderGovernanceIssue`.
6. Verify indexes for user, moving plan, task status/action, service/provider/custom-provider relations, and governance queues.
7. Start web and admin.
8. Run smoke tests for signup, services, custom providers, moving plans, move tasks, admin governance, and export.
9. Run backup after migration.
10. Record migration time and rollback notes.

## Seed

```bash
pnpm db:seed
```

For full local data where appropriate:

```bash
pnpm db:seed:all
```

## Start Web

```bash
pnpm --filter @locateflow/web dev
```

Default local URL: `http://localhost:3000`.

## Start Admin

```bash
pnpm --filter @locateflow/admin dev
```

Default local URL: `http://localhost:3001`.

## Start Mobile Expo

```bash
cd apps/mobile
pnpm exec expo start
```

For a dev client:

```bash
cd apps/mobile
pnpm exec expo start --dev-client
```

Set `EXPO_PUBLIC_API_URL` to the web API URL available to the device. Physical devices cannot use `localhost` unless the app resolves through the Expo host logic or a LAN-accessible URL.

## Create Test Users

1. Open web signup.
2. Confirm signup is blocked until Terms of Use and Legal Disclaimer are accepted.
3. Create an email/password user.
4. Verify the email-verification flow behavior in local/staging.
5. Sign in and complete onboarding.
6. Repeat on mobile signup.

## Create Admin User

Use the repo-native admin seed/setup flow already used by the environment. Confirm the admin user can sign in at `http://localhost:3001` and can reach users, providers, provider governance, backups, security, logs, runtime config, feature flags, support, subscriptions, and moving modules.

## Test Email/Password Signup

Expected result:

- Terms and Legal Disclaimer acknowledgement is required.
- Password policy is enforced.
- Email verification token is generated.
- Legal acknowledgement history appears in user export.

## Test Google/Apple Disabled/Enabled States

Without OAuth credentials:

- Web and mobile social sign-in should be disabled or show unavailable copy.
- Password signup/sign-in remains available.

With OAuth credentials:

- First-time social account creation requires the signup acknowledgement.
- Existing linked social accounts can sign in.
- OAuth-only users can set a password in account security.
- Email change and social link/unlink are not launch-ready; any UI for those flows must be unavailable or clearly marked unavailable.

## Test Onboarding

Expected result:

- Profile, origin/current address, service selection, move planning, and legal acknowledgement flow works.
- Skipped service entry is recoverable from services/providers later.
- Provider caveats remain visible.
- No external account update is implied.

## Test Listed Provider

Expected result:

- Provider is shown as listed/unverified unless source-backed validation exists.
- Coverage confidence is a signal, not exact-address proof.
- Adding the provider creates a local service record only.

## Test Custom Provider

Web:

- Create, edit, delete a custom provider.
- Attach it to a service.
- Confirm it remains private/user-added/manual tracking only.

Mobile:

- Create a custom provider through service manual add.
- Open More -> Custom Providers.
- View custom-provider list/detail.
- Edit provider fields.
- Delete provider with confirmation.
- Confirm editing/deleting affects only the current user's private provider record.

## Test Move Tasks

Expected result:

- Create origin/destination addresses and a moving plan.
- Add origin services.
- Generate move tasks.
- Accept, complete, dismiss, and reopen tasks.
- Regeneration does not duplicate completed/dismissed tasks without material input changes.
- Caveats say LocateFlow does not update provider accounts.

## Test Local Task Effects

Expected result:

- `STOP_SERVICE` and `CANCEL_OR_CLOSE` mark local service inactive only.
- `START_SERVICE`, `SHOP_PROVIDER`, and `FIND_REPLACEMENT` create/link local destination service only when a provider is selected.
- `TRANSFER_SERVICE` records/link local state only and does not imply external transfer.
- `UPDATE_ADDRESS`, `VERIFY_AVAILABILITY`, `GOVERNMENT_UPDATE`, `INSURANCE_REQUOTE`, and `MAIL_FORWARDING` record local task completion only.
- Completion confirmation appears before local effects.

## Test Billing Entitlement Manually

Expected current-product policy:

- Data export/delete is always available.
- Existing data remains readable after subscription expiration.
- Completing already-created move tasks remains allowed after expiration.
- Generating new move tasks requires active entitlement.
- Creating new custom providers requires active entitlement.
- Admin can view billing context but cannot refund, cancel, grace, retry, grant, or revoke without an approved workflow.

Test states:

- Trial active.
- Trial expired.
- Subscription active.
- Canceled but current period active.
- Canceled and period ended.
- Past due/unpaid/incomplete.
- Mobile IAP active/stale/unconfigured.

## Test Data Export/Delete

Expected result:

- Export includes addresses, services, custom providers, move tasks, moving plans, legal acknowledgement history, and relevant subscription/account data.
- Free-form notes are omitted by default and included only with `includeNotes=true`.
- Account deletion/staged deletion handles move tasks and custom providers.
- Sessions are revoked after account deletion.
- Backup retention limitations are explained in policy/runbooks.

## Test Backup Creation

Expected result:

- Backup catalog includes `MoveTask`, `UserCustomProvider`, and `ProviderGovernanceIssue`.
- Production backup requires crypto and offsite configuration.
- Browser fallback is disabled in production.

## Restore Drill When Staging/Offsite Is Available

1. Create a disposable staging database.
2. Run migrations.
3. Seed or create representative data, including move tasks, custom providers, and provider governance issues.
4. Create an encrypted/signed app backup.
5. Upload it to offsite storage.
6. Download it from offsite storage.
7. Verify the backup.
8. Dry-run import.
9. Restore/import into the disposable database.
10. Verify key table counts and relationships.
11. Start web/admin against the restored database.
12. Smoke test signup, services, custom providers, move tasks, admin governance, and export.
13. Record observed RPO/RTO.

## Test Admin Governance Queues

Expected result:

- Provider governance page loads.
- Quality, coverage gap, duplicate, missing contact, broad coverage, source validation, and user-created provider queues load.
- Safe actions are permission-gated and audited.
- Admin cannot create official/verified claims without a source-backed workflow.
- Queue export works where implemented.
- PII is limited in list views and available only in authorized details.

## Test Mobile Expo

Commands:

```bash
cd apps/mobile
pnpm exec expo install --check
npx expo-doctor@latest
pnpm exec expo export --platform android --output-dir dist-export-android
pnpm exec expo export --platform ios --output-dir dist-export-ios
```

Clean generated export folders after verification unless intentionally retained outside git.

Device QA:

- Launch app.
- Sign up/sign in.
- Complete onboarding.
- Add listed provider.
- Add custom provider.
- Edit/delete custom provider from More -> Custom Providers.
- Create moving plan.
- Generate and complete move tasks.
- Confirm caveats are readable.
- Test logout and token clearing.

## Known Caveats

- Launch readiness remains YELLOW until manual QA, staging migration, native mobile builds, device QA, backup restore drill, alert validation, legal review, and production environment validation are complete.
- Provider data is listed/unverified and not exact-address proof.
- Mobile native builds are not proven by Expo JS export.
- Expo Doctor may report monorepo duplicate React and non-CNG native-folder/app-config warnings; native builds must verify these are non-blocking.

## Requires External Credentials

- Google OAuth.
- Apple OAuth.
- Stripe.
- Apple/Google store IAP validation.
- EAS.
- Android signing.
- Apple signing/certificates/profiles.
- Sentry.
- Resend/email.
- Backup object storage.

## Requires Staging/Production Infrastructure

- Staging database migration.
- Offsite backup.
- Restore drill.
- DigitalOcean managed database PITR/snapshot confirmation.
- Alert delivery.
- Webhook delivery.
- Rate-limit behavior under deployed networking.
- Production TLS/CORS/cookie/security header validation.

## Requires Real Device

- Android native launch and navigation.
- iOS native launch and navigation.
- Mobile auth token storage/logout.
- Mobile caveat readability.
- Mobile custom-provider edit/delete.
- Mobile move task local-effect confirmation.
- Mobile IAP/store states.
