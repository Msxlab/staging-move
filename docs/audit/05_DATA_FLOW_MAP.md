# 05 — Data Flow Map (LocateFlow)

Area slug: `data-flow-map`. Read-only audit. Evidence is from `packages/db/prisma/schema.prisma` and the route/lib source cited inline. Line numbers are from the files at audit time.

Conventions used below:
- **Tenant scope FK** = a `workspaceId` column with an FK to `Workspace` (the Family/Pro isolation axis). The schema notes these are nullable in Phase 1 and inert until `WORKSPACE_MODEL_ENABLED` (schema.prisma:439-441, 2169-2174).
- **PII** = directly identifying or sensitive personal data.

---

## Section A — Model overview by domain

### A.1 Auth / Users
| Model | Key relations | Tenant scope | PII columns |
|---|---|---|---|
| `User` (12) | 1–1 `Subscription`,`Profile`; 1–N nearly everything; `ownedWorkspaces`,`workspaceMemberships` | n/a (is the owner axis) | `email`, `firstName`, `lastName`, `imageUrl`, `passwordHash`, `mfaSecret` (enc), `mfaBackupCodes` |
| `PushDevice` (88) | N–1 `User` (Cascade) | no | `token`, `deviceName` |
| `OAuthAccount` (103) | N–1 `User` (Cascade) | no | `providerId` (sub claim) |
| `MobileOAuthCode` (117) | N–1 `User` | no | `codeHash`,`codeChallenge` (hashed) |
| `UserLoginSession` (137) | N–1 `User` | no | `ipAddress`,`userAgent`,`browser`,`os`; `impersonatedByAdminId` |
| `OAuthState` (163) | none | no | hashes only |
| `PasswordResetToken` (177) / `EmailVerificationToken` (218) | N–1 `User` | no | `tokenHash` (hashed); EmailVerificationToken stores `email` plaintext |
| `DataConsent` (201) | N–1 `User` | no | `ipAddress`,`userAgent` |

Auth tokens are consistently stored as `tokenHash` (sha256) with TTL + `@@index([expiresAt])`, never plaintext (e.g. 141, 181, 223).

### A.2 Workspaces / Tenancy
| Model | Key relations | Tenant scope | PII |
|---|---|---|---|
| `Workspace` (2176) | owner→`User` (Restrict); `members`,`invitations`,`addresses`,`services`,`movingPlans`,`budgets` | self (root) | `name` |
| `WorkspaceMember` (2206) | N–1 `Workspace`,`User`; self-rel `ChildParent` | yes (`workspaceId`) | none direct |
| `WorkspaceInvitation` (2244) | N–1 `Workspace` | yes | `invitedEmail` (plaintext), `tokenHash` |
| `WorkspaceAuthChallenge` (2276) | loose refs | loose `workspaceId` | `tokenHash` |

`Workspace.owner` is `onDelete: Restrict` (2179) — owned workspaces block user erasure until reassigned; account-deletion handles this explicitly (account-deletion.ts:321-358).

### A.3 Billing / Subscriptions
| Model | Key relations | Tenant scope | PII / sensitive |
|---|---|---|---|
| `Subscription` (232) | 1–1 `User`; N–1 `AcquisitionCampaign` | no (per-user) | `stripeCustomerId`, `purchaseToken` (plaintext + `purchaseTokenEncrypted` + `purchaseTokenHash`), `originalTransactionId` |
| `AcquisitionCampaign` (316) | created-by `AdminUser` | no | none |
| `AcquisitionRedemption` (358) | N–1 `Campaign`,`User`,`Subscription` | no | `consentIpHash`,`consentUserAgentHash` (hashed) |
| `ProcessedWebhookEvent` (1693) | none (id = Stripe evt id) | no | none |

Out-of-order webhook protection: `Subscription.lastStripeEventAt` is compared against `event.created` and only newer events are applied (webhooks/stripe/route.ts:315-333). Idempotency via `ProcessedWebhookEvent` (`markWebhookEventProcessed`, route.ts:11,649). Note `purchaseToken` exists as both plaintext (`@db.Text`, 250) and encrypted (251) — see DF-04.

### A.4 Providers / Connectors
| Model | Key relations | Tenant scope | PII |
|---|---|---|---|
| `ServiceProvider` (733) | catalog hub; N services/coverages/feedback/clicks | no (global catalog) | none (business data) |
| `ServiceProviderCoverage` (1105) / `StateRule` (715) | N–1 provider | no | none |
| `SavedProvider` (848) / `RecommendationFeedback` (864) | N–1 `User`,`Provider` | no | none |
| `UserCustomProvider` (1025) | N–1 `User`; link to `ServiceProvider` | **no `workspaceId`** | `email`,`phone`,`addressLine1/2`,`city`,`state`,`zipCode` — **plaintext** |
| `ProviderGovernanceIssue` (1072) / `ProviderLogoCandidate` (906) | N–1 provider / customProvider / admin | no | none |
| `AffiliateClick` (806) / `AffiliateConversion` (884) | N–1 provider; click→user | no | `userId` link |
| `PartnerConsent` (2000) | N–1 `User`; 1–N `ConnectorDispatch` | no (per-user) | `tokenEncrypted`,`refreshTokenEncrypted`,`consentSnapshotJson` (token cols encrypted) |
| `ConnectorConfig` (2039) | global | no (global config) | none |
| `ConnectorDispatch` (2059) | N–1 `User`,`PartnerConsent`,`AddressChangeEvent` | no (loose only) | `payloadEncrypted`,`confirmationEncrypted` (encrypted) |
| `AddressChangeEvent` (2114) | N–1 `User`; 1–N dispatches | loose `workspaceId` (no FK) | `fullName` — **plaintext** (2129) |
| `ConnectorFallbackAction` (2150) | global | no | none |

### A.5 Addresses / Moving / Tasks
| Model | Key relations | Tenant scope | PII |
|---|---|---|---|
| `Address` (434) | N–1 `User`,`Workspace`; many | **yes** `workspaceId` (443) | `street`,`street2`,`city`,`state`,`zip`,`latitude`,`longitude`,`placeId`,`formattedAddress` (formattedAddress encrypted at API — addresses/route.ts:52,101) |
| `Service` (488) | N–1 `User`,`Workspace`,`Address`,`Provider`,`CustomProvider` | **yes** `workspaceId` (494) | `accountNumber`,`username`,`phone`,`email` — encrypted via `encryptServiceSensitiveFields` (services/route.ts:13,274) |
| `ServiceCostLog` (585) | N–1 `Service` | inherited | amounts |
| `MovingPlan` (605) | N–1 `User`,`Workspace`; from/to `Address` (Restrict) | **yes** `workspaceId` (611) | none direct |
| `MoveTask` (939) | N–1 `User`,`MovingPlan`,`Service`,addresses,providers,assignee | **no own `workspaceId`** — scoped via `movingPlan.workspaceId` | `notes` free text |
| `Reminder` (689) | N–1 `Service` | inherited | `title`,`message` |

### A.6 Budget
| Model | Key relations | Tenant scope | PII |
|---|---|---|---|
| `Budget` (649) | N–1 `User`,`Workspace`,`Address` | **yes** `workspaceId` (655) | financial amounts; `notes` |

### A.7 Notifications / Email
| Model | Key relations | Tenant scope | PII |
|---|---|---|---|
| `NotificationPreference` (1459) | N–1 `User` | no | none |
| `Notification` (1476) | N–1 `User` | no | `body`,`title` free text |
| `NotificationQueue` (1512) | loose `userId`; broadcast | no | `body`; purged on erasure (account-deletion.ts:370) |
| `EmailTemplate` (1539) / `EmailLog` (1564) | log→template | no | `EmailLog.to` — **plaintext email**, indexed (1572,1585) |

### A.8 Content / Blog
`BlogPost` (1859), `BlogCategory`, `BlogTag`, `BlogPostTag`, `BlogRevision`, `BlogView`. Author→`AdminUser`. No tenant scope (global content). `BlogView.ipHash` is hashed (1976). `contentHtml` is server-sanitized (DOMPurify) per the model comment (1844-1850).

### A.9 Partners / Affiliate / Movers (lead-gen)
| Model | Tenant scope | PII |
|---|---|---|
| `MovingCompany` (2324) | no (public FMCSA catalog) | `phone`,`legalName` (public registry) |
| `SponsoredPlacement` (2355) | no | none |
| `Lead` (2385) | no (loose `userId`) | PII in `payloadEncrypted` (encrypted); `ipHash` hashed |
| `LeadDispatch` (2438) | no | none |
| `Partner` (2469) | no | `contactName`,`contactEmail`,`contactPhone` — **plaintext** |
| `PartnerDocument` (2507) / `PartnerLedgerEntry` (2546) / `PartnerInvoice` (2570) | no | none |
| `PartnerPortalToken` (2527) / `MoverPortalToken` (2683) | no | `tokenHash` (hashed), `email` plaintext |
| `MoverApplication` (2596) | no | `contactName`,`contactEmail`,`contactPhone` — **plaintext** |
| `MoverDocument` (2661) | no | object keys only |

### A.10 Admin / Audit
`AdminUser` (1213, `password`,`mfaSecret`,`mfaBackupCodes`), `AdminSession` (1258), `AdminMfaTrustedDevice` (1284), `AdminLoginLog` (1305, `ipAddress`,`email`), `AdminPermission` (1332), `AdminAuditLog` (1347, `adminUserId` nullable SetNull so trail outlives admin), `AdminActionOtp` (1388), `AdminSetPasswordToken` (1413), `RuntimeConfigEntry` (1428, `valueEncrypted`). `AuditLog` (1123) and `UserEvent`/`UserSession` (1148/1190) are user-scoped analytics with `ipAddress`/`userAgent`/geo PII. No workspace scope on any (audit/analytics are intentionally user/admin-scoped).

### A.11 Integrations
`IntegrationDailyStat` (2305, aggregate counters, no PII), `AddressDataCacheEntry` (833, AREA facts keyed by rounded geo, comment asserts "never user data", 832), `FeatureFlag` (1636), `IPRule` (1657), `RateLimitLog` (1674), `GDPRRequest` (1702), `BackupRecord` (1721), `SupportTicket`/`TicketMessage` (1747/1778), `WaitlistSignup` (1803, `email` plaintext + `ipHash`), `HelpArticle`/`FAQ`.

---

## Section B — Critical data flow traces

### B.1 Signup (password)
UI sign-up form → `POST /api/auth/register` (auth/register/route.ts).
Flow: parse/zod (33-50) → rate limit `auth_register` (66) → kill-switch `areSignupsKilled` (82) → legal-consent normalize (89-97) → password policy (99) → COPPA gate (109-118) → **email-taken check uses `rawPrisma`** to see soft-deleted rows and reject re-signup (132-141) → `hashPassword` (161) → `prisma.user.create` (162) → `ensureSubscriptionDefaults` (172) → `ensureWorkspaceDefaults` (176) → fire-and-forget `sendAdminSignupAlert` (182) → `recordLegalAcceptance` (191) → email-verification token create + `sendEmailVerificationEmail` with dedupeKey (207-222). Error handling: validation 400, dup 409, paused 503. Analytics: admin alert only. Impacted: User, Subscription, Workspace(+Member), EmailVerificationToken, DataConsent/legal, EmailLog.
Note: subscription/workspace/email-verification are sequential `await`s outside a transaction; a crash mid-sequence can leave a User without a Subscription/Workspace (DF-08).

### B.2 Subscription purchase (Stripe web)
Pricing UI → `POST /api/stripe/checkout` → Stripe Checkout → redirect → **`POST /api/webhooks/stripe`** is the authoritative state writer.
Webhook flow: signature verify → event age check (route.ts:651) → `ProcessedWebhookEvent` idempotency (649) → guarded update with `lastStripeEventAt` out-of-order skip (315-333) → writes `Subscription` (stripeCustomerId/SubscriptionId/status/period). Manual-premium guard (379). Release on failure (1320). Cache: client refetches `/api/profile` entitlement snapshot. Errors: 400 bad signature, retries safe via idempotency. Impacted: Subscription, ProcessedWebhookEvent, AcquisitionRedemption.

### B.3 IAP purchase (Apple / Google)
Mobile StoreKit2/Play Billing success → `POST /api/mobile/iap/verify` (mobile/iap/verify/route.ts).
Flow: `requireDbUserId` (55) → dual rate-limit IP+user, fail-open if Redis unconfigured (56-70) → zod discriminated union (33-45) → iOS: local `verifyAppleJws` (92) then `refreshAppleSubscriptionFor(originalTransactionId)` with **signed-transaction fallback** if server lookup fails (110-123); Android: `refreshGoogleSubscriptionFor(purchaseToken)` + productId match (128-134) → `applyIapStateToUser` (139) which enforces receipt ownership (`IAP_TXN_OWNED_BY_ANOTHER_USER` → 409, 141) and single active sub (`ACTIVE_SUBSCRIPTION_MANAGED_ELSEWHERE` → 409, 144). Returns unified entitlement snapshot (152). Errors mapped granularly to 400/404/409/424/503 (162-195) + Sentry. Impacted: Subscription (`purchaseToken*`,`originalTransactionId`,`platform`). Webhooks `appstore`/`playstore` reconcile renewals out-of-band.

### B.4 Add address / move setup
Address form (Places autocomplete) → `POST /api/addresses` (addresses/route.ts:68).
Flow: `requireAppMutationUser` (70) → `resolveWorkspaceDataScope` + `assertWorkspaceAction("address.create")` (71-72) → rate limit 20/min (76) → `canCreateAddress` plan limit (81) → zod `addressSchema` (87) → server-side geocode fallback, fail-open 2.5s cap (95) → **encrypt `formattedAddress`** (101) → `$transaction`: demote actor's existing primaries scoped to actor+workspace, then create (106-120). GET path decrypts `formattedAddress` (52). Impacted: Address (workspace-scoped), downstream MovingPlan/Service/Budget all carry the same `workspaceId`.

### B.5 Move-task generation
Moving page "generate tasks" → `POST /api/move-tasks` (move-tasks/route.ts:139).
Flow: auth → scope + `assertWorkspaceAction("address.edit")` (142-143) → rate limit 20/min (145) → `canGenerateMoveTasks` entitlement (150) → load `MovingPlan` scoped by workspace-or-user (164-171) → re-assert against plan owner (175) → `syncSuggestedMoveTasks(plan.userId, movingPlanId)` (180) → re-query tasks (181) → `createAuditLog TASK_GENERATED` (188) → `recordMoveTaskEvent` → UserEvent (196). PATCH handles lifecycle (ACCEPT/START/COMPLETE/DISMISS/REOPEN) + assignment with membership validation (320-330); COMPLETE routes through `completeMoveTaskWithLocalEffect` (338). Idempotency via `MoveTask.idempotencyKey` unique per user (1008). Impacted: MoveTask, AuditLog, UserEvent. `metadata.localOnly: true` asserted (no external automation). MoveTask is scoped through `movingPlan.workspaceId` rather than its own column (DF-02).

### B.6 Provider / connector dispatch (address change fan-out)
"Sync now" / address change → `POST /api/connector-dispatch` (connector-dispatch/route.ts).
Flow: session (20) → scope + `assertWorkspaceAction("addressChange.initiate")` (24-25) → `isApiConnectorsEnabled` 503 (27) → `userHasApiConnectorEntitlement` 403 (30) → resolve `toAddressId` (default primary, 40-52) → `enqueueAddressChange` (55). `enqueueAddressChange` (connector-runtime.ts) creates one `AddressChangeEvent` (canonical, address chosen ONCE) then fans out one `ConnectorDispatch` per consented+enabled connector (transactional-outbox). Cron `/api/cron/connector-dispatch` drains rows by `(status, nextRetryAt)` with backoff, encrypts `payloadEncrypted`/`confirmationEncrypted`, degrades to `NEEDS_USER`. Idempotent via `ConnectorDispatch.idempotencyKey` unique (2080) and `AddressChangeEvent.changeRef` unique (2121). Impacted: AddressChangeEvent, ConnectorDispatch, PartnerConsent. `AddressChangeEvent.fullName` is plaintext (DF-03).

### B.7 Notification fan-out
Producers (crons, admin send) enqueue `NotificationQueue` rows (single-user or `broadcast`) or write `Notification` directly → drained by `GET/POST /api/cron/scheduled-delivery` (scheduled-delivery/route.ts).
Flow: cron guard `CRON_SECRET` (273) → `processNotificationQueue` selects due `sent=false, sendAt<=now` capped at 200 (139-154) → **atomic claim** `updateMany where {id,sent:false} data {sent:true}` before any side effect → at-most-once (167-174) → `deliverClaimedRow` → broadcast paginates all users (2000/page) and calls `deliverToUser` per user (81-102) → `createInAppNotification` (always) + optional `sendNotification` EMAIL/PUSH/SMS (114-133), each with dedupeKey `queue:{id}:{userId}` → on failure record `error`, never reset `sent` (190-206). SMS/PUSH fail-closed when unconfigured (notifications.ts:71,81). Impacted: NotificationQueue, Notification, PushDevice, EmailLog. Broadcast cost is O(users) writes per row (DF-07).

### B.8 Account deletion (GDPR Art. 17)
Settings "delete account" → `POST /api/account/delete` (account/delete/route.ts).
Flow: `requireDbUserId({distinguishDeleted:true})` (30) → `emitSecurityEvent ACCOUNT_DELETE_ATTEMPT` always (35) → rate limit (41) → confirm-text DELETE/email validation for OAuth-only (66-86) → MFA rate-limit if attempted (88-112) → `verifyUserStepUp` (password/MFA/backup; OAuth-only bypass only when no password AND no MFA, 114-124) → `createAccountDeletionRequest` (GDPRRequest) (153) → optional grace window (`ACCOUNT_DELETION_GRACE_DAYS`, signed restore token, 164-217) → else `processAccountDeletionRequest` immediately (219).
`processAccountDeletionRequest` (account-deletion.ts): set GDPRRequest PROCESSING (238) → cancel Stripe sub, tolerate "nothing to cancel" (257-265), `forceErase` after retries (300-309) → `destroyAllUserSessions` (320) → resolve owned workspaces, promote heir or mark solo (324-337) → **purge `MovingPlan` BEFORE workspace delete** to avoid FK 1451 (344-348) → transfer shared / hard-delete solo workspaces (352-358) → purge no-FK residue: `WaitlistSignup` by userId+email, `NotificationQueue` by userId (365-370) → `rawPrisma.user.delete` (cascade) (371) → scrub residual PII from retained GDPRRequest (387-396). Errors swallowed → retried in PROCESSING. Impacted: nearly all user-owned tables via cascade, plus the explicit no-FK purges. `Lead.payloadEncrypted` (loose `userId`, no FK, no purge listed here) — see DF-06.

---

## Findings

### DF-01 (Medium, Data) — `UserCustomProvider` stores contact + address PII in plaintext and has no tenant scope
`UserCustomProvider` (schema.prisma:1025-1068) holds `email` (1037), `phone` (1036), `addressLine1/2` (1039-1040), `city/state/zipCode` (1041-1043) as plaintext `VarChar`. By contrast `Service` encrypts the equivalent `accountNumber/username/phone/email` via `encryptServiceSensitiveFields` (services/route.ts:13,274) and `Address.formattedAddress` is encrypted (addresses/route.ts:101). The model also has no `workspaceId` column, unlike the parallel `Service`/`Address`/`Budget` (494/443/655), so in Family/Pro it is only user-scoped.
- Impact: a data store snapshot/dump exposes user-entered provider contact + street addresses in clear text; inconsistent with the encryption applied to sibling models. No workspace isolation column for the multi-member model.
- Recommendation: encrypt the contact/address columns the same way `Service` does, and add a nullable `workspaceId` + index consistent with the other domain tables. [needs verification — confirm no encryption is applied in the custom-providers route]
- Files: packages/db/prisma/schema.prisma:1025-1068; apps/web/src/app/api/custom-providers/route.ts; apps/web/src/app/api/services/route.ts:274.

### DF-02 (Low, Data) — `MoveTask` has no own `workspaceId`; tenant isolation relies on a join to `MovingPlan`
`MoveTask` (939-1021) carries `userId` and `movingPlanId` but no `workspaceId`. All workspace scoping is enforced by filtering on `movingPlan: { workspaceId }` (move-tasks/route.ts:81-89, 164-171). Sibling domain rows (Service/Budget/Address/MovingPlan) each carry their own `workspaceId`.
- Impact: every scoped MoveTask query must join MovingPlan; any future code path that forgets the join loses workspace isolation. Slightly higher query cost and a sharper correctness edge than the self-scoped siblings.
- Recommendation: consider an additive nullable `workspaceId` on MoveTask mirroring the other tables, backfilled from its plan, so isolation does not depend on a join.
- Files: packages/db/prisma/schema.prisma:939-1021; apps/web/src/app/api/move-tasks/route.ts:81-89.

### DF-03 (Medium, Data) — `AddressChangeEvent.fullName` is plaintext PII while the rest of the connector pipeline is encrypted
The connector outbox deliberately encrypts moving PII: `ConnectorDispatch.payloadEncrypted`/`confirmationEncrypted` (2087-2092) and `Lead.payloadEncrypted` (2404) use `FIELD_ENCRYPTION_KEY`. But `AddressChangeEvent.fullName` (schema.prisma:2129) — the person's full name for the move — is stored as plaintext `VarChar(200)`.
- Impact: the canonical move event row exposes the user's full name in clear text in the DB and in backups, inconsistent with the encrypted dispatch payloads it fans out to.
- Recommendation: store the name in an encrypted column (or fold it into an encrypted payload) consistent with `ConnectorDispatch.payloadEncrypted`, or document why this specific field is exempt.
- Files: packages/db/prisma/schema.prisma:2114-2143.

### DF-04 (Low, Data) — `Subscription.purchaseToken` retained as plaintext alongside its encrypted twin
`Subscription` has `purchaseToken String? @db.Text` (plaintext, 250), `purchaseTokenEncrypted` (251) and `purchaseTokenHash` (252). The presence of both a plaintext and an encrypted column for the same IAP token suggests a migration artifact; the plaintext column undermines the value of the encrypted one if still written.
- Impact: if the plaintext column is still populated, a sensitive store purchase token is recoverable from a DB dump despite the encrypted column existing.
- Recommendation: confirm writers populate only `purchaseTokenEncrypted`/`purchaseTokenHash` and stop writing/backfill-null `purchaseToken`, then drop the plaintext column. [needs verification — confirm whether `purchaseToken` is still written by the IAP apply path]
- Files: packages/db/prisma/schema.prisma:250-252; apps/web/src/lib/iap-common.ts.

### DF-05 (Low, Performance) — `EmailLog.to` is an indexed plaintext-email hot path
`EmailLog.to` is plaintext email (1572) with `@@index([to])` (1585) and the table is append-only and high-volume. It is not purged in the account-deletion residue sweep (account-deletion.ts:365-370 purges only WaitlistSignup + NotificationQueue).
- Impact: deleted users' email addresses persist in `EmailLog` after a GDPR erasure; plaintext email on a growth table.
- Recommendation: decide a retention/scrub policy for `EmailLog.to` on erasure (hash or null after delivery + retention window), consistent with the WaitlistSignup/NotificationQueue purge already done.
- Files: packages/db/prisma/schema.prisma:1564-1589; apps/web/src/lib/account-deletion.ts:365-370.

### DF-06 (Medium, Data) — `Lead` PII keyed by a loose `userId` is not explicitly purged on account deletion
`Lead.userId` is a loose ref with **no FK** (schema.prisma:2389-2391), so the `User` cascade does not reach it. The model comment says erasure should handle PII "via payloadEncrypted rather than a cascade" (2389-2390), but `processAccountDeletionRequest` only explicitly purges `WaitlistSignup` and `NotificationQueue` (account-deletion.ts:365-370) — there is no `Lead.deleteMany`/scrub for the deleted user.
- Impact: after a self-service erasure, a user's encrypted lead PII (name/contact/notes in `payloadEncrypted`) remains in the `Lead` table. Encryption mitigates exposure but the data is retained, which conflicts with Art. 17 erasure intent.
- Recommendation: add an explicit `rawPrisma.lead.deleteMany({ where: { userId } })` (or documented retention exception) to the erasure path mirroring the other no-FK purges. [needs verification — confirm no other sweep deletes Lead rows by userId]
- Files: packages/db/prisma/schema.prisma:2385-2429; apps/web/src/lib/account-deletion.ts:359-371.

### DF-07 (Low, Performance) — Broadcast notification fan-out writes one row per user per queue row
`deliverClaimedRow` for a broadcast row pages the entire `User` table and calls `deliverToUser` per user (scheduled-delivery/route.ts:81-102), each writing a `createInAppNotification` row (114) and optionally an email/push. For N users that is O(N) inserts (plus O(N) emails) for a single queue row, all in one cron tick capped only by `QUEUE_BATCH=200` rows (not by audience size).
- Impact: a single broadcast to a large user base can dominate a cron tick and the DB write path; no per-tick audience cap means one broadcast row's fan-out is unbounded within the tick.
- Recommendation: chunk broadcast delivery across ticks (cursor persisted on the queue row) or use `createMany` for the in-app rows, so one broadcast can't monopolize a tick.
- Files: apps/web/src/app/api/cron/scheduled-delivery/route.ts:81-137.

### DF-08 (Low, Reliability) — Signup provisioning is multiple sequential awaits without a transaction
In `register` the `User` is created (162), then `ensureSubscriptionDefaults` (172), `ensureWorkspaceDefaults` (176), legal acceptance (191) and the verification token (207) run as independent sequential awaits. A failure after `user.create` but before the later steps leaves a User row with no Subscription and/or no Workspace.
- Impact: partially-provisioned accounts (no default subscription/workspace) that downstream code assumes always exist; the dup-email guard then blocks the user from retrying signup (132-141).
- Recommendation: wrap user + subscription + workspace provisioning in one transaction, or make the read paths self-heal (`ensure*` on access). [needs verification — confirm `ensureSubscriptionDefaults`/`ensureWorkspaceDefaults` are not idempotently re-run elsewhere on login]
- Files: apps/web/src/app/api/auth/register/route.ts:162-214.

---

## Open questions / needs-verification
- Whether the custom-providers route encrypts any of the PII columns (DF-01).
- Whether `Subscription.purchaseToken` plaintext is still written by the IAP apply path (DF-04).
- Whether any sweep deletes `Lead` rows by `userId` on erasure (DF-06).
- Whether `ensureSubscriptionDefaults`/`ensureWorkspaceDefaults` self-heal on login, mitigating DF-08.
