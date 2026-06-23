# Module Audit: Admin Management Surfaces

> READ-ONLY audit. Evidence = source code only. Paths are relative to repo root
> `staging-move/`. Line numbers were accurate at audit time (2026-06-22).

## 1. Module Summary

The Admin Management surface is the operations control plane for LocateFlow:
user/PII administration (impersonation, hard-delete, export), billing &
subscription mutations (refund / cancel / change-plan), the runtime-config &
feature-flag & connector kill-switch control plane, backup/export of the
crown-jewels data, team (admin_users) RBAC management, workspaces, and a long
tail of editorial/CRM surfaces (blog, help-center, email-templates,
notifications, partners, movers, sponsored, state-rules, waitlist,
acquisition-campaigns, affiliate, provider-governance, logs, tickets, leads,
insights, reports, analytics).

Overall posture is **strong and unusually mature**. A consistent defense stack
is applied across the high-risk routes:

- Custom JWT session (`jose`, HS256) bound to an IP-bucket + UA **fingerprint**
  (`apps/admin/src/lib/auth.ts`), DB-tracked session rows, isActive re-check.
- **Edge middleware** (`apps/admin/src/middleware.ts`) enforcing IP rules,
  per-route rate limits (Redis with fail-closed in prod), body-size caps, a
  CSRF/Origin/Referer check on mutations, a forced-password-rotation gate, an
  MFA-setup gate, and a session-hijack fingerprint check.
- **Fail-closed RBAC** (`requirePermission` → `checkPermission`,
  `apps/admin/src/lib/auth.ts:690`) — absence of an `AdminPermission` row = deny;
  role re-read from DB (not the JWT) on every gate; SUPER_ADMIN short-circuit.
- **Step-up** (`requirePasswordConfirm`) with password + MFA + rate-limited
  failure lockout on every money-moving / destructive / secret-writing route.
- **OTP** second factor on the irreversible user hard-delete.
- Pervasive **audit logging** (`writeAdminAudit`) with PII masking and
  secret-free metadata; CSV-injection-safe exports (`lib/csv-safety.ts`);
  k-anonymity floor on spending analytics; HTML sanitization on email templates.

Findings are therefore mostly **consistency gaps and lower-severity hardening
items**, not broken primitives. No Critical issues were confirmed.

## 2. Related Files (representative, not exhaustive)

Auth / RBAC / guards:
- `apps/admin/src/lib/auth.ts` — session, `requireAdmin`, `requireRole`,
  `requirePermission`, `checkPermission`, `requirePasswordConfirm`.
- `apps/admin/src/lib/admin-permissions.ts` — resource enum + default matrix.
- `apps/admin/src/lib/admin-roles.ts` — MFA-required roles.
- `apps/admin/src/lib/page-guard.ts` — server-side page guards.
- `apps/admin/src/middleware.ts` — edge gating.
- `apps/admin/src/lib/audit.ts`, `lib/privacy.ts`, `lib/csv-safety.ts`,
  `lib/admin-action-otp.ts`, `lib/auth-step-up-store.ts`.

High-risk routes:
- `app/api/users/[id]/impersonate/route.ts`, `users/[id]/hard-delete/route.ts`,
  `users/[id]/hard-delete/otp/route.ts`, `users/export/route.ts`.
- `app/api/runtime-config/route.ts`, `feature-flags/route.ts`,
  `connectors/route.ts`, `connectors/[connectorKey]/route.ts`.
- `app/api/backup/[id]/download/route.ts`, `backup/sql-dump/route.ts`,
  `backup/import/route.ts`.
- `app/api/subscriptions/[id]/refund/route.ts` (+ cancel/change-plan),
  `app/api/team/route.ts`, `team/[id]/route.ts`,
  `workspaces/[id]/transfer-ownership/route.ts`.
- `app/api/notifications/route.ts`, `email-templates/route.ts`,
  `providers/bulk/route.ts`, `providers/merge/route.ts`,
  `acquisition-campaigns/route.ts`, `logs/route.ts`,
  `affiliate/export/route.ts`, `state-rules/route.ts`,
  `movers/applications/[id]/documents/[documentId]/download/route.ts`.

## 3. Related Routes / Screens

Server-component pages use `requirePagePermission` / `requirePageRole`
(e.g. `runtime-config` → `requirePageRole("SUPER_ADMIN")`, `team` →
`requirePagePermission("admin_users","canRead",{minimumRole:"ADMIN"})`,
`logs` → `audit_logs:canRead` ADMIN). Many list pages are `"use client"`
components (users, reports, state-rules, waitlist, tickets, support,
provider-governance, analytics, settings/health, providers) gated only by the
`(admin)/layout.tsx` `requirePageAdmin()` (auth, not per-page role) plus the
authoritative API RBAC — see ADM-04.

## 4. Related APIs

126 route files under `app/api/**` (see `_inventory/admin-api.txt`). Mutation
routes consistently call `requirePermission(resource, action, {minimumRole})`;
sensitive ones add `requirePasswordConfirm({requireMfa:true})`. Public/edge-only:
`/api/auth/login`, `/api/build-info`, `/api/healthz`, `/api/ready`,
`/api/auth/set-password`; internal/cron use shared-secret bearer auth.

## 5. Related Components

`components/password-confirm-modal.tsx` (step-up UI), `data-table-page.tsx`
(bulk actions), `quick-drawer.tsx`, `admin-page-header.tsx`,
`sidebar.tsx` / `sub-nav.tsx` / `command-palette.tsx` (role-gated nav fed by the
page-guard permission map). Client pages own their own fetch + toast + modal
state.

## 6. Related State / Hooks / Stores

Client pages use local React state + `sonner` toasts. Server-side step-up grace
+ failure counters live in `lib/auth-step-up-store.ts` (Upstash Redis when
configured, in-memory fallback). Rate-limit state in middleware (Redis / memory).

## 7. Related Database / Models

`AdminUser`, `AdminPermission`, `AdminSession`, `AdminLoginLog`,
`AdminAuditLog`, `AdminActionOtp`, `RuntimeConfigEntry`, `FeatureFlag`,
`ConnectorConfig`/`ConnectorDispatch`/`ConnectorFallbackAction`,
`PartnerConsent`, `BackupRecord`, `EmailTemplate`/`EmailLog`, `Notification`/
`NotificationQueue`, `Subscription`, `User`/`Workspace`/`WorkspaceMember`,
`AcquisitionCampaign`, `AffiliateClick`/`AffiliateConversion`, `StateRule`,
`SupportTicket`, `MoverDocument`, `ServiceProvider`. (See
`_inventory/prisma-models.txt`.)

## 8. Impact Map

- **UI**: client list pages render shells before API authz resolves (low data
  risk; APIs are authoritative).
- **API**: uniform RBAC + step-up; a few consistency gaps (ADM-01, ADM-05).
- **DB**: soft-delete via extended `prisma`; `prismaUnsafe` reserved for
  backup/export and includeDeleted paths.
- **Auth**: fingerprint + MFA gate + forced rotation; fail-closed permissions.
- **Admin**: last-SUPER_ADMIN protection, self-edit guards, role-hierarchy
  guard (`team/[id]/route.ts`).
- **Mobile**: N/A (admin app is web-only).
- **Notifications**: admin broadcast / single-send fan-out (ADM-01).
- **Integrations**: Stripe (refund/campaign price binding), Resend/Expo, R2,
  FMCSA, connector OAuth.
- **Analytics**: k-anonymity floor on spending (`analytics/user-spending`).
- **SEO**: `X-Robots-Tag: noindex` on all admin responses (middleware).
- **Tests**: extensive `*.test.ts` colocated with routes/libs (see §17).

## 9. Buttons / Actions / Functions (high-risk actions)

For each: permission check / step-up / audit / edge cases.

1. **Impersonate user** (`users/[id]/impersonate`): SUPER_ADMIN + `users:canUpdate`
   + step-up (password+MFA), 15-min TTL, handoff via web internal secret,
   audit + user notification. Target must be non-deleted. Solid.
2. **Hard-delete user** (`users/[id]/hard-delete` + `/otp`): SUPER_ADMIN +
   `users:canDelete` + step-up(MFA) + single-use target-bound email OTP
   (attempt-limited, constant-time). Stripe-cancel guard blocks erasure of a
   live paying account unless `force`. Exemplary.
3. **Export users CSV** (`users/export`): ADMIN floor + step-up(MFA);
   email masked unless SUPER_ADMIN; CSV-injection-safe; `no-store`. Solid.
4. **Refund / Cancel / Change-plan** (`subscriptions/[id]/*`): ADMIN +
   `subscriptions:canUpdate` + step-up(MFA); server re-resolves invoice,
   amount-mismatch guard, Stripe idempotency key, START/COMPLETE/FAIL audit.
   Exemplary.
5. **Runtime-config write/delete** (`runtime-config`): SUPER_ADMIN + step-up(MFA);
   strict zod, per-key value validation incl. SSRF guard on URL keys; audit logs
   metadata only (never the secret value); response never echoes value. Solid.
6. **Feature-flag CRUD** (`feature-flags`): ADMIN + step-up(MFA), 1h grace;
   before/after audit. Solid.
7. **Connector kill-switch / stage / rollout** (`connectors` PUT/POST):
   ADMIN + `connectors:canUpdate/Create` + step-up(MFA); before/after audit.
   Solid.
8. **Backup download / SQL dump / import** (`backup/*`): SUPER_ADMIN + step-up(MFA)
   + audit; download enforces object-key validity + size cap; SQL dump streams
   (password via `MYSQL_PWD`, arg array, no shell); import verifies signature +
   restore-target guard + run-lock. Exemplary.
9. **Team create / update / delete** (`team`, `team/[id]`): create/delete
   SUPER_ADMIN; sensitive update (role/pw/isActive/perms) SUPER_ADMIN-only with
   step-up(MFA); last-SUPER_ADMIN protection; cannot self-demote/self-deactivate/
   self-delete; cannot edit equal/higher role; sessions revoked on change. Solid.
10. **Workspace transfer-ownership** (`workspaces/[id]/transfer-ownership`):
    ADMIN + `users:canUpdate` + step-up(MFA); active-member heir only; tx-wrapped;
    seat reconcile. Solid.
11. **Provider bulk / merge** (`providers/bulk`, `providers/merge`): ADMIN;
    bulk capped at 200 ids; delete is soft-delete + step-up(MFA); merge step-up(MFA).
    Solid.
12. **Acquisition-campaign create** (`acquisition-campaigns`): ADMIN +
    step-up(MFA) + Stripe price validation; redemption emails masked for non-ADMIN.
    Solid.
13. **Send notification (single user EMAIL/PUSH)** (`notifications` POST,
    non-broadcast): ADMIN, **NO step-up** — see **ADM-01**.

## 10. UI/UX Audit

- **ADM-UX-1 (Low)** — Many management list pages are `"use client"` and render
  their full chrome/controls before the data API resolves authz; an
  under-privileged admin may briefly see action buttons that will 403. Evidence:
  `app/(admin)/users/page.tsx:1`, `reports/page.tsx:1`, `state-rules/page.tsx:1`
  are `"use client"` with no server guard. Impact: confusing 403 toasts, not a
  data leak (APIs authoritative; nav is role-gated by the page-guard map fed to
  Sidebar/SubNav). Recommendation: gate display via the `permissions` map (already
  threaded into the layout) so disabled/hidden controls match server authz.
- **ADM-UX-2 (Info)** — Step-up modal (`password-confirm-modal.tsx`) is reused
  consistently across destructive actions; good. No issue beyond verifying every
  destructive client button wires `busy`-disabled state (covered by per-page
  tests for movers/sponsored). [needs verification for every page]

## 11. Logic Audit

- Expected flow (gate → step-up → validate → mutate → audit) is consistent.
- Broadcast notifications have explicit idempotency: a 30s dedupe window plus a
  `ProcessedWebhookEvent` claim row (`notifications/route.ts:97,264`), because
  `Notification` has no unique index and `skipDuplicates` is a no-op there. Good.
- Refund guards against invoice/amount drift between preview and confirm
  (`subscriptions/[id]/refund/route.ts:298`). Good.
- Hard-delete consumes the OTP **before** the cascade so a retry can't redeem it
  twice (`hard-delete/route.ts:180`). Good.
- **ADM-02 (Low / Logic)** — `state-rules` POST/PUT do not zod-validate body
  fields (length/shape); relies on Prisma column types. `stateCode` is stored
  unbounded/unnormalized (`state-rules/route.ts:50`). Low risk (ADMIN-gated,
  step-up) but inconsistent with the strict-schema pattern elsewhere.

## 12. Reverse Logic Audit

- **Unauthorized / direct route access**: middleware 401s API and redirects
  pages without a token; `requirePermission` fails closed on missing rows.
- **Token expiry / role change**: `requireRole` re-reads role from DB; sensitive
  team updates revoke all sessions; demoting SUPER_ADMIN revokes access despite
  JWT short-circuit (role read fresh).
- **Session hijack / stale data**: fingerprint mismatch invalidates session
  (middleware + `getSession`).
- **Double-click**: broadcast dedupe + client busy-disable; refund idempotency
  key; OTP single-use.
- **Empty data / API error / slow network**: routes return typed errors; backup
  download fails fast on missing offsite key.
- **MFA-required role without MFA**: middleware MFA-setup gate + `requireRole`
  throws FORBIDDEN (`auth.ts:358`).
- **Break-glass**: IP-rule self-lockout bypass for `/login` is logged as a
  security event (middleware:636). Good.

## 13. Security Audit

### ADM-01 (Medium) — Single-user EMAIL/PUSH notification send lacks step-up
- **Severity**: Medium
- **Affected Area**: `app/api/notifications/route.ts` POST (non-broadcast branch).
- **Evidence**: The broadcast branch requires step-up only for EMAIL/PUSH
  (`route.ts:231-239`). The single-user branch (`route.ts:384-414`) creates the
  notification and calls `dispatchEmailBatch` / `dispatchPushBatch` for a
  caller-supplied `userId` with **no `requirePasswordConfirm` call**. Gate is
  only `settings:canCreate` (ADMIN floor).
- **Risk**: An ADMIN session — or a session inside the wider step-up grace window
  used by other operations, or a temporarily-borrowed/unattended console — can
  send an arbitrary-content EMAIL (rendered via the user's address through Resend)
  or PUSH to a specific real user without re-proving identity. Because the title/
  body are operator-controlled and delivered from the platform's trusted sender,
  this is a targeted phishing / social-engineering primitive against a chosen
  victim. `href` is validated (same-origin only), which limits link abuse, but the
  message text is free-form.
- **Defensive Abuse Scenario (high-level)**: an attacker with a foothold on an
  ADMIN session targets one high-value end user with a convincing
  platform-branded email instructing an out-of-band action, leaving no step-up
  trail that a broadcast would have required.
- **Prevention**: require `requirePasswordConfirm` (parity with broadcast) for
  single-user EMAIL/PUSH; keep IN_APP-only sends step-up-free if desired.
- **Detection**: `SEND_NOTIFICATION` audit rows exist (`route.ts:416`) but with
  no step-up event; add alerting on single-target EMAIL/PUSH volume per admin.
- **Analysis (root cause)**: step-up was scoped to "irreversible fan-out =
  broadcast" and the single-target external-delivery case was overlooked.
- **Recommendation**: gate EMAIL/PUSH (broadcast AND single) behind step-up;
  document IN_APP as the only step-up-free channel.
- **Tests to add**: single-user EMAIL without confirm → 403; with confirm → 200.

### ADM-03 (Low) — PII-adjacent reads exposed at VIEWER without step-up
- **Severity**: Low
- **Affected Area**: `affiliate/export/route.ts` (VIEWER, no step-up),
  `movers/applications/[id]/documents/[documentId]/download/route.ts`
  (`providers:canRead`, VIEWER, no step-up).
- **Evidence**: `affiliate/export/route.ts:26` gates on `providers:canRead`
  minimumRole VIEWER and streams click/conversion rows (user-linked addressId,
  external txn id) with no step-up. Mover-doc download (`...download/route.ts:59`)
  serves applicant identity documents (PDF/images) at VIEWER.
- **Risk**: lowest-privilege role can pull PII-adjacent / identity-document data;
  bulk PII exports elsewhere (users) correctly require ADMIN + step-up, so this is
  an inconsistency.
- **Prevention/Recommendation**: raise the floor to ADMIN and/or add step-up for
  mover identity-document download and affiliate export, matching `users/export`.
  CSV is already injection-safe (`buildCsv`).
- **Detection**: both routes audit (`EXPORT_AFFILIATE`, `MOVER_DOCUMENT_DOWNLOAD`).
- **Tests to add**: VIEWER download/export authorization expectations once the
  floor is decided.

### ADM-04 (Low) — Client management pages have no server-side role guard
- **Severity**: Low
- **Affected Area**: `"use client"` pages: users, reports, state-rules, waitlist,
  tickets, support, provider-governance, analytics, settings/health, providers.
- **Evidence**: those `page.tsx` start with `"use client"` and contain no
  `requirePage*` call; only `(admin)/layout.tsx:17` `requirePageAdmin()` (auth,
  any active role) gates them. RSC pages (runtime-config, team, logs, security,
  backups, etc.) correctly use `requirePageRole/requirePagePermission`.
- **Risk**: an authenticated low-privilege admin can load the page shell; no
  privileged DATA is exposed because every data fetch enforces RBAC server-side
  and `page-guard.ts` documents the client permission map as display-only. This
  is a layout-fingerprinting / UX issue, not a data-exposure bug.
- **Prevention/Recommendation**: where a page is meaningfully role-restricted,
  prefer an RSC wrapper calling `requirePagePermission`, or hide controls via the
  threaded `permissions` map. Confirm no client page embeds privileged data in
  initial props. [needs verification that none do]
- **Detection**: N/A.
- **Tests to add**: route-level RBAC assertions already cover the APIs; add a
  smoke test that under-privileged roles get empty/403 data on these pages.

### Items explicitly checked and found SOUND (no finding)
- **Auth bypass / RBAC bypass**: fail-closed `checkPermission` (auth.ts:690),
  fresh-role re-read (auth.ts:351), SUPER_ADMIN short-circuit cannot be reached
  by a demoted user.
- **IDOR**: refund re-resolves invoice scoped to the subscription
  (refund:75); mover-doc scoped to applicationId + path-traversal guard
  (download:11); hard-delete OTP target-bound (otp:106).
- **XSS**: email templates sanitized at write (`sanitizeEmailHtml/Subject`);
  notification `href` sanitized (`sanitizeNotificationHref`); admin CSP is
  nonce-locked with `frame-ancestors 'none'` (middleware:194).
- **CSRF**: middleware Origin/Referer/Content-Type checks on mutations
  (middleware:354).
- **SSRF**: runtime-config URL keys + connector URLs validated against allowed
  hosts / private-IP guard (`runtime-config` invalid reasons; connector
  `isAllowedConnectorUrl`).
- **Injection (CSV)**: `lib/csv-safety.ts` neutralizes `= + - @ \t \r`; all five
  export routes use `buildCsv`.
- **Injection (SQL dump)**: `spawn` arg array, identifier quoting, value
  escaping; password via `MYSQL_PWD` not argv.
- **Sensitive-data leak**: runtime-config never echoes values; logs viewer
  redacts PII for non-SUPER_ADMIN and masks Stripe ids (logs:70); audit metadata
  secret-free; spending analytics k-anonymity floor of 5.
- **Missing rate limit**: middleware per-group limits incl. strict bucket for
  backup/runtime-config/key-rotation/notifications/subscription-actions.
- **PII/secret logging**: errors redacted (`redactBackupSecretText`,
  `sanitizeLimiterReason`).

## 14. Performance Audit

- Logs facet aggregations are bounded to a 30-day window and only computed on
  page-1/no-filter (`logs/route.ts:116-199`) — addresses a prior full-table scan.
- Notification broadcast streams users in 5k batches with a 100k synchronous cap
  (`notifications/route.ts:38,245`).
- Connector detail bounds dispatch rows to 25 and uses `groupBy`
  (`connectors/[connectorKey]/route.ts:20`).
- **ADM-PERF-1 (Low)** — `notifications` GET issues ~8 sequential counts/queries
  per load (`route.ts:132-152`); fine at current scale, candidate for a single
  aggregate if the feed table grows. [needs verification of table size]
- Exports capped (users 50k, affiliate 5k) to bound memory.

## 15. Reliability Audit

- Transaction consistency: team update, workspace transfer, hard-delete cascade,
  backup import are tx-wrapped; refund/Stripe use idempotency keys.
- Partial failure: hard-delete blocks on Stripe-cancel failure and alerts;
  SQL dump tears down gzip if mysqldump dies mid-stream (no silent truncation).
- Rate-limiter fails **closed** in production-like runtimes when Redis is down
  (middleware:560); step-up limiter surfaces "temporarily unavailable".
- Monitoring: `dispatchAlert`, `trackSensitiveOp`, security-event emission.
- **ADM-REL-1 (Info)** — middleware in-memory rate-limit + step-up store fall
  back to per-instance memory when Redis is unconfigured; multi-instance deploys
  without Redis would under-enforce. Code already warns once
  (`warnAdminRateLimitMemoryFallbackOnce`). Ensure Redis is provisioned in prod.

## 16. Dead Code / Cleanup

- No clearly dead routes confirmed; every route in the inventory has a colocated
  page or test. `support/` and `tickets/` pages coexist (support → tickets
  resource) — likely intentional alias, not dead. [needs verification]
- `PUBLIC_PREFIX_PATHS` in middleware is an empty array (middleware:33) — vestigial
  but harmless. [needs verification]

## 17. Tests

- Strong colocated coverage: `auth`, `admin-permissions(-seed-parity)`,
  `page-guard`, `audit`, `csv-safety`, `runtime-config`, `feature-flags`,
  `backup-*`, `hard-delete-user`, `admin-action-otp`, `middleware`, and route
  tests for team/users/subscriptions/connectors/backup/logs/etc.
- **Gaps to add**: (a) single-user EMAIL/PUSH step-up (ADM-01); (b) VIEWER
  authorization for affiliate export & mover-doc download (ADM-03); (c) client
  page under-privileged smoke tests (ADM-04); (d) state-rules body validation
  (ADM-02).

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| admin-management-01 | Medium | Security | Single-user EMAIL/PUSH notification send has no step-up (broadcast EMAIL/PUSH does) | ADMIN/grace-window session can send platform-branded phishing email/push to a chosen user with no re-auth trail | Require `requirePasswordConfirm` for all EMAIL/PUSH sends; keep IN_APP free | `app/api/notifications/route.ts:384-414` |
| admin-management-02 | Low | Data | `state-rules` POST/PUT lack zod body validation; `stateCode` unbounded | Inconsistent input hardening; possible malformed/oversized rule text | Add a strict zod schema like sibling routes | `app/api/state-rules/route.ts:41-61` |
| admin-management-03 | Low | Security | PII-adjacent affiliate export & mover identity-document download readable at VIEWER without step-up | Lowest-privilege role can pull PII-adjacent data / identity docs; inconsistent with `users/export` | Raise floor to ADMIN and/or add step-up | `app/api/affiliate/export/route.ts:26`, `app/api/movers/applications/[id]/documents/[documentId]/download/route.ts:59` |
| admin-management-04 | Low | Architecture | Several client management pages lack a server-side role guard (auth-only layout gate) | Page shell renders for under-privileged admins; no privileged data leaks (APIs authoritative) | Use RSC `requirePagePermission` wrappers or hide controls via permission map | `app/(admin)/users/page.tsx`, `reports/page.tsx`, `state-rules/page.tsx`, others |
| admin-management-05 | Low | UI/UX | Action controls on client pages may show before API authz resolves | Confusing 403 toasts | Drive disabled/hidden state from threaded `permissions` map | `app/(admin)/*/page.tsx` (client) |
| admin-management-06 | Low | Performance | `notifications` GET runs ~8 sequential count queries per load | Minor latency at scale | Consolidate into one aggregate if feed grows | `app/api/notifications/route.ts:132-152` |
| admin-management-07 | Info | Reliability | Rate-limit/step-up stores fall back to per-instance memory without Redis | Multi-instance under-enforcement if Redis absent | Ensure Redis provisioned in prod (warned in code) | `apps/admin/src/middleware.ts:495`, `lib/auth-step-up-store.ts` |

## 19. Module TODO

- [ ] **admin-management-01 (Medium)** — Require step-up for single-user
  EMAIL/PUSH notifications.
  - Reason: targeted phishing primitive without re-auth.
  - Related: `app/api/notifications/route.ts`.
  - Suggested fix: call `requirePasswordConfirm({operation:"notification_send"})`
    when `channel === "EMAIL" || "PUSH"` in the non-broadcast branch.
  - Dependencies: none. Complexity: low. Risk of change: low.
- [ ] **admin-management-03 (Low)** — Tighten authz on affiliate export and
  mover identity-document download (ADMIN floor and/or step-up).
  - Related: `affiliate/export/route.ts`,
    `movers/applications/[id]/documents/[documentId]/download/route.ts`.
  - Dependencies: confirm operator role expectations. Complexity: low.
    Risk of change: low-med (may affect support workflows).
- [ ] **admin-management-04/05 (Low)** — Add RSC role guards / permission-driven
  control gating to client management pages.
  - Related: client `app/(admin)/*/page.tsx`.
  - Dependencies: none. Complexity: med. Risk of change: low.
- [ ] **admin-management-02 (Low)** — Add strict zod validation to `state-rules`
  POST/PUT; normalize/bound `stateCode`.
  - Complexity: low. Risk of change: low.
- [ ] **admin-management-06 (Low)** — Consolidate `notifications` GET counts if
  feed table grows. Complexity: low. Risk: low.
- [ ] **admin-management-07 (Info)** — Verify Redis provisioning for the admin
  rate-limit + step-up stores in every production-like environment.
