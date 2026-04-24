# Current Product Backup Scope Decision - 2026-04-24

This report covers the current product only. It does not add or assume Family, Pro, KYC, Plaid, USPS, connectors, partner API, OCR, or future billing modules.

## Current App Backup Scope

The app-level backup system currently protects:

| Table key | Prisma model | Current reason |
|---|---|---|
| `users` | `User` | Core user account records. |
| `profiles` | `Profile` | User profile and onboarding context. |
| `providers` | `ServiceProvider` | Provider catalog records. |
| `providerCoverages` | `ServiceProviderCoverage` | Generated provider coverage rows. |
| `addresses` | `Address` | User address records. |
| `movingPlans` | `MovingPlan` | Current moving workflow records. |
| `services` | `Service` | User tracked service records. |
| `budgets` | `Budget` | User budget records. |
| `subscriptions` | `Subscription` | Current subscription entitlement records. |
| `notifications` | `Notification` | In-app notification records. |
| `auditLogs` | `AuditLog` | User-facing audit trail records. |

This scope is appropriate as an app-level portability and selected-table recovery archive, but it is not enough by itself for disaster recovery.

## Exclusions Classified

### Intentionally Excluded For Security Or Ephemeral Reasons

These should usually be recreated, expired, or reset rather than restored from app backup:

| Data | Reason |
|---|---|
| `UserLoginSession` | Active login sessions should not be restored after an incident. Users can log in again. |
| `AdminSession` | Admin sessions should not be restored after an incident. Admins should re-authenticate. |
| `PasswordResetToken` | Reset tokens are short-lived secrets. Restoring them can revive stale credentials. |
| `EmailVerificationToken` | Verification tokens are short-lived secrets. Restoring them can revive stale flows. |
| `PushDevice` | Push tokens can be stale and should be re-registered by clients. |
| OAuth provider raw subject IDs | Sensitive identity-link material. Restore only through managed DB PITR if required. |
| Processed webhook events | Mostly idempotency/processing state. Restore strategy depends on incident type. |

### Should Be Added To App Backup After Explicit Scope Approval

These are current-product records that may be needed for selected-table recovery and operator continuity:

| Data | Reason to consider app backup |
|---|---|
| `StateRule` | User-facing state guidance and moving content can be operationally important. |
| Help center content | Support documentation should survive app-level recovery. |
| Email templates | Existing transactional/support copy may need selected recovery. |
| Feature flags | Current release and kill-switch state can affect safe restore behavior. |
| Runtime config records | Operational config can be needed for restore, but secrets must remain masked/excluded. |
| Admin audit logs | Operator forensics may need selected recovery. |
| Waitlist records | Business continuity if waitlist is actively used. |
| `BackupRecord` metadata | Useful for backup inventory, but never a substitute for offsite archive storage. |

Do not add these blindly. Each needs restore tests, retention expectations, and sensitive-field review.

### Should Be Covered By Managed DB PITR Or Snapshots

These should primarily be protected by DigitalOcean managed database backups/PITR, not the app-level archive:

| Data | Reason |
|---|---|
| Full database state | Whole-system recovery should use provider-managed snapshots/PITR. |
| Database users, grants, roles | Outside Prisma app data. |
| Indexes, constraints, migrations, metadata | Managed database and migration tooling should protect/apply this. |
| Admin identity and security state | High-sensitivity operational data that should be restored only through controlled DR. |
| Webhook/idempotency state during incident windows | Needs point-in-time consistency with external providers. |

### Should Be Covered By Object Storage Backup

These are not in the relational backup archive:

| Data | Reason |
|---|---|
| User-uploaded files | Not stored in app backup JSON. |
| Documents or attachments | Need bucket-level versioning/lifecycle/replication. |
| Backup archive objects | App DB stores metadata only; archive durability depends on S3/R2-compatible storage. |
| Generated exports or reports stored outside DB | Need object storage inventory and lifecycle policy. |

## Current Recommended Scope

For the current product, keep the app-level backup scope as:

- Core user data.
- Provider catalog and provider coverage.
- Address/moving/service/budget records.
- Subscription entitlement records.
- In-app notifications.
- User audit logs.

Near-term stabilization additions to consider after tests:

1. `StateRule`
2. Help center content
3. Feature flags
4. Email templates
5. Runtime config records without secret values
6. Admin audit logs

Do not add login sessions, reset tokens, verification tokens, or push tokens to app-level backup without a security review.

## Required Infrastructure Outside Code

DigitalOcean and storage configuration must provide:

- Managed MySQL automated backups.
- PITR or the closest available point-in-time recovery feature.
- A documented snapshot restore flow into a staging database.
- S3/R2-compatible backup bucket with encryption at rest.
- Bucket lifecycle policy for retention.
- Bucket access logs or audit trail.
- Restricted read/write credentials for backup upload/download.
- Object storage backup/versioning for user files and retained backup archives.

## Acceptance Criteria For Current-Product DR

The backup system can be called production-ready only after:

1. Production backup creation fails closed when `FIELD_ENCRYPTION_KEY` is missing.
2. Production backup creation fails closed when offsite retention is unavailable.
3. Backup verify recognizes every canonical backup table.
4. A clean staging restore drill passes.
5. Managed database snapshot/PITR settings are verified.
6. Object storage retention/versioning is verified.
7. The measured RPO/RTO is documented from a real drill.
