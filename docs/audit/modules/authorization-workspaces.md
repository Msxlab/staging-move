# Module Audit: Authorization & Workspaces (multi-tenant + RBAC)

> Read-only audit. Evidence = source only. Paths are relative to repo root
> `staging-move/`. Line numbers are practical anchors at time of read.

## 1. Module Summary

LocateFlow is multi-tenant via **Workspaces**. Each `Workspace` has an
`ownerUserId` (the billing/entitlement anchor) and a set of `WorkspaceMember`
rows (role + status). Authorization is a two-layer model:

1. **Tenant data-scoping** — `resolveWorkspaceDataScope(request, userId)`
   (`apps/web/src/lib/workspace-data-scope.ts`) resolves the active workspace
   for a request and returns a `WorkspaceDataScope`. Scoped routes build their
   Prisma `where` from `scopedRecordWhere(scope, …)` and gate record-level
   actions with `assertScopedRecordAction` / `assertWorkspaceAction`.
2. **Role policy** — a pure permission matrix `can(role, action, ctx)`
   (`packages/shared/src/permissions.ts`) is the single source of truth used by
   API gates, UI affordances, and tests.

The entire workspace model is gated behind a runtime flag
`WORKSPACE_MODEL_ENABLED` (`workspace-context.ts:96`). When OFF (the documented
default), `resolveWorkspaceDataScope` returns `legacyDataScope(userId)` and every
scoped query falls back to per-`userId` isolation (the legacy single-tenant
path). When ON, scoping switches to `workspaceId`.

Workspace-management routes (`/api/workspaces/**`, `/api/invitations/**`) are
separately gated by `workspaceFeatureGate()` (returns 404 `WORKSPACE_DISABLED`
when off) and authenticate with `getUserSession()` + a per-workspace
`workspaceMember.findFirst` membership lookup before applying `can()`.

**Overall assessment:** The model is unusually well-built for an audit of this
size. IDOR surfaces are consistently closed (every scoped `[id]` route fetches
then calls `assertScopedRecordAction`; foreign-scope ids return 404, never 403).
Invitation tokens are sha256-hashed at rest with email-match authorization and a
serializable seat re-check. No route trusts a client-supplied `workspaceId` from
the body/query. Findings are mostly Medium/Low: a couple of consistency and
fail-open concerns plus test-coverage and dead-code observations. No Critical
issue was proven from code.

## 2. Related Files

Core scoping / context:
- `apps/web/src/lib/workspace-context.ts` — resolver, `requireWorkspaceContext`, flag.
- `apps/web/src/lib/workspace-data-scope.ts` — `resolveWorkspaceDataScope`, `scopedRecordWhere`, `assertScopedRecordAction`, `assertWorkspaceAction`, `recordBelongsToScope`.
- `apps/web/src/lib/workspace-ownership.ts` — transfer, heir selection, seat reconcile.
- `apps/web/src/lib/workspace-routes.ts` — `workspaceFeatureGate`, plan labels, `maskEmail`.
- `apps/web/src/lib/workspace-step-up.ts` — step-up auth for destructive ops.
- `apps/web/src/lib/workspace-provisioning.ts` — `ensureWorkspaceDefaults`.
- `apps/web/src/lib/workspace-invitations.ts` — token gen/hash, `countUsedSeats`.
- `apps/web/src/lib/workspace-invite-accept.ts` — shared accept core.
- `apps/web/src/lib/workspace-audit.ts` — user-actor audit + owner notifications.
- `apps/web/src/lib/api-gates.ts` — `ApiGateError`, gate→HTTP mapping.
- `apps/web/src/lib/plan-limits.ts` — per-owner address/service/provider caps.
- `apps/web/src/lib/request-entitlements.ts` — plan-feature gating per request.
- `apps/web/src/lib/consumer-entitlement.ts` — CONSUMER_FREE override.
- `apps/web/src/lib/service-visibility.ts` — `service.viewSensitive` field redaction.
- `apps/web/src/lib/service-active.ts` — `activeTrackedServiceWhereForScope`.
- `packages/shared/src/permissions.ts` — `can()` matrix, `resolveManagedSyncEnabled`.
- `packages/shared/src/workspace-entitlements.ts` — seat ceilings, plan-feature matrix.
- `packages/shared/src/entitlement.ts` — `getEffectiveEntitlement` (read indirectly).

Tests:
- `apps/web/src/lib/workspace-context-resolver.test.ts`.

## 3. Related Routes / Screens

Workspace management API (gated by `workspaceFeatureGate`):
- `GET/POST /api/workspaces` (list/create)
- `GET/PATCH /api/workspaces/[id]` (detail/rename)
- `POST /api/workspaces/[id]/delete`, `POST /api/workspaces/[id]/restore`
- `POST /api/workspaces/[id]/transfer`
- `GET /api/workspaces/[id]/members`, `POST /api/workspaces/[id]/members/leave`
- `PATCH/DELETE /api/workspaces/[id]/members/[memberId]`
- `GET/POST /api/workspaces/[id]/invitations`, `DELETE …/invitations/[invId]`
- `GET/PUT /api/workspaces/[id]/managed-sync`, `POST /api/workspaces/[id]/sync`

Invitation acceptance API:
- `GET /api/invitations/[token]`, `POST /api/invitations/[token]/accept`
- `GET /api/invitations/pending`, `POST/…/[id]/accept`, `…/[id]/decline`

Scoped data routes that consume `resolveWorkspaceDataScope` (tenant surface):
- `/api/addresses`, `/api/addresses/[id]`, `/api/addresses/[id]/dossier(/pdf)`
- `/api/services`, `/api/services/[id]`
- `/api/moving`, `/api/moving/[id]`, `/api/move-tasks`
- `/api/budget`, `/api/budget/actuals`
- `/api/connector-dispatch`, `/api/partner-consents/oauth/initiate|callback`
- `/api/onboarding/briefing`, `/api/providers/recommendations`, `/api/profile`

Screens (server components also resolve context): `(app)/addresses`,
`(app)/services`, `(app)/moving`, `(app)/providers`, `/settings/workspace`
(member management UI — referenced by every notification `href`).

## 4. Related APIs

See §3. Internal call graph: scoped route → `resolveWorkspaceDataScope` →
(flag on) `requireWorkspaceContext` → `prisma.workspaceMember.findFirst` +
`resolveConsumerEntitlement(ownerSub)`. Management routes call
`getUserSession()` directly and re-resolve membership per request.

## 5. Related Components

This module is API/lib-centric. UI affordances consume `can()` indirectly via
the `role`/`status` fields returned by `/api/workspaces` and
`/api/workspaces/[id]/members`. The member-management UI lives under
`/settings/workspace` (every membership notification deep-links there). No
component files were in audit scope; UI/UX findings below are inferred from API
contracts, not component code, and are flagged accordingly.

## 6. Related State / Hooks / Stores

- `lf_workspace_id` cookie (1-year, `sameSite=lax`, **not** httpOnly) — the
  selected-workspace pointer set by create/accept routes and self-healed by the
  resolver. Mirrored by the `X-Workspace-Id` request header for mobile.
- Server-side step-up state via `verifyUserStepUp` (password / TOTP / backup).
- In-process `dossierCache` Map in `addresses/[id]/dossier/route.ts` keyed by
  `userId:scopeKey:addressId:version` (scope-keyed, no cross-tenant bleed).

## 7. Related Database / Models

From `_inventory/prisma-models.txt`:
- `Workspace` (2176), `WorkspaceMember` (2206), `WorkspaceInvitation` (2244),
  `WorkspaceAuthChallenge` (2276).
- Scoped domain models carrying `workspaceId`: `Address` (434), `Service` (488),
  `MovingPlan` (605), `Budget` (649), `MoveTask` (939).
- `Subscription` (232) — owner entitlement anchor.
- `PartnerConsent` (2000) — **user-scoped, not workspace-scoped** (personal).
- `AuditLog` (1123) — user-actor audit sink (`action` is `VarChar(20)`).

Note: `WorkspaceMember.status` and `.role` are free-form `VarChar` (the resolver
fails closed on unknown status — `workspace-context.ts:191`).

## 8. Impact Map

- **UI:** role/status drive affordances; `staleWorkspaceCookie` self-heal keeps a
  removed member from being locked out of the whole app.
- **API:** all scoped routes; all `/api/workspaces/**`.
- **DB:** every `workspaceId`-bearing table; `WorkspaceMember` is the authority.
- **Auth:** sits on top of custom JWT (`getUserSession`/`requireVerifiedUser`).
  Destructive workspace ops require step-up (`workspace-step-up.ts`).
- **Admin:** the resolver comment references an admin-only `?workspace=` override
  "handled separately" — no implementation found in scope (see W-09).
- **Mobile:** `X-Workspace-Id` header path; stale header → 409 (no silent
  fallback), unlike the cookie path.
- **Notifications:** roster changes notify target + owner (`workspace-audit.ts`,
  `in-app-notifications`), plus emails (`email-service`).
- **Integrations:** managed-sync pushes a member's address change to *their own*
  partner consents (`workspace/[id]/sync`, `connector-runtime`).
- **Analytics:** `UserEvent`/`AuditLog` capture membership mutations.
- **SEO:** N/A.
- **Tests:** only `workspace-context-resolver.test.ts` directly covers this lib
  (route tests exist for some scoped routes).

## 9. Buttons / Actions / Functions

For each user-facing action (route handler):

- **List workspaces** (`GET /api/workspaces`): membership-filtered; redundant
  empty personal-solo hidden (data-safe). Perm: session only. Edge: hides only
  when ≥1 other multi-seat ACTIVE workspace AND personal-solo has zero scoped
  rows. OK.
- **Create workspace** (`POST /api/workspaces`): requires FAMILY/PRO
  (consumer-free override); caps owner at `MAX_OWNED_WORKSPACES = 3`
  (`workspaces/route.ts:127`) to stop seat-multiplication. Stamps owner's
  personal rows into the new ws in a tx. Success sets `lf_workspace_id`. OK.
- **Rename** (`PATCH /api/workspaces/[id]`): OWNER-only via
  `can("workspace.rename")`; 1–60 char validation. OK.
- **Delete** (`POST …/delete`): OWNER-only + type-`DELETE` + step-up; 7-day
  soft-delete grace. OK.
- **Restore** (`POST …/restore`): OWNER-only + step-up; conditional `updateMany`
  on `deletionGraceUntil > now`. OK.
- **Transfer ownership** (`POST …/transfer`): OWNER-only + step-up; transactional
  demote/promote + `reconcileWorkspaceSeats`. OK. (See W-06 self-transfer.)
- **Members list** (`GET …/members`): any member; emails masked for non-managers
  (`maskEmail`). OK.
- **Change role / status** (`PATCH …/members/[memberId]`): `member.changeRole` /
  `member.remove`; ADMIN cannot touch OWNER/ADMIN; self blocked; promote-to-ADMIN
  is OWNER-only. OK.
- **Remove member** (`DELETE …/members/[memberId]`): `member.remove`; self
  blocked (use leave); reconciles seats. OK.
- **Leave** (`POST …/members/leave`): `member.leave` (OWNER/CHILD blocked). OK.
- **Invite** (`POST …/invitations`): `member.invite` (OWNER/ADMIN); ADMIN role
  invite is OWNER-only; rate-limited 5/h; seat + duplicate + already-member
  checks in serializable tx; COPPA guardian-consent gate for CHILD. OK.
- **Revoke invite** (`DELETE …/invitations/[invId]`): `member.invite`; 403 before
  existence lookup to prevent probing. OK.
- **Accept invite (token)** (`POST /api/invitations/[token]/accept`): session
  email must match `invitedEmail`; sha256 token lookup; shared accept core. OK.
- **Accept invite (in-app id)** (`POST /api/invitations/pending/[id]/accept`):
  email-match is the authz boundary; 404 (not 403) for someone else's invite. OK.
- **Managed-sync consent** (`GET/PUT …/managed-sync`): each member edits only
  their own row; `statusAllowsMutation` blocks SUSPENDED/OVERFLOW writes. OK.
- **Sync address** (`POST …/sync`): self → `addressChange.initiate`; on-behalf →
  `addressChange.manageForMembers` + target consent + target ACTIVE; address must
  belong to subject and be in this workspace. OK.

Loading/disabled/error/success states are UI concerns not in scope; flagged
[needs verification] in §10.

## 10. UI/UX Audit

All UI/UX items are **[needs verification]** — no component code was in scope.

- **UX-01 (Low) [needs verification]:** Stale-cookie self-heal is best-effort and
  silently swallowed during server-component render
  (`workspace-context.ts:45-52`). A page render after removal may show the wrong
  workspace until the next API call rewrites the cookie. Evidence:
  `overwriteStaleWorkspaceCookie` catch-all. Impact: brief stale view. Rec:
  confirm the client refetches `/api/workspaces` on mount. Priority: Low.
- **UX-02 (Low) [needs verification]:** `WORKSPACE_DISABLED` vs transient failure
  is distinguished by a stable code (`workspace-routes.ts:18`), and `GET
  /api/workspaces` returns an empty list when off — good. Verify the settings UI
  renders a real "coming soon" only on the code, not on any 404.

## 11. Logic Audit

- Expected flow (flag on): authenticate → resolve requested ws (header > cookie >
  DB default) → membership check → status allow-list → load workspace → owner
  entitlement → return scope. Correct and ordered (`workspace-context.ts:149-225`).
- **Fail-closed status** (`:191`): only `ACTIVE`/`OVERFLOW` proceed; unknown
  free-form status denied. Good.
- **Header vs cookie stale handling asymmetry** (`:164-182`): a stale *header*
  throws 409; a stale *cookie* silently falls back to oldest workspace. This is
  intentional (mobile vs browser) and does not create cross-tenant access (the
  fallback target is always one the user is a member of). See W-02 for the
  fail-open-on-config nuance.
- **Seat re-check race:** invite-accept re-counts members+pending inside a
  `Serializable` tx and maps `P2034`→RETRY / `P2002`→ALREADY_MEMBER
  (`workspace-invite-accept.ts:86-154`). Concurrency-correct.
- **`countUsedSeats` vs accept counting:** both exclude expired PENDING and (in
  accept) the invite being accepted (`workspace-invitations.ts:41-50`,
  `workspace-invite-accept.ts:97-111`). Consistent. Minor: `countUsedSeats`
  members filter is `status != SUSPENDED` (counts OVERFLOW), matching the invite
  POST count — internally consistent.
- **Cache risk:** dossier in-process cache is scope-keyed; no cross-tenant bleed
  (`addresses/[id]/dossier/route.ts:509`).

## 12. Reverse Logic Audit

- **Unauthorized / non-member:** scoped routes → `assertScopedRecordAction`
  returns 404 for foreign-scope ids; management routes → 404 for non-members.
  Header-requested foreign workspace → 409 STALE (no access granted). No IDOR
  proven.
- **Empty data:** list routes return empty arrays; `/api/workspaces` returns
  `[]` when feature off.
- **API error / fail-open:** `safeWorkspaceModelEnabled()` catches and returns
  `false` (`workspace-data-scope.ts:35-41`) → on a runtime-config read error the
  app silently reverts to **legacy per-user scoping**. In flag-ON production this
  is a fail-open to the *narrower* (per-user) scope, which is safe for isolation
  but can hide shared workspace data / mis-enforce pooled limits transiently.
  See W-02.
- **Double-click:** invite/accept/transfer are idempotent or serializable.
- **Stale data / role change / token expiry:** resolver re-reads membership every
  request, so a demoted/removed member loses access on the next call; no
  long-lived authz cache. Invitation expiry checked on every accept.
- **Direct route access:** `[id]` routes never rely on the client knowing only
  their own ids — every fetch is followed by a scope assertion.
- **Mobile viewport / dark theme:** N/A (no component code in scope).

## 13. Security Audit

### W-01 (Low) — `lf_workspace_id` selection cookie is not httpOnly
- **Severity:** Low
- **Affected Area:** `workspace-context.ts:29-33` (`WORKSPACE_COOKIE_OPTIONS`);
  set without `httpOnly` here and in `workspaces/route.ts:160`,
  `invitations/[token]/accept/route.ts:51`, `invitations/pending/[id]/accept`.
- **Evidence:** cookie options omit `httpOnly`/`secure`; `path:"/", sameSite:lax,
  maxAge 1y`.
- **Risk:** The selection pointer is readable/writable by client JS. It is only a
  *selector*, not an authorization token — membership is re-validated server-side
  every request — so tampering cannot grant cross-tenant access (a non-member id
  in the cookie falls back to the user's own oldest workspace). The residual risk
  is reduced defense-in-depth and the value being exfiltratable via XSS elsewhere.
- **Defensive Abuse Scenario (high-level):** An attacker with an XSS foothold
  could read or flip a victim's selected-workspace pointer to nudge which of the
  victim's *own* workspaces is active; they cannot reach a workspace the victim
  is not a member of.
- **Prevention:** Mark `httpOnly` + `secure` (it's read server-side via the raw
  `cookie` header, not via JS) unless a client component genuinely needs to read
  it; if so, keep `secure`.
- **Detection:** Cookie-attribute lint / security header scan.
- **Analysis (root cause):** Cookie written from multiple routes with a shared
  options object that predates the httpOnly decision.
- **Recommendation:** Centralize cookie options; add `httpOnly`/`secure`.
- **Tests To Add:** Assert `Set-Cookie` flags on create/accept responses.

### W-02 (Medium) — Runtime-config read failure silently disables tenant scoping (fail-open to legacy)
- **Severity:** Medium
- **Affected Area:** `workspace-data-scope.ts:35-44` (`safeWorkspaceModelEnabled`
  → catch → `false` → `legacyDataScope`); `plan-limits.ts:202`
  (`isWorkspaceModelEnabled().catch(() => false)`).
- **Evidence:** `try { return await isWorkspaceModelEnabled(); } catch { return
  false; }`.
- **Risk:** With the flag ON in production, a transient failure reading
  `RuntimeConfigEntry` (or DB hiccup) makes a request resolve to **per-user**
  legacy scope instead of **workspace** scope. For isolation this fails to the
  *narrower* set (safe — no cross-tenant exposure). But pooled-limit enforcement
  and shared-data visibility flip inconsistently for the duration: a member may
  transiently see only their own backfilled rows, and per-owner caps may be
  computed against the wrong subject. It also means the security-relevant mode is
  governed by an availability-sensitive read with no alarm.
- **Defensive Abuse Scenario (high-level):** An actor able to induce config-read
  errors (e.g. DB pressure) could degrade enforcement of pooled plan limits,
  potentially exceeding intended seat/record economics during the window — not a
  data-leak, an economics/consistency abuse.
- **Prevention:** Cache the resolved flag with a short TTL and treat a read error
  as "retain last known value" rather than "assume off"; emit a metric/alert when
  the fallback fires.
- **Detection:** Log + counter on the catch branch; alert if non-zero in prod.
- **Analysis (root cause):** The flag is read on the hot path with a swallow-to-
  false default chosen for the "feature still launching" case, which is wrong
  once the feature is live.
- **Recommendation:** Add observability + last-known-value caching; do not silently
  collapse scope on error post-launch.
- **Tests To Add:** Simulate `isWorkspaceModelEnabled` throwing and assert the
  chosen fallback behavior + that an alert hook fires.

### W-03 (Low) — Dev invite URL leaks plaintext token in non-prod responses
- **Severity:** Low
- **Affected Area:** `workspaces/[id]/invitations/route.ts:193` (`devInviteUrl`
  returned when `NODE_ENV !== "production"` and email send failed).
- **Evidence:** `...(process.env.NODE_ENV !== "production" && !emailSent ? {
  devInviteUrl: inviteUrl } : {})`.
- **Risk:** The raw `wsi_…` token is returned to the inviter in non-prod. The
  token only stored as a hash is the security property; returning the plaintext
  to the *authorized inviter* in dev is acceptable, but any staging environment
  with real users + `NODE_ENV` mis-set would expose acceptance links in API
  responses/logs.
- **Defensive Abuse Scenario (high-level):** A staging build accidentally not set
  to `production` would surface working invite links in responses; anyone reading
  that response could accept (still gated by email-match on accept).
- **Prevention:** Gate on an explicit dev flag, not `NODE_ENV`, and never log the
  token.
- **Detection:** Grep responses for `wsi_` in non-dev; assert absent in prod tests.
- **Analysis (root cause):** Dev ergonomics shortcut keyed on `NODE_ENV`.
- **Recommendation:** Use a dedicated `ALLOW_DEV_INVITE_LINK` flag default-off.
- **Tests To Add:** Assert `devInviteUrl` absent when `NODE_ENV=production`.

### W-04 (Low) — `member.changeRole` / status PATCH does not require step-up; transfer/delete do
- **Severity:** Low
- **Affected Area:** `workspaces/[id]/members/[memberId]/route.ts` (PATCH/DELETE —
  no `requireWorkspaceStepUp`).
- **Evidence:** transfer/delete/restore call `requireWorkspaceStepUp`; member
  role/status/removal do not.
- **Risk:** A hijacked OWNER/ADMIN session can demote/suspend/remove members or
  promote a confederate to ADMIN without re-auth. Lower blast radius than
  delete/transfer (those rightly require step-up) but still a privileged roster
  mutation.
- **Defensive Abuse Scenario (high-level):** Session-riding attacker promotes a
  controlled account to ADMIN to widen access without triggering the step-up
  prompt that guards delete/transfer.
- **Prevention:** Require step-up for promote-to-ADMIN (and optionally removal).
- **Detection:** Audit rows exist (`WS_MEMBER_ROLE`, `WS_MEMBER_REMOVED`) — alert
  on ADMIN grants.
- **Analysis (root cause):** Step-up was scoped to the three "sensitive"
  operations enumerated in `workspace-step-up.ts`; privilege escalation via role
  change was not included.
- **Recommendation:** Add `member_promote_admin` to the step-up operation set.
- **Tests To Add:** Assert promote-to-ADMIN without step-up is rejected once added.

### W-05 (Info) — IDOR surface is consistently closed (positive finding)
- **Severity:** Info
- **Evidence:** Every scoped `[id]` route (`addresses/[id]`, `services/[id]`,
  `moving/[id]`, `addresses/[id]/dossier`) does `findUnique` then
  `assertScopedRecordAction(record, scope, action, { notFoundMessage })`, which
  returns 404 for foreign scope before any role check
  (`workspace-data-scope.ts:120-133`). Management routes resolve membership per
  request and return 404 for non-members. `enqueueAddressChange` re-scopes the
  address to `userId`+`workspaceId` (`connector-runtime.ts:205-216`). No route
  trusts a `workspaceId` from body/query (grep: only a test sets it).
- **Risk:** None observed. Documented so a future refactor preserves the pattern.

### W-06 (Info) — Defensive checks confirmed
- `transferWorkspaceOwnership` rejects self-transfer and re-validates owner inside
  the tx (`workspace-ownership.ts:41-44`).
- Invitation tokens: `wsi_` + 32 random bytes, only sha256 hash stored
  (`workspace-invitations.ts:15-22`); accept requires verified email match.
- CHILD self-only reads enforced both in `can("address.view", {isSelf})` and via
  `childSelfOnly` in `scopedRecordWhere` + the `{userId}` service filter.
- `service.viewSensitive` redaction nulls credential fields for non-owners
  lacking the permission (`service-visibility.ts:74-84`); over-redacts MEMBER
  (safe direction).
- Step-up MFA attempts are rate-limited (`workspace-step-up.ts:42-69`).

### W-07 (Low) — Sole protection against cross-tenant reads is correct-scope discipline, not a DB constraint
- **Severity:** Low (architecture/defense-in-depth)
- **Affected Area:** all scoped Prisma queries.
- **Evidence:** Isolation depends on every query author calling
  `scopedRecordWhere`/`assertScopedRecordAction`. There is no Prisma middleware or
  row-level-security backstop; a future route that does a bare
  `prisma.address.findUnique({where:{id}})` and forgets the assertion would IDOR.
- **Risk:** One forgotten assertion = tenant leak. The current routes are clean,
  but the pattern is manual.
- **Recommendation:** Consider a Prisma `$extends`/middleware that requires an
  explicit scope token on `Address/Service/MovingPlan/Budget/MoveTask` reads, or a
  lint rule. Detection: code-review checklist + the existing route tests.

### W-08 (Info) — Partner consents are user-scoped by design (verify intent)
- **Severity:** Info [needs verification]
- **Evidence:** `partner-consents/route.ts` and `[id]/route.ts` scope purely by
  `userId` (no workspace). `permissions.ts` header documents "each member connects
  their own partners." `enqueueAddressChange` pulls consents by `input.userId`
  only.
- **Risk:** Correct per the documented model. Flagged only so reviewers confirm a
  manager pushing on-behalf-of a member (`…/sync` on-behalf path) is intended to
  use the *target's* consents (it is — `subjectUserId` drives the enqueue) and
  that the manager never sees the target's tokens (confirmed: tokens are
  server-held, never returned).

### W-09 (Low) — Resolver references an admin `?workspace=` override with no implementation in scope
- **Severity:** Low (dead comment / latent feature) [needs verification]
- **Affected Area:** `workspace-context.ts:115-118` comment: "The `?workspace=`
  query override is admin-only and handled separately."
- **Evidence:** No code in the audited surface reads a `?workspace=` query param
  for impersonation/override; grep for `searchParams.get('workspace'` / `workspace=`
  in the API found nothing.
- **Risk:** Either harmless stale documentation, or an out-of-scope admin path
  that bypasses membership — which would be a higher-severity concern if it
  exists. Confirm whether an admin impersonation route consumes such an override
  and that it is properly admin-gated.
- **Recommendation:** Remove the comment or point it at the real handler; if a
  handler exists, audit it for admin-only enforcement.
- **Tests To Add:** Negative test that a non-admin `?workspace=` is ignored.

(No XSS/SSRF/injection found in this module: inputs are ids validated by
`/^[A-Za-z0-9_-]{1,30}$/` or zod; emails regex-validated; no HTML rendering;
external calls in dossier are keyed off server-resolved coordinates only.)

## 14. Performance Audit

- **N+1 in `GET /api/workspaces`:** per-membership `planSummaryForOwner` (a
  `subscription.findUnique`) + a `workspaceMember.count`, then for personal-solo
  candidates four more `count`s each (`workspaces/route.ts:37-96`). For a user in
  many workspaces this is several sequential queries per workspace. Severity Low
  (workspace count per user is small, capped at 3 owned + invited).
- **Repeated owner-subscription reads:** `requireWorkspaceContext`,
  `getUserPlan`, and several routes each independently load the owner
  `Subscription`. A per-request memo would cut duplicate reads. Low.
- Dossier route has good caching (durable area cache + in-process). Move-tasks
  capped at `take: 200`. Addresses/services paginated. No obvious hot-path issue.

## 15. Reliability Audit

- **Best-effort everywhere appropriate:** notifications, audit writes, seat
  reconcile, cookie self-heal all `.catch(() => {})` so they never fail the
  mutation. Good.
- **Transactions:** create-workspace, invite, accept, transfer, address
  primary-demote, soft-delete cascades all use `$transaction` (serializable where
  concurrency matters). Good.
- **Partial failure:** seat reconcile after transfer/leave/remove is best-effort
  — a failed reconcile leaves an OVERFLOW member read-only until the next
  reconcile trigger; acceptable but unmonitored (no alert).
- **Provisioning fail-open:** `ensureWorkspaceDefaults` swallows all errors so
  auth never breaks (`workspace-provisioning.ts:40-43`); a user who slips through
  has no membership and would hit `NO_WORKSPACE_ACCESS` (403) on scoped routes
  until the backfill re-runs. Reliability gap, see §17.
- **Monitoring/logging:** membership mutations are audited; the W-02 fallback and
  reconcile failures are not surfaced.

## 16. Dead Code / Cleanup

- **`workspace-context.ts` header says "(tested, unused)"** — this is stale: the
  resolver IS now consumed by `resolveWorkspaceDataScope`, which 30+ routes call.
  The "Sprint-1 deliverable, route retrofit comes later" comment is outdated.
  Recommend updating the header. [confirmed via grep — 31 files reference the
  data-scope/context helpers].
- **W-09 admin `?workspace=` comment** — references code not present in scope;
  dead comment or pointer to an out-of-scope feature. [needs verification].
- No unused exported functions proven; `legacyDataScope`, `recordBelongsToScope`,
  `assertWorkspaceAction`, `scopedRecordWhere` are all referenced.

## 17. Tests

Existing:
- `workspace-context-resolver.test.ts` — covers the stale-header 409 and the
  stale-cookie fallback only.
- Route-level tests referenced in grep: `move-tasks`, `connector-dispatch`,
  `partner-consents/oauth/*`, `onboarding/briefing`, `addresses/[id]/dossier/pdf`.

Missing / suggested (high-value):
- **IDOR matrix** (unit/integration): for each scoped `[id]` route, a member of
  workspace A requesting a record in workspace B → 404. Currently relied upon by
  inspection only.
- **Role matrix** for `can()` — exhaustive table test per action × role × status
  (the matrix is the single source of truth; it deserves a golden test).
- **Seat concurrency**: two parallel accepts for the last seat → exactly one
  succeeds, loser gets RETRY/SEAT_FULL.
- **Step-up** on transfer/delete/restore (and W-04 promote-to-ADMIN once added).
- **Fail-open W-02**: config-read error path behavior.
- **CHILD self-only**: CHILD cannot read another member's address/service even in
  the same workspace.
- **`service.viewSensitive` redaction**: MEMBER/VIEW_ONLY/CHILD see nulled
  credentials for others' services; owner/self see full.
- **`ensureWorkspaceDefaults` idempotency** + recovery for users created while
  the flag was off then on.

## 18. Findings Summary

| ID | Severity | Category | Finding | Impact | Recommendation | Files |
|----|----------|----------|---------|--------|----------------|-------|
| authorization-workspaces-01 | Medium | Reliability | Runtime-config read error fails open to legacy per-user scope with no alert | Transient mis-enforcement of pooled limits / shared-data visibility while flag is ON | Cache last-known flag value; alert on fallback | `workspace-data-scope.ts:35-44`, `plan-limits.ts:202` |
| authorization-workspaces-02 | Low | Security | `member.changeRole`/promote-to-ADMIN lacks step-up (delete/transfer have it) | Hijacked OWNER/ADMIN session can escalate a confederate without re-auth | Add `member_promote_admin` to step-up set | `workspaces/[id]/members/[memberId]/route.ts`, `workspace-step-up.ts` |
| authorization-workspaces-03 | Low | Security | `lf_workspace_id` cookie not httpOnly/secure | Client-JS readable/writable selector (no cross-tenant access; defense-in-depth) | Mark httpOnly+secure; centralize options | `workspace-context.ts:29-33`, `workspaces/route.ts:160`, `invitations/[token]/accept/route.ts:51` |
| authorization-workspaces-04 | Low | Security | Plaintext invite token returned as `devInviteUrl` when `NODE_ENV!=production` | Staging with misset NODE_ENV exposes working accept links in responses | Gate on explicit dev flag, never log token | `workspaces/[id]/invitations/route.ts:193` |
| authorization-workspaces-05 | Low | Architecture | Tenant isolation depends on manual per-query scope discipline (no DB/middleware backstop) | One forgotten assertion = tenant leak | Add Prisma `$extends`/lint backstop for scoped models | `workspace-data-scope.ts`, all scoped routes |
| authorization-workspaces-06 | Low | Reliability | `ensureWorkspaceDefaults` swallows all errors; a slipped user hits 403 on scoped routes | New user without membership locked out of scoped features until backfill | Add retry/repair + telemetry on provisioning failure | `workspace-provisioning.ts:26-44` |
| authorization-workspaces-07 | Low | Dead Code | Stale `?workspace=` admin-override comment with no in-scope implementation | Misleading doc or pointer to an unaudited admin bypass | Remove comment or audit the real handler | `workspace-context.ts:115-118` |
| authorization-workspaces-08 | Low | Performance | N+1 in `GET /api/workspaces` (per-workspace subscription + counts) | Extra sequential queries per request | Batch owner subs/counts | `workspaces/route.ts:37-96` |
| authorization-workspaces-09 | Info | Test | No IDOR/role-matrix/seat-concurrency test coverage for the authz core | Regressions in the single most security-critical module go uncaught | Add the tests in §17 | `apps/web/src/lib`, scoped routes |
| authorization-workspaces-10 | Info | Dead Code | `workspace-context.ts` header claims "tested, unused" but it is widely used | Misleading maintainer signal | Update header | `workspace-context.ts:1-12` |

## 19. Module TODO

- [ ] **(Medium) authorization-workspaces-01** — Stop failing open to legacy scope
  on config-read error. Reason: silent enforcement flip + no alarm. Files:
  `workspace-data-scope.ts`, `plan-limits.ts`. Fix: short-TTL cache of last-known
  flag + metric/alert on catch. Deps: runtime-config, metrics sink. Complexity:
  med. Risk of change: med (touches hot path — must not regress the launching-off
  default).
- [ ] **(Low) authorization-workspaces-02** — Require step-up for promote-to-ADMIN
  (and consider removal). Reason: privilege escalation without re-auth. Files:
  `workspaces/[id]/members/[memberId]/route.ts`, `workspace-step-up.ts`. Fix: add
  operation + wire into PATCH role path. Complexity: low. Risk: low.
- [ ] **(Low) authorization-workspaces-03** — Make `lf_workspace_id` httpOnly+secure
  and centralize cookie options. Reason: defense-in-depth. Files: resolver +
  3 setters. Complexity: low. Risk: low (verify no client JS reads it).
- [ ] **(Low) authorization-workspaces-04** — Replace `NODE_ENV` gate on
  `devInviteUrl` with an explicit dev flag. Files:
  `workspaces/[id]/invitations/route.ts`. Complexity: low. Risk: low.
- [ ] **(Low) authorization-workspaces-05** — Add a Prisma scope backstop
  (middleware/lint) for `Address/Service/MovingPlan/Budget/MoveTask`. Reason:
  remove reliance on manual discipline. Complexity: med/high. Risk: med.
- [ ] **(Low) authorization-workspaces-06** — Add provisioning-failure telemetry +
  self-repair. Files: `workspace-provisioning.ts`. Complexity: low. Risk: low.
- [ ] **(Low) authorization-workspaces-07** — Resolve the stale `?workspace=`
  comment (delete or link). Verify no out-of-scope admin override bypasses
  membership. Complexity: low. Risk: low.
- [ ] **(Low) authorization-workspaces-08** — Batch the `GET /api/workspaces` per-
  workspace queries. Complexity: low. Risk: low.
- [ ] **(Info) authorization-workspaces-09** — Add IDOR / role-matrix / seat-
  concurrency / redaction tests (§17). Complexity: med. Risk: low.
- [ ] **(Info) authorization-workspaces-10** — Update the misleading
  `workspace-context.ts` "tested, unused" header. Complexity: low. Risk: low.
