# Current Product Readiness Audit - Provider Catalog, Backup/Restore, Admin Ops - 2026-04-24

## 1. Scope

This audit is limited to the current working product. It does not approve, design, or implement Family, Pro, KYC, Plaid, USPS, connector networks, partner APIs, OCR, utility-bill flows, or any speculative schema work.

Audited areas:

- Provider catalog and data quality.
- Provider discovery and matching UX in web, mobile, admin, and API surfaces.
- Backup, restore, dry-run, retention, offsite storage, and disaster recovery readiness.
- Existing admin operator surfaces: users, support, subscriptions, billing, providers, moving, state rules, backups, notifications, runtime config, security, logs, feature flags, and help center.

Validation boundary:

- This audit inspected code, seed data, generated provider audit scripts, admin/web/mobile surfaces, and existing docs.
- No live production database, managed database snapshot, object storage bucket, Sentry project, store account, or official provider website validation was accessed.
- Provider websites were not manually verified against official company sources in this pass. Records should be treated as unverified unless they have an explicit validation path.

## 2. Executive Verdict

### Provider Catalog Verdict

The provider catalog has useful breadth, but it is not yet data-trustworthy enough for production claims that imply official validation or precise availability.

Current seed processing reports 776 sanitized providers from 777 raw records, across 68 categories. The catalog has no missing websites and no parse-invalid website or phone values in the local checks, but all 776 providers lack logo URLs, 301 providers lack phone numbers, 118 descriptions look generic, 28 descriptions contain marketing/superlative language, 36 domain buckets appear across multiple categories, and only 25 providers match the local curated coverage metadata map. Coverage breadth exists, but many records are state-wide or nationwide in a way that can overstate availability for address-sensitive services.

### Provider User Experience Verdict

Provider discovery is functional, but the user experience can overstate what the system knows. Web and mobile let users search, filter, view, and add providers as services, but the UI does not clearly distinguish:

- Officially verified provider vs listed directory record.
- Coverage confirmed for an address vs state/nationwide approximation.
- Manual service tracking vs address-change automation.
- Imported contact data vs recently verified contact data.

The current system should present providers as a helpful directory/checklist input, not as verified official integrations.

### Backup/Restore Verdict

Backup and import logic is materially improved but not production-proven as a disaster recovery system.

The current backup catalog protects a defined subset of application tables and has dependency-aware import order, dry-run behavior, transaction-wrapped merge/replace, offsite S3/R2-compatible storage support, and HMAC verification for signed restores. This audit originally identified two code-level blockers: production backup creation could degrade to unsigned/plaintext archives when `FIELD_ENCRYPTION_KEY` was missing, and the verify endpoint did not fully match the canonical backup catalog for `providerCoverages`. Those two blockers are addressed by the follow-up Backup/DR stabilization pass. Remaining readiness gaps are restore proof, backup scope decisions, managed database PITR, object storage protection, and measured RPO/RTO.

RPO/RTO should be treated as unproven until a staged restore drill is completed.

### Admin Readiness Verdict

Admin is usable for current support and operations, but not yet fully operator-ready for a paying product. Several modules are read-only/reporting only, several need governance before operators can safely make high-impact changes, and some workflows are intentionally narrowed to avoid fake readiness.

The most mature current surfaces are runtime config, notification honesty, provider CRUD mechanics, and user/support visibility. The weakest production-readiness areas are provider data governance, backup/restore proof, subscription/billing action workflows, state-rule governance, and durable support operating model.

## 3. Evidence Sources

Key files and commands inspected:

- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/seed-data/providers.ts`
- `packages/db/prisma/seed-data/provider-seed.ts`
- `packages/db/prisma/seed-data/state-provider-catalog.ts`
- `packages/db/prisma/seed-data/provider-coverage-overrides.ts`
- `packages/shared/src/provider-integrity.ts`
- `packages/shared/src/provider-coverage.ts`
- `packages/db/src/provider-coverage.ts`
- `packages/db/src/provider-coverage-metadata.ts`
- `apps/web/src/app/api/providers/route.ts`
- `apps/web/src/app/api/providers/recommendations/route.ts`
- `apps/web/src/lib/provider-matching.ts`
- `apps/web/src/app/(app)/providers/providers-client.tsx`
- `apps/web/src/app/(app)/providers/[id]/detail-client.tsx`
- `apps/mobile/app/providers/index.tsx`
- `apps/mobile/app/providers/[id].tsx`
- `apps/mobile/src/components/provider/ProviderCard.tsx`
- `apps/admin/src/app/api/providers/route.ts`
- `apps/admin/src/app/api/providers/[id]/route.ts`
- `apps/admin/src/app/api/providers/bulk/route.ts`
- `apps/admin/src/app/(admin)/providers/page.tsx`
- `apps/admin/src/app/(admin)/providers/[id]/page.tsx`
- `apps/admin/src/lib/backup-tables.ts`
- `apps/admin/src/app/api/backup/route.ts`
- `apps/admin/src/app/api/backup/import/route.ts`
- `apps/admin/src/app/api/backup/verify/route.ts`
- `apps/admin/src/app/api/backup/[id]/download/route.ts`
- `apps/admin/src/app/api/cron/backup/route.ts`
- `apps/admin/src/app/api/backup/retention/route.ts`
- `apps/admin/src/lib/backup-storage.ts`
- `apps/admin/src/lib/backup-archive.ts`
- `packages/shared/src/encryption.ts`
- `apps/admin/src/components/backup-control-plane.tsx`
- `docs/runbooks/db-restore.md`
- `docs/release-checklist.md`
- `docs/audits/admin-ops-audit-2026-04-23.md`

Commands run:

- `pnpm audit:providers`
- `pnpm audit:providers:coverage`
- `pnpm audit:providers:state-completeness`

Note: `pnpm audit:providers:state-completeness` refreshed generated audit artifacts under `docs/generated`.

## 4. Provider Catalog Audit

### 4.1 Schema And Related Models

`ServiceProvider` stores:

- Name, slug, category, subcategory, description.
- Website, phone, logo URL.
- Scope: `FEDERAL`, `STATE`, or `LOCAL`.
- `states`, `zipCodes`, and `tags` as JSON strings.
- Popularity score, active flag, display order, user count.
- Soft-delete/version metadata.

`ServiceProviderCoverage` stores generated coverage rows:

- Provider ID.
- State.
- Optional ZIP prefix.
- Optional exact ZIP.

Coverage rows are generated from provider scope, state list, and ZIP rules. The current schema does not store source URL, verification date, data owner, official-company status, contact verification status, or confidence level.

### 4.2 Provider Count

Local provider audit output:

- Raw provider records: 777.
- Sanitized provider records: 776.
- Dedupe removals: 1.
- Removed duplicate: `T-Mobile Home Internet`.
- Same-category normalized-name duplicates: 0.
- Cross-category normalized-name duplicates: 0.
- Cross-category domain duplicate buckets: 36.

### 4.3 Category Counts

Top categories by sanitized provider count:

| Category | Count |
|---|---:|
| `UTILITY_ELECTRIC` | 71 |
| `UTILITY_WATER` | 67 |
| `TRANSPORTATION_TRANSIT` | 66 |
| `UTILITY_GAS` | 56 |
| `GOVERNMENT_VOTER` | 52 |
| `GOVERNMENT_DMV` | 51 |
| `FINANCIAL_INSURANCE_HEALTH` | 44 |
| `SHOPPING_RETAIL` | 24 |
| `FINANCIAL_BANK` | 23 |
| `UTILITY_INTERNET` | 20 |
| `SHOPPING_SUBSCRIPTION` | 16 |
| `UTILITY_PHONE` | 15 |
| `TRANSPORTATION_TOLL` | 14 |
| `FINANCIAL_CREDIT_CARD` | 12 |
| `HEALTHCARE_TELEMEDICINE` | 12 |
| `HOUSING_HOME_SERVICE` | 12 |
| `LOCAL_DINING` | 12 |
| `FINANCIAL_FINTECH` | 11 |
| `FINANCIAL_INSURANCE_RENTERS` | 10 |
| `HOUSING_MOVING` | 9 |

The catalog spans 68 categories total. Long-tail categories have 1 to 8 records each.

### 4.4 Scope And Coverage Distribution

Provider scope counts:

- `STATE`: 433.
- `FEDERAL`: 343.

Generated coverage rows:

- Total coverage rows: 1,567.
- Exact ZIP rules: 0.
- ZIP prefix rules: 1,009.
- State-wide rows: 558.
- Providers with no generated coverage rows: 343. These are federal providers that match by scope rather than explicit coverage rows.

Top state coverage counts:

| State | Count |
|---|---:|
| CA | 111 |
| TX | 110 |
| NJ | 104 |
| OH | 82 |
| MA | 65 |
| FL | 57 |
| IL | 52 |
| VA | 52 |
| AL | 48 |
| PA | 47 |
| GA | 44 |
| NY | 42 |
| NC | 40 |
| IN | 39 |
| MI | 38 |

Lowest state coverage counts:

| State | Count |
|---|---:|
| WV | 9 |
| AK | 10 |
| MT | 10 |
| ND | 10 |
| RI | 10 |
| SC | 10 |
| VT | 10 |
| AR | 11 |
| HI | 11 |
| ME | 11 |
| UT | 11 |
| DE | 12 |
| OK | 12 |
| WY | 12 |
| KY | 13 |

The `pnpm audit:providers:coverage` command reported no critical-category state gaps, but that means each state has at least one provider for the audited category grid. It does not prove individual provider coverage is address-accurate.

### 4.5 Duplicate Candidates

Known dedupe result:

- `T-Mobile Home Internet` duplicate removed during sanitization.

Cross-category duplicate domains requiring review:

- `blackhillsenergy.com`: 5 records.
- `progressive.com`: 4 records.
- `costco.com`: 3 records.
- `dominionenergy.com`: 3 records.
- `geico.com`: 3 records.
- `montana-dakota.com`: 3 records.
- `spectrum.com`: 3 records.
- `statefarm.com`: 3 records.
- `verizon.com`: 3 records.
- `xcelenergy.com`: 3 records.
- Additional duplicate-domain buckets include `allstate.com`, `amazon.com`, `apple.com`, `assurant.com`, `att.com`, `bankofamerica.com`, `capitalone.com`, `chewy.com`, `citi.com`, `cvs.com`, `discover.com`, `lemonade.com`, `libertymutual.com`, `maine.gov`, and `miamidade.gov`.

Some duplicate domains are legitimate because one company spans multiple categories. They still need explicit handling so search/ranking and user-facing labels do not look like accidental duplicates.

### 4.6 Websites, Redirects, Missing Sites

Local parse checks found:

- Missing website: 0.
- Parse-invalid website: 0.

This does not prove websites are official, live, non-redirecting, or still owned by the provider. Official-company validation requires live HTTP checks and source review. Until that process exists, website correctness should be marked unverified.

### 4.7 Logos

Missing logo URL:

- 776 of 776 providers.

Mobile uses fallback category icons. Web does not have provider-logo trust signals. This is not a functional blocker, but it weakens user trust and makes official-vs-listed ambiguity worse.

### 4.8 Phone And Contact Data

Local checks found:

- Missing phone: 301.
- Invalid phone format: 0 in local format checks.
- No contact path: 0, because each provider has at least a website or phone.

Phone validity was not live-verified. A formatted phone number may still be stale, wrong, routed to a sales line, or not usable for address updates.

### 4.9 Inactive Or Dead Providers

Current local data reports:

- Inactive providers: 0.

That is a data-shape result, not a market validation result. Because the schema has only `isActive` and no validation timestamp/source, there is no durable way to prove providers are alive or recently checked.

### 4.10 Suspicious Or Generic Descriptions

Local audit found:

- Generic descriptions: 118.
- Suspicious or marketing-heavy descriptions: 28.

Examples of risky description patterns include superlatives and claims such as "largest", "number one", "best", "premium", or "most convenient". Without source attribution, these should be removed or rewritten as neutral descriptions.

### 4.11 Providers Shown Without Enough Verified Data

High-risk groups:

- 751 providers do not match the local curated coverage metadata mechanism.
- 155 state-scoped providers appear location-sensitive but may be too broad at state level.
- 40 federal providers appear address-qualified but are presented as national/federal candidates.
- 301 providers lack phone numbers.
- 776 providers lack logos.
- All providers lack official verification metadata in the schema.

Examples of potentially overbroad state-scoped records include transit, toll, gas, electric, internet, water, and municipal services that may only apply to specific cities, service territories, ZIPs, or street addresses.

Examples of address-qualified federal candidates include internet, trash, grocery delivery, moving, storage, home service, and local-delivery brands. These should not be implied to serve a user address without an address-level validation path.

### 4.12 Category And Coverage Concerns

Coverage models observed from provider metadata and inferred fallback:

- `federal`: 340.
- `state`: 285.
- `zip_prefix`: 126.
- `polygon`: 19.
- `live_address`: 6.

Only 25 providers match local research metadata. The rest are inferred from broad seed fields.

Main accuracy risks:

- Federal scope can imply national service even when actual service depends on address.
- State scope can imply statewide service even when actual service is municipal, utility-territory, county, or metro-region based.
- ZIP prefix rows are better than state scope, but still not proof of service eligibility.
- No exact ZIP coverage rows exist.
- No provider source/verification timestamp is stored.

### 4.13 User-Facing Claims That May Overstate Current Capability

Current copy and UI patterns can imply more certainty than the backend has:

- Provider pages say discovery is "for your location", while many records are only state or federal approximations.
- Detail screens show "All U.S. states", "Nationwide", or "State Coverage" without enough caveat for address-qualified providers.
- Provider cards let users add a provider as a service, which is fine, but the UI should avoid implying an official integration or automatic address-change capability.
- Contact details are shown without "last verified" or "source" context.

### 4.14 Matching, Search, And Ranking Accuracy

Backend matching is generally structured and reasonable for current data:

- The list API filters active providers by category, state, ZIP, scope, search query, and tags.
- Recommendation API uses profile, address, moving plan, existing services, state rules, provider metadata, and coverage match tiers.
- Matching prioritizes exact ZIP, ZIP prefix, polygon, state, live address, and federal models.
- Scores consider criticality, relocation relevance, existing service de-duplication, popularity, and coverage tier.

Accuracy limitations:

- The algorithm can only be as accurate as the seed data and coverage metadata.
- If a user has state but no ZIP/coordinates, state-scoped and federal providers may be shown too broadly.
- Web/mobile UI does not prominently expose `coverageMatchLevel`, `coverageNote`, `coverageSourceUrl`, `requiresAddressCheck`, or `requiresPolygonCheck`.
- Ranking may make broad national brands look more relevant than local official providers if coverage data is thin.

### 4.15 Provider Verification Plan

Until official-company validation is performed, provider records should remain treated as unverified directory entries.

Recommended verification path:

1. Add a provider audit export from the existing seed/catalog with slug, name, category, scope, states, ZIP rules, website, phone, and description.
2. Validate websites against official company/government sources, not generic search snippets.
3. Record redirect chains, HTTP status, canonical domain, and official contact page where available.
4. Review cross-category duplicate domains and decide whether each is a legitimate multi-category provider or an accidental duplicate.
5. Review address-sensitive federal and state-scoped providers and downgrade UI confidence until address-level validation exists.
6. Rewrite generic or marketing descriptions into neutral, sourceable descriptions.
7. Define a stale-data SLA, such as recheck critical utility/government/provider records every 90 days.
8. Only after source validation, expose official/verified labels to users.

## 5. Provider User Experience Audit

### 5.1 How Users Discover Providers Today

Web:

- Users visit the providers area.
- The page fetches `/api/providers` and `/api/providers/recommendations`.
- Users can search, filter by category, and see recommended providers.
- Users can open provider detail pages and add providers as services.

Mobile:

- Mobile fetches the primary address and calls provider APIs.
- Users see provider lists, category chips, recommendation data, detail screens, website links, phone actions, and add-service actions.

Admin:

- Operators can list, filter, create, edit, bulk import, bulk export, activate/deactivate, delete, update category, update score, and inspect provider details and coverage rows.

### 5.2 How Providers Are Filtered And Matched

Backend behavior:

- `/api/providers` filters by active provider status, search query, category, scope, state, ZIP, and tags.
- State/ZIP filtering uses `ServiceProviderCoverage` rows plus `FEDERAL` scope.
- Recommendation logic combines user profile/address/moving plan/services with provider coverage and category relevance.
- Provider matching assigns coverage tiers such as exact ZIP, ZIP prefix, polygon, state, live-address check, or federal.

### 5.3 How Providers Connect To User Services

The current system supports adding a provider as a tracked service. It does not support official account linking, provider-side address changes, connector execution, or automatic updates.

This distinction must remain clear in the UI:

- "Add as service" means create or associate a local service record.
- It does not mean "connect provider account".
- It does not mean "update address at provider".
- It does not mean "verified official provider integration".

### 5.4 What Web Shows

Web provider list/detail surfaces show:

- Provider name.
- Category.
- Description.
- Website.
- Phone.
- Scope/state coverage.
- Popularity/recommendation context.
- Add-service action.

Main gap:

- Web does not clearly show provider verification status, last checked date, source, address-level coverage confidence, or manual-only status.

### 5.5 What Mobile Shows

Mobile provider surfaces show:

- Provider name.
- Category.
- Description.
- Website/phone actions.
- Nationwide or state coverage label.
- Add-service action.
- Fallback category icon when no logo exists.

Main gap:

- Mobile response types include coverage metadata fields, but the visible UI does not make coverage limitations or unverified data status clear.

### 5.6 What Admin Controls

Admin can materially alter provider data:

- Create and edit providers.
- Import CSV rows.
- Export a limited CSV.
- Activate/deactivate providers.
- Change categories and popularity scores.
- Delete providers with password confirmation.
- View coverage rows and audit logs.

Admin gaps:

- No source/verification fields.
- No review/approval workflow.
- No data-quality status.
- No official-vs-unverified label.
- No stale-provider queue.
- No broken-link queue.
- No full-fidelity export of every provider field.
- Bulk category/status/score actions do not require the same step-up as deletion.

### 5.7 What Backend Returns

The provider API can return useful coverage metadata:

- `coverageModel`.
- `coverageMatchLevel`.
- `coverageNote`.
- `coverageSourceUrl`.
- `requiresAddressCheck`.
- `requiresPolygonCheck`.
- Coverage model counts in metadata.

The UI should use those fields more explicitly before provider discovery is marketed as location-accurate.

### 5.8 Data That Can Become Stale Or Misleading

Stale-risk fields:

- Website.
- Phone.
- Description.
- Category.
- Coverage states.
- ZIP prefixes.
- Provider active status.
- Government/state rule associations.
- Popularity score.

There is no current field for "last externally verified". `updatedAt` only proves the local record changed.

### 5.9 User Misunderstanding Risks

High-risk misunderstandings:

- User thinks a provider is official because it appears in the app.
- User thinks "Nationwide" means the provider serves their specific address.
- User thinks "State Coverage" means utility/transit/service eligibility in every city of that state.
- User thinks contact data was recently verified.
- User thinks adding a provider as a service starts an address-change or account-linking workflow.
- User thinks recommendation rank means best provider or guaranteed relevance.

## 6. Backup, Restore, And DR Audit

### 6.1 What Is Protected

Canonical backup catalog currently includes:

- `users`
- `profiles`
- `providers`
- `providerCoverages`
- `addresses`
- `movingPlans`
- `services`
- `budgets`
- `subscriptions`
- `notifications`
- `auditLogs`

Backup import order is dependency-aware:

1. `users`
2. `profiles`
3. `providers`
4. `providerCoverages`
5. `addresses`
6. `movingPlans`
7. `services`
8. `budgets`
9. `subscriptions`
10. `notifications`
11. `auditLogs`

Replace-mode guardrails prevent deleting parent tables without required dependent tables for major relationships.

### 6.2 What Is Not Protected

Current backup catalog does not protect:

- `BackupRecord` rows.
- Admin users, admin sessions, or admin-specific audit records.
- Runtime config records.
- Feature flags.
- Notification queue records.
- Processed webhook event records.
- OAuth accounts.
- Login sessions.
- Password reset tokens.
- Email verification tokens.
- Push devices.
- Help center content.
- State rules.
- Email templates.
- Waitlist records.
- Object storage files.
- Environment variables and secrets.
- Managed database-level metadata, indexes outside Prisma state, extensions, roles, grants, and PITR history.

Some exclusions are reasonable for security or retention reasons, but they need an explicit backup-scope decision and restore test coverage.

### 6.3 Where Backups Live

Manual backups:

- If offsite storage is configured and upload succeeds, the backup archive is uploaded to S3/R2-compatible storage and metadata is stored in `BackupRecord`.
- If offsite storage is disabled or upload fails outside production, the admin API can return `downloadData` for immediate browser download.
- In production, browser-download fallback is disabled and offsite retention is required.
- `BackupRecord` stores metadata only; it is not a durable archive store.

Cron backups:

- Use the same canonical backup table order.
- Upload to offsite storage when configured.
- Store metadata in `BackupRecord`.

Downloads:

- `/api/backup/[id]/download` retrieves archives from offsite object storage.
- If a backup was not stored offsite, later server-side download is unavailable.

### 6.4 Encryption And Signing

Current behavior:

- `encryptBackup(content)` encrypts only if `FIELD_ENCRYPTION_KEY` is configured.
- `signBackup(content)` signs only if `FIELD_ENCRYPTION_KEY` is configured.
- Follow-up Backup/DR stabilization blocks production backup creation when `FIELD_ENCRYPTION_KEY` is missing or invalid.
- Import MERGE/REPLACE requires signature and raw content verification.
- DRY_RUN can inspect unsigned archives.

Readiness concern:

- Production backup creation now fails closed if encryption/signing is unavailable. A plaintext backup archive remains acceptable only for explicitly non-production local/test behavior.

### 6.5 Backup Create

Strengths:

- Admin permission and password confirmation are required.
- Tables are selected from the canonical catalog.
- Records are serialized into a versioned archive.
- Encryption, signing, metadata, and offsite upload paths exist.

Gaps:

- Manual backup uses a `take: 50000` table cap. Large production tables could be partially backed up without obvious product-level RPO framing.
- Production backup creation fails closed when `FIELD_ENCRYPTION_KEY` is missing or invalid.
- Offsite upload failure can still produce browser download fallback outside production. In production, it now fails the backup job.

### 6.6 Backup Verify

Strengths:

- Parses archive and legacy formats.
- Decrypts encrypted archives.
- Verifies HMAC signatures when present.
- Warns on unsigned archives.
- Checks duplicate IDs and sample fields.

Resolved inconsistency:

- `apps/admin/src/app/api/backup/verify/route.ts` now derives recognized tables from the canonical backup catalog and includes the `providerCoverages` counter.
- Result: a valid canonical backup containing provider coverage rows is recognized consistently during verification.

This was a small, current-system stabilization bug and is covered by route tests.

### 6.7 Backup Import And Restore

Strengths:

- Import requires SUPER_ADMIN.
- MERGE and REPLACE require password confirmation.
- MERGE and REPLACE require signed content.
- Dry-run is supported.
- Import runs in a transaction.
- Replace safety checks block unsafe parent-table replacement selections.
- Unknown tables are rejected by catalog normalization.

Gaps:

- MERGE skips existing IDs and does not update existing rows.
- Imported `createdAt` and `updatedAt` values are stripped, so restores do not preserve original timestamps.
- There is no evidence of a full restore drill against a clean staging database.
- Restore only covers selected application tables, not a full managed database restore.

### 6.8 Retention

Current behavior:

- Backup retention deletes old `BackupRecord` rows, with defaults around completed backups older than 30 days and failed backups older than 7 days.
- Retention also prunes processed webhook events.
- It keeps a maximum number of backup records.

Gap:

- Retention appears to delete DB metadata records, not offsite objects. Offsite object lifecycle must be configured at the bucket/provider level or implemented explicitly.

### 6.9 Offsite Storage

Current behavior:

- S3/R2-compatible offsite upload/download exists through app-level SigV4 signing.
- Required env includes provider, bucket, region, endpoint, access key ID, and secret access key.

Gaps:

- No live bucket upload/download test was performed in this audit.
- Bucket encryption, versioning, object lock, lifecycle, cross-region replication, and access logging were not verified.
- No object storage backup inventory exists for user uploads or other non-database files.

### 6.10 Deployment Assumptions

The current backup system is an app-level JSON archive for selected Prisma tables. It is not a full replacement for:

- Managed MySQL/Postgres PITR.
- Managed database snapshots.
- Object storage backup.
- Secrets/configuration escrow.
- App deployment artifact rollback.
- External log/Sentry retention.

If production uses managed MySQL/Postgres, the minimum DR posture should include both:

- Managed database snapshots/PITR from the database provider.
- App-level backups for selected table-level restore and portability.

### 6.11 RPO/RTO Estimate

Current proven RPO:

- Unproven.

Potential RPO if cron backup is configured, offsite upload works, and encrypted/signing keys are present:

- Roughly the cron interval, commonly 24 hours if daily.

Current proven RTO:

- Unproven.

Potential RTO for selected-table restore after database availability:

- Likely hours, but not contractible until a restore drill is performed.

Full product RTO:

- Unknown because object storage, secrets, admin accounts, runtime config, and full managed DB restore have not been proven together.

### 6.12 Backup/DR Gaps Before Production

Production blockers:

1. Prove a full create, offsite upload, verify, dry-run, restore, and smoke-test drill in staging.
2. Keep production backup archive fail-closed coverage in tests for encryption/signing and offsite retention.
3. Keep verify/catalog coverage for `providerCoverages` in tests.
4. Decide backup scope for state rules, help center, feature flags, runtime config, admin users, and operational records.
5. Confirm managed DB PITR/snapshot settings and restoration procedure.
6. Confirm object storage backup/versioning/lifecycle policy.
7. Confirm offsite bucket encryption and access controls.
8. Document exact RPO/RTO after the first successful drill.

## 7. Admin Operator Readiness

| Module | Classification | What Operators Can Do Today | What They Cannot Do Yet | Required For Paying-Product Support | Needed |
|---|---|---|---|---|---|
| Users | Usable but thin | Search/list users, inspect redacted detail, edit selected profile/subscription fields, revoke sessions, add internal/audit notes, queue GDPR delete | Formal approval for high-risk edits, durable case timeline, suspend/lock workflow, policy-backed account recovery | Step-up for risky changes, clearer procedures, support case context | Code, docs, product decision |
| Support | Usable but thin | List/filter tickets, view detail, reply, internal note, assign, set status/priority/category, see derived SLA target | Configured SLA policy, queues, macros, escalation, customer verification workflow | Queue ownership, response templates, escalation playbook | Code, docs, product decision |
| Subscriptions | Read-only/reporting only | Filter/list subscriptions, inspect provider/platform/validation metadata | Refund, cancel, grant, revoke, retry validation, reconcile with Stripe/App Store/Play Store | Controlled finance/support actions with audit and approval | Code, product decision, credentials |
| Billing | Read-only/reporting only | View revenue and subscription metrics | Direct remediation, reconciliation, invoice/payment action workflows | Finance runbook and reconciliation tooling | Code, docs, credentials |
| Providers | Needs urgent fix | CRUD, import/export, bulk activate/deactivate/delete/category/score, inspect coverage rows and audit logs | Source/verification state, review/approval, stale/dead validation, official labels, full-fidelity export, safe bulk governance | Data governance workflow and trust labels before strong user claims | Code, data cleanup, product decision |
| Moving | Read-only/reporting only | View/filter moving-related operational data | Resolve workflows, operator detail actions, escalations | Support drill-down and safe user assistance | Code, product decision |
| State Rules | Needs governance | CRUD state rules with audit logging | Legal/source review, versioning, effective dates, publish/rollback workflow | Reviewable legal/state content lifecycle | Code, docs, product decision |
| Backups | Usable but not proven | Create backups, offsite upload, verify, dry-run/import, retention metadata | Full restore proof, complete scope, encrypted fail-closed behavior, object storage DR | Restore drill and RPO/RTO evidence | Code, infra access, docs |
| Notifications | Usable but intentionally narrow | Create immediate in-app notifications, reject unsupported email/push/scheduled delivery | Email/push worker, scheduler, delivery receipts, campaign governance | Keep honest in-app only or build real worker path later | Product decision, code if expanded |
| Runtime Config | Close to production-ready but needs governance | View/manage runtime config with masking, password confirmation, env fallback | Change approval, impact preview, rotation workflows | Controlled config change process | Docs, code, product decision |
| Security | Usable but thin | Security readiness/dashboard surfaces, some monitoring and controls | Alert acknowledgement, incident queue, owner assignment, full key rotation proof | Incident operating workflow | Docs, code, infra access |
| Logs | Usable but thin | Inspect admin/user activity logs and security events | Immutable external log sink proof, retention policy, alerting from log rules | Forensic confidence and retention policy | Infra access, docs, code |
| Feature Flags | Needs governance | Create/update flags and targeting with audit logs | Owner, expiry, approval, blast-radius review, environment separation | Safe release/kill-switch process | Code, docs, product decision |
| Help Center | Usable but thin | Manage help content/articles/FAQs | Review workflow, versioning, stale checks, broken link checks | Content governance and support alignment | Code, docs, product decision |

## 8. Top 10 Blockers Before Production

1. Provider catalog has no source, official verification, or last-checked metadata, so user-facing provider trust cannot be proven.
2. Provider coverage is too broad for many address-sensitive services: 155 state-scoped and 40 federal address-qualified candidates need review.
3. Web/mobile provider UI can imply official, nationwide, or location-accurate availability without showing confidence or verification caveats.
4. All provider logos are missing, 301 providers lack phone numbers, and 118 descriptions look generic.
5. Full restore has not been proven against a clean staging database.
6. Production backup retention depends on correctly configured offsite storage and DigitalOcean managed database backups.
7. Backup scope excludes several operationally important areas, including state rules, help center, feature flags, runtime config, admin records, object storage, and webhook/queue records.
8. Measured RPO/RTO is still unavailable until a staging restore drill is completed.
9. Subscription and billing admin surfaces are mostly read-only, with no controlled remediation/reconciliation workflows.
10. Provider/state-rule/admin-change governance is too thin for high-trust production operations.

## 9. Top 10 Stabilization-Only Fixes

1. Run the documented restore-drill checklist and capture evidence from create, offsite upload, verify, dry-run, restore, and smoke test.
2. Verify production backup fail-closed behavior in staging with missing `FIELD_ENCRYPTION_KEY` and missing offsite storage.
3. Configure and prove DigitalOcean managed database PITR/snapshots.
4. Add visible provider UI caveats using existing API fields: listed-only, coverage confidence, address-check required, and source note when available.
5. Surface `coverageMatchLevel`, `coverageNote`, `coverageSourceUrl`, `requiresAddressCheck`, and `requiresPolygonCheck` in web/mobile provider detail.
6. Rewrite generic and marketing-heavy provider descriptions into neutral wording.
7. Review cross-category duplicate domains and add data-quality guard thresholds to CI.
8. Expand provider export/import validation to include full current fields and dry-run warnings before bulk changes.
9. Add stronger confirmations or step-up auth for high-impact admin bulk provider changes and user subscription edits.
10. Add operator runbooks for provider data review, backup restore drill, subscription reconciliation, and support identity-verification procedures.

## 10. Items Requiring Product Decision

1. Whether providers are a simple directory or a verified official provider catalog.
2. What evidence is required before showing a provider as official, verified, or location-accurate.
3. Whether address-qualified providers should be shown before address-level validation exists.
4. What backup scope should include for operational/admin/auth tables.
5. Whether state rules need legal review, versioning, and publish workflow before production.
6. What admin staff are allowed to do with subscription, premium, trial, refund, grant, and cancellation state.
7. Whether notifications remain immediate in-app only or become a real multi-channel worker system.
8. What contractual or non-contractual SLA policy support should use.
9. What data retention rules apply to backups, logs, admin notes, support tickets, and audit records.
10. Whether provider data edits require approval, source links, and stale-data review.

## 11. Items Requiring External Credentials Or Infrastructure Access

1. Production or staging database access to confirm real table sizes and backup duration.
2. S3/R2 bucket credentials to test upload, download, lifecycle, encryption, and access policy.
3. `FIELD_ENCRYPTION_KEY` in staging to verify encrypted/signed backup creation and restore.
4. Cron secret/runtime access to test scheduled backup execution.
5. Managed database console access to verify snapshots, PITR, restore behavior, and retention.
6. Object storage inventory access for any user-uploaded files outside database backups.
7. Sentry/log sink access to verify retention, redaction, and incident forensics.
8. Store credentials for Apple/Google subscription validation and reconciliation checks.
9. Stripe dashboard/API credentials for billing reconciliation checks.
10. Official provider validation process or approved web research access for provider websites, contact data, and coverage sources.

## 12. Final Readiness Summary

The current product is closer to production-ready after the hardening and typecheck foundation work, but it is not yet fully production-ready, operator-ready, or data-trustworthy.

Provider catalog:

- Useful breadth exists.
- Data trust and sourceability are not production-grade.
- User-facing claims need caveats until validation exists.

Backup/restore:

- Core mechanics exist.
- Restore is not proven.
- Encryption/signing and catalog consistency need fixes before relying on it for DR.

Admin:

- Operators can perform many current workflows.
- Several modules remain reporting-only or governance-thin.
- Paying-product support needs clearer procedures, controlled actions, and restore/provider/subscription proof.

The next stabilization work should focus on data trust and DR proof, not product expansion.
