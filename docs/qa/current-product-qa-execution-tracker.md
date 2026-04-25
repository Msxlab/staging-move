# Current Product QA Execution Tracker

Branch: `pr/current-product-readiness-epic`
Expected starting head: `782a72c Close current product pre-test gaps`

QA mode rules:

- Do not add new product feature scope.
- Only fix bugs found during QA or blockers that prevent running the system.
- Do not add Family, Pro, KYC, Plaid, USPS/provider connectors, partner API, ML/AI ranking, external provider automation, automatic address-change execution, or verified/official provider claims.

## A. Local Startup Checklist

Environment variables:

- [ ] `DATABASE_URL`
- [ ] `USER_JWT_SECRET` with at least 32 characters
- [ ] `ADMIN_JWT_SECRET` with at least 32 characters
- [ ] `FIELD_ENCRYPTION_KEY` as a 64-character hex key
- [ ] `NEXT_PUBLIC_APP_URL`, usually `http://localhost:3000`
- [ ] `EXPO_PUBLIC_API_URL`, usually `http://localhost:3000/api` or a LAN/staging API URL for devices

Startup:

- [ ] Install: `pnpm install --frozen-lockfile`
- [ ] Prisma generate: `pnpm --filter @locateflow/db generate`
- [ ] Local migration: `pnpm --filter @locateflow/db prisma migrate dev`
- [ ] Seed: `pnpm db:seed` or `pnpm db:seed:all`
- [ ] Start web: `pnpm --filter @locateflow/web dev`
- [ ] Start admin: `pnpm --filter @locateflow/admin dev`
- [ ] Start mobile: `cd apps/mobile && pnpm exec expo start`

## B. Automated Verification Checklist

- [ ] `pnpm install --frozen-lockfile`
- [ ] `pnpm verify:typecheck`
- [ ] `pnpm --filter @locateflow/web test`
- [ ] `pnpm --filter @locateflow/admin test`
- [ ] `pnpm --filter @locateflow/shared test`
- [ ] `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- [ ] `pnpm --filter @locateflow/web build`
- [ ] `pnpm --filter @locateflow/admin build`
- [ ] `cd apps/mobile && pnpm exec expo install --check`
- [ ] `cd apps/mobile && pnpm exec expo export --platform android --output-dir dist-export-android`
- [ ] `cd apps/mobile && pnpm exec expo export --platform ios --output-dir dist-export-ios`
- [ ] Clean `apps/mobile/dist-export-android` and `apps/mobile/dist-export-ios` after export verification.
- [ ] `git diff --check`
- [ ] `git diff move-main/main..HEAD --check`

## C. Manual QA Execution Checklist

Web:

- [ ] Public homepage, pricing, legal/policy links
- [ ] Signup, login, logout, reset password, legal acknowledgement
- [ ] Onboarding and interrupted onboarding recovery
- [ ] Addresses, services, listed providers
- [ ] Custom provider create/edit/delete
- [ ] Moving plan create/edit
- [ ] Move task generate/accept/complete/dismiss/reopen
- [ ] Local-effect confirmation and no external automation copy
- [ ] Settings, account security, support/help

Mobile:

- [ ] App launch and tab/menu navigation
- [ ] Signup/login/logout and legal acknowledgement
- [ ] Onboarding
- [ ] Listed provider add
- [ ] Custom provider create through service flow
- [ ] More -> Custom Providers list/detail/edit/delete
- [ ] Moving plan and move task lifecycle
- [ ] Caveats visible on small screens
- [ ] Offline/slow-network behavior

Admin:

- [ ] Dashboard
- [ ] Users list and user detail
- [ ] User services, custom providers, move tasks, support context
- [ ] Provider list/detail
- [ ] Provider governance center and all queues
- [ ] Queue actions, exports, permission gates, audit logs
- [ ] Moving, support, subscriptions, billing, state rules
- [ ] Backups, security, logs/audit, feature flags, runtime config

Billing:

- [ ] Trial active
- [ ] Trial expired
- [ ] Subscription active
- [ ] Canceled but current period active
- [ ] Canceled and period ended
- [ ] Past due/unpaid/incomplete
- [ ] Existing data readable after expiration
- [ ] Existing move tasks completable after expiration
- [ ] New move task generation blocked without active entitlement
- [ ] New custom provider creation blocked without active entitlement

Auth:

- [ ] Email/password signup
- [ ] Google/Apple disabled state without credentials
- [ ] Google/Apple enabled state with credentials
- [ ] OAuth-only set-password
- [ ] Password change
- [ ] MFA setup/disable
- [ ] Session revoke/logout
- [ ] Email change and social link/unlink unavailable unless a safe flow exists

Export/Delete:

- [ ] Data export without notes
- [ ] Data export with `includeNotes=true`
- [ ] Export includes legal acknowledgements, move tasks, and custom providers
- [ ] Account deletion/staged deletion handles new tables
- [ ] Sessions and notifications stop after deletion

Provider Governance:

- [ ] Quality queue
- [ ] Coverage gap queue
- [ ] Duplicate review queue
- [ ] Missing contact queue
- [ ] Broad coverage queue
- [ ] Source validation backlog
- [ ] User-created provider review queue

Move Tasks:

- [ ] PSE&G NJ -> Texas
- [ ] PSE&G NJ -> NJ
- [ ] Texas electric many candidates
- [ ] No provider candidate
- [ ] Internet address-check-required
- [ ] Bank address update
- [ ] Insurance requote
- [ ] Local dentist/gym/custom provider scenarios

Custom Providers:

- [ ] Private/user-added/manual tracking labels
- [ ] Create/edit/delete does not affect other users
- [ ] Attach to service
- [ ] Admin review visibility

Backup/Restore:

- [ ] Backup includes `MoveTask`
- [ ] Backup includes `UserCustomProvider`
- [ ] Backup includes `ProviderGovernanceIssue`
- [ ] Backup verify works
- [ ] Dry-run import works
- [ ] Restore/import works in disposable staging DB

## D. Staging Checklist

- [ ] Take pre-migration staging DB backup.
- [ ] Run `pnpm --filter @locateflow/db prisma migrate deploy`.
- [ ] Run `pnpm --filter @locateflow/db generate`.
- [ ] Verify new tables and indexes.
- [ ] Start web/admin against staging.
- [ ] Run staging smoke tests for auth, onboarding, services, custom providers, moving plans, move tasks, export/delete, admin governance, billing context.
- [ ] Run backup after migration.
- [ ] Complete restore drill in disposable staging DB.
- [ ] Validate Sentry redaction.
- [ ] Validate alert delivery for auth anomalies, backup failure, billing webhook failure, API errors, and mobile crashes.

## E. Mobile Native Build Checklist

Android EAS prerequisites:

- [ ] EAS account/login or `EAS_TOKEN`
- [ ] Java installed
- [ ] Android SDK installed
- [ ] `ANDROID_HOME` or `ANDROID_SDK_ROOT`
- [ ] Android signing credentials
- [ ] Preview/internal build profile confirmed in `apps/mobile/eas.json`

Android commands:

```bash
cd apps/mobile
eas build --platform android --profile preview --non-interactive
```

Expected Android result:

- [ ] Build completes.
- [ ] APK/installable artifact launches.
- [ ] Auth, onboarding, custom providers, move tasks, settings, and logout smoke pass on device/emulator.

iOS EAS/Xcode prerequisites:

- [ ] macOS host for local iOS build, or EAS cloud build
- [ ] Xcode installed for local build
- [ ] Apple developer credentials
- [ ] Bundle identifier access
- [ ] Certificates and provisioning profiles
- [ ] Preview/internal build profile confirmed in `apps/mobile/eas.json`

iOS commands:

```bash
cd apps/mobile
eas build --platform ios --profile preview --non-interactive
```

Expected iOS result:

- [ ] Build completes.
- [ ] Installable artifact launches.
- [ ] Auth, onboarding, custom providers, move tasks, settings, and logout smoke pass on simulator/device.

## F. Known Blockers

- Native Android build is not proven.
- Native iOS build is not proven.
- Mobile device QA is not complete.
- Restore drill is not done.
- Legal/policy owner review is pending.
- Production environment and credential validation is pending.
- Provider official-source validation backlog remains.
- Provider logo/phone cleanup backlog remains.
- Exact ZIP/service-territory validation backlog remains.
- Sentry/mobile crash reporting and alert validation remain staging/prod tasks.

## G. Bug Tracker

| ID | Surface | Scenario | Expected | Actual | Severity | Status | Fix commit | Retest result |
|---|---|---|---|---|---|---|---|---|
| QA-001 | TBD | TBD | TBD | TBD | TBD | Open | TBD | TBD |
