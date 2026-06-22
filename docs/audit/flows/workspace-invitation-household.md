# Flow Audit: Workspace Invitation / Household

Area slug: `workspace-invitation-household`
Scope: Create/own workspace -> invite member -> accept invite -> role assignment -> data scope.
Method: read-only source review. Evidence cites repo-relative paths. Doc/comment claims are not treated as proof.

---

## 1. Flow Summary & actors

**Actors**
- **Owner** — creates/owns a workspace (`Workspace.ownerUserId`); is the billing/entitlement anchor that resolves the seat ceiling.
- **Admin / Member / Child / View-only** — invited members with role-gated capabilities (`packages/shared/src/permissions.ts`).
- **Invitee** — recipient of an invitation email/token; must hold an account whose email matches `WorkspaceInvitation.invitedEmail`.

**Feature gate**: the entire flow is behind `WORKSPACE_MODEL_ENABLED` (`apps/web/src/lib/workspace-context.ts:96`, enforced per-route via `workspaceFeatureGate()` in `apps/web/src/lib/workspace-routes.ts:18`). When off, routes 404 and `GET /api/workspaces`, `GET /api/invitations/pending` degrade to empty lists.

**Core models** (`packages/db/prisma/schema.prisma:2176-2272`): `Workspace`, `WorkspaceMember` (`@@unique([workspaceId, userId])`), `WorkspaceInvitation` (`tokenHash @unique`, `@@unique([workspaceId, invitedEmail, expiresAt])`). All role/status columns are free-form `VarChar(20)`.

**Seat model**: seat ceiling = `seatLimitForPlan(plan)` (`packages/shared/src/workspace-entitlements.ts:71`; FREE_TRIAL/INDIVIDUAL=1, FAMILY=6, PRO=10). Used seats = non-suspended members + non-expired PENDING invites (`apps/web/src/lib/workspace-invitations.ts:41`).

---

## 2. Step-by-step trace

### Step A — Create workspace
- Trigger: `POST /api/workspaces` (`apps/web/src/app/api/workspaces/route.ts:106`).
- Authz: session required; plan must be FAMILY or PRO (`resolveConsumerEntitlement`, line 114-117). Cap of `MAX_OWNED_WORKSPACES = 3` per owner (line 127-134).
- DB: `$transaction` creates `Workspace` + OWNER `WorkspaceMember`, then **stamps the owner's null-workspace Address/Service/MovingPlan/Budget rows into the new workspace** (`updateMany where {userId, workspaceId:null}`, lines 149-155).
- Side effects: sets `lf_workspace_id` cookie (1 year).
- Note: every user is also auto-provisioned a personal workspace at signup via `ensureWorkspaceDefaults` (`apps/web/src/lib/workspace-provisioning.ts:26`), which creates the workspace + OWNER member but does **not** backfill data.

### Step B — Invite a member
- Trigger: `POST /api/workspaces/[id]/invitations` (`apps/web/src/app/api/workspaces/[id]/invitations/route.ts:53`).
- Authz: caller must be a member (`404` if not) with `member.invite` (OWNER/ADMIN). Inviting `ADMIN` requires `member.promoteAdmin` (OWNER-only, line 82). `INVITABLE_ROLES` excludes OWNER.
- Rate limit: `ws-invite:${id}`, 5/hour, `failClosed:false` (line 68).
- Validation: email regex + role allow-list (422). Optional COPPA guardian consent for CHILD when `COPPA_AGE_GATE_ENABLED` (lines 90-99).
- Seat gate: `seatLimitForPlan(plan) <= 1` → 403 upsell (line 108). Inside a **serializable** `$transaction`: reject if invitee already a member (`ALREADY_MEMBER`), reject a live PENDING invite for the same email (`PENDING_INVITE`), re-check seats (`SEAT_FULL`), then create the invite. Token = `wsi_`+base64url(32 bytes); only `sha256(token)` stored (`apps/web/src/lib/workspace-invitations.ts:15-22`).
- Side effects: transactional invitation email (`sendWorkspaceInvitationEmail`), locale chosen from recipient account or inviter; dev returns `devInviteUrl` when email not configured and not production.

### Step C — Validate invite (landing page)
- Trigger: `GET /api/invitations/[token]` (`apps/web/src/app/api/invitations/[token]/route.ts:12`) — **unauthenticated**, public. Returns workspace name, invitedEmail, role, expiry, `requiresSignup`. 404 invalid / 410 revoked|accepted|expired. Never returns the token/hash.
- UI: `apps/web/src/app/invitations/[token]/page.tsx` resolves the invite + `auth/me`, branches on authed/email-match/requiresSignup.

### Step D — Accept invite (two entry points, shared core)
- **Token route**: `POST /api/invitations/[token]/accept` (`apps/web/src/app/api/invitations/[token]/accept/route.ts`). Authz via `getUserSession()` + `user.email == inv.invitedEmail` (case-insensitive). **No email-verification gate** and **no rate limit**.
- **In-app route**: `POST /api/invitations/pending/[id]/accept` (`.../pending/[id]/accept/route.ts`). Authz via `requireVerifiedUser()` + verified-email match; returns 404 (not 403) for missing/other-user invites.
- Shared core: `acceptWorkspaceInvitation` (`apps/web/src/lib/workspace-invite-accept.ts:69`) inside a **serializable** `$transaction`: idempotent member existence check, seat re-check (excluding THIS invite), create ACTIVE `WorkspaceMember`, **backfill the joiner's null-workspace Address/Service/MovingPlan into the workspace** (budgets intentionally excluded, lines 126-131), flip invite → ACCEPTED. P2034→RETRY(409), P2002→ALREADY_MEMBER(409).
- Side effects: `AuditLog` (WS_INV_ACCEPTED), inviter in-app notification, owner roster notification, `lf_workspace_id` cookie set.

### Step E — Decline / Revoke
- Decline (invitee): `POST /api/invitations/pending/[id]/decline` (`.../decline/route.ts`) — verified-email match, flips PENDING→REVOKED, idempotent, audits WS_INV_REVOKED.
- Revoke (manager): `DELETE /api/workspaces/[id]/invitations/[invId]` (`.../invitations/[invId]/route.ts`) — `member.invite` gate, 409 if already ACCEPTED.

### Step F — Role assignment / membership management
- Role change & suspend/reactivate: `PATCH /api/workspaces/[id]/members/[memberId]` (`.../members/[memberId]/route.ts`). Cannot change own role/status (409). ADMIN bounded by `member.changeRole`/`member.remove` matrix; promoting to ADMIN is OWNER-only. Reactivation calls `reconcileWorkspaceSeats`.
- Remove: `DELETE` same file — member row deleted; **member's domain data stays with the workspace** (lines 270-272). `reconcileWorkspaceSeats` restores an OVERFLOW member.
- Leave: `POST /api/workspaces/[id]/members/leave` — `member.leave` (OWNER/CHILD cannot); deletes membership; reconcile.
- Transfer ownership: `POST /api/workspaces/[id]/transfer` — OWNER-only + step-up auth (`requireWorkspaceStepUp`), moves billing anchor, reconciles seats.

### Step G — Data scope (the payoff)
- `resolveWorkspaceDataScope` (`apps/web/src/lib/workspace-data-scope.ts:43`) → `scopedRecordWhere` keys reads/writes on `workspaceId` (manager/member) or `userId` for CHILD self-only. `assertWorkspaceAction`/`assertScopedRecordAction` enforce the permission matrix per record.

---

## 3. Happy-path correctness

The happy path is coherent and mostly well-built:
- Seat accounting is consistent across `countUsedSeats`, the invite-create re-check, the accept re-check, and the pending-list filter (all use *non-suspended members + non-expired PENDING invites*).
- Both accept entry points funnel through one serializable core, so behavior is identical and idempotent (existing-member short-circuit).
- Token is high-entropy (32 random bytes), stored only as sha256; plaintext lives only in the email. Good.
- 404-vs-403 discipline on member/invitation routes avoids leaking existence of other users' invitations/rows.
- Seat races resolved via Serializable isolation + P2034 RETRY mapping.

---

## 4. Edge cases & reverse-logic

| Concern | Observation |
|---|---|
| Auth/role | Matrix is centralized and pure (`permissions.ts`). `member.changeRole`/`member.remove` correctly prevent ADMIN acting on OWNER/ADMIN. |
| Unverified email accept (token route) | Token route uses `getUserSession()` with **no `requireVerifiedUser`**, unlike the in-app route. A password user with `emailVerifiedAt=null` (register sets it null, `register/route.ts:162-171`) can accept a token invite. See WIH-01. |
| Email-match as authz boundary | Registration does not verify email ownership up-front; the token-accept boundary trusts the account email string. Holder of the token + an account claiming that email joins. See WIH-01. |
| No rate limit on accept | Neither accept route nor decline route is rate-limited (`grep` for `rateLimit` under `api/invitations` returns nothing). Token route is unauthenticated-adjacent (any session) and enumerable. See WIH-02. |
| Joiner data absorption | On accept, ALL of the joiner's `workspaceId:null` Address/Service/MovingPlan rows move into the inviter's workspace (`workspace-invite-accept.ts:126-131`). On later removal/leave they stay with the workspace (`members/[memberId]/route.ts:270-272`), so the member permanently loses access to data that was originally personal. See WIH-03. |
| Double-submit / idempotency | Serializable tx + existing-member check make accept idempotent; UI disables buttons while busy. Good. |
| Token expiry | Enforced at read time everywhere (`expiresAt < now` / `gte: now`). No cron flips PENDING→EXPIRED, but every consumer filters on time, so it is consistent. |
| Partial failure | Member create + invite flip are atomic; audit/notifications are best-effort post-commit (acceptable). |
| Race for last seat | Handled (Serializable + P2034 RETRY). |
| `@@unique([workspaceId, invitedEmail, expiresAt])` | Because `expiresAt` is always `now()+7d`, two invites seconds apart differ → the unique index effectively never dedupes. Dedup relies solely on the in-tx `PENDING_INVITE` query (correct under Serializable), so the P2002 branch (line 161) is near-dead code. See WIH-05. |
| Stale workspace cookie | `requireWorkspaceContext` falls back to oldest membership and self-heals the cookie; header source fails closed with 409. Reasonable. |
| Direct deep-link | `/invitations/[token]` page handles unauth, wrong-account ("switch account"), requiresSignup. Good UX. |
| CHILD demotion lockout | A manager can set a MEMBER → CHILD via the role select; CHILD reads are self-only (`address.view` isSelf), so a former MEMBER demoted to CHILD loses visibility of workspace-shared records they could previously see. Product-intended but worth confirming. See WIH-06. |

---

## 5. Security review

- **Authz at each step**: present and centralized. Invite/revoke/manage gated on `member.invite`/`member.remove`/`member.changeRole`; rename/transfer/delete OWNER-only; transfer additionally step-up gated.
- **IDOR / workspace scoping**: member/invitation lookups are always constrained by `workspaceId` + caller membership; pending accept/decline constrain by verified-email match and return 404 to avoid existence disclosure. Data reads scoped by `workspaceId` via `scopedRecordWhere`.
- **Validation**: email regex, role allow-list, name length bounds, `ID_RE` on workspace selection header/cookie.
- **Rate limiting**: invite POST is limited (5/hr, fail-open). Accept/decline are **not** limited (WIH-02).
- **Secrets/PII**: token never returned by validate/pending endpoints; only `tokenLast4` exposed to managers. Emails masked for non-managers (`maskEmail`) and in audit payloads (`maskTargetEmail`).
- **Email-verification gap** on the token-accept boundary (WIH-01).

---

## 6. Reliability

- **Transactions**: create/invite/accept/transfer all wrap multi-row writes in `$transaction` (Serializable where contention matters). Strong.
- **Retry**: P2034 surfaces as a 409 "Please try again"; the UI surfaces the error but does not auto-retry (user re-clicks). Acceptable.
- **Best-effort side effects**: audits, emails, in-app + owner notifications all `.catch(() => {})` so they never fail the mutation.
- **Loading/empty/error UX**: invitation landing page distinguishes 5xx ("transient") from invalid; pending banner renders nothing on any non-OK; settings page distinguishes feature-off / 5xx / empty. Good.
- **Notification emails** include `manageUrl` built from `NEXT_PUBLIC_APP_URL` with a localhost fallback — a misconfigured env in prod would mint localhost links (low risk; informational, WIH-07).

---

## 7. Cross-module impact

- **Billing/entitlement**: `Workspace.ownerUserId` is the seat/plan anchor. Transfer or owner downgrade re-resolves the limit; `reconcileWorkspaceSeats` demotes newest non-owner members to read-only OVERFLOW (or collapses to 1 seat when owner access lapses). Invitation seat gates use `resolveConsumerEntitlement` (consumer-free override).
- **Auth**: relies on custom JWT session (`getUserSession`) and `requireVerifiedUser`. The inconsistency between the two accept routes (WIH-01) is the key cross-cutting issue.
- **Data domain**: Address/Service/MovingPlan/Budget carry `workspaceId`; accept/create backfill mutates these en masse. Removal leaves them workspace-scoped (data ownership shift, WIH-03).
- **Notifications**: in-app `WORKSPACE_MEMBERSHIP` notices + membership/ownership emails.
- **Audit**: user-actor `AuditLog` rows with `WS_*` action codes (≤20 chars).
- **i18n**: pending banner + emails localized.

---

## 8. Findings Summary

| ID | Sev | Cat | Finding | Impact | Recommendation | Files |
|---|---|---|---|---|---|---|
| WIH-01 | Medium | Security | Token-accept route authorizes on account-email match via `getUserSession()` with no email-verification gate, unlike the in-app route which uses `requireVerifiedUser()`. | A holder of an invite token who registers an account claiming the invited email (email unverified at register time) can join the household and gain access to shared data. Inconsistent boundary across the two accept paths. | Require verified email on the token-accept route (mirror `requireVerifiedUser`), or re-verify email ownership before honoring the email match. | `apps/web/src/app/api/invitations/[token]/accept/route.ts:18-29`; `apps/web/src/lib/email-verification-gate.ts:9`; `apps/web/src/app/api/auth/register/route.ts:162-171` |
| WIH-02 | Medium | Security | No rate limiting on accept/decline routes (token or in-app). Invite POST is limited, accept is not. | Token-accept is enumerable: an attacker with a session can brute-force/replay candidate tokens against `/api/invitations/[token]/accept` (and the unauthenticated `GET /api/invitations/[token]`) without throttling. Token entropy is high, but absence of throttling removes defense-in-depth. | Add `rateLimit` to both accept routes and the public validate route (per-IP and per-session). | `apps/web/src/app/api/invitations/[token]/accept/route.ts`; `apps/web/src/app/api/invitations/[token]/route.ts`; `apps/web/src/app/api/invitations/pending/[id]/accept/route.ts` |
| WIH-03 | Medium | Data | On accept, ALL of the joiner's `workspaceId:null` Address/Service/MovingPlan rows are absorbed into the inviter's workspace; on later removal/leave the data stays with the workspace. | A member who joins then leaves (or is removed) permanently loses access to data that was originally their personal data — it becomes owned by the household/owner. Potential data-ownership and privacy concern (e.g. someone invited "to try it", later removed). | Track provenance (original `userId`) and restore null-workspace scoping for the leaver's own pre-membership rows on removal/leave, or warn the user at accept time that personal data will be shared and remain with the workspace. | `apps/web/src/lib/workspace-invite-accept.ts:126-131`; `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:270-276`; `apps/web/src/app/api/workspaces/[id]/members/leave/route.ts:42-44` |
| WIH-04 | Low | Logic | Seat re-check inside accept uses the owner's CURRENT entitlement; an invite created while on FAMILY can be accepted later after the owner downgraded to INDIVIDUAL only if seats allow — but an over-limit owner who downgraded keeps stale PENDING invites that still display as actionable until expiry. | Invitee may attempt to accept and hit SEAT_FULL (409), a confusing dead-end; pending invites are not proactively revoked on downgrade. | On owner downgrade/`reconcileWorkspaceSeats`, optionally revoke or flag over-limit PENDING invites so they don't dangle. | `apps/web/src/lib/workspace-invite-accept.ts:80-111`; `apps/web/src/lib/workspace-ownership.ts:117-164` |
| WIH-05 | Low | Dead Code | `@@unique([workspaceId, invitedEmail, expiresAt])` includes the always-distinct `expiresAt`, so the index never dedupes re-invites; the P2002 handler in invite POST is effectively unreachable. | Misleading constraint; the real dedup is the in-transaction `PENDING_INVITE` query. Maintenance risk if someone relies on the unique index for dedup. | Either drop `expiresAt` from the unique key (and handle the resulting collisions) or document that dedup is query-driven and remove the dead P2002 branch comment's implication. | `packages/db/prisma/schema.prisma:2268`; `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:130-165` |
| WIH-06 | Low | Logic | A manager can demote a MEMBER to CHILD via the role select; CHILD `address.view`/`service.viewBasic` are self-only, so the demoted user loses visibility of previously-visible shared records. | Surprising access loss on a routine role change; no confirmation. Likely intended, but worth a UI confirmation. | Confirm intent; add a UI warning when demoting to CHILD/VIEW_ONLY about reduced visibility. | `packages/shared/src/permissions.ts:107-111`; `apps/web/src/app/(app)/settings/workspace/page.tsx:622-634` |
| WIH-07 | Info | Reliability | Invite/notification URLs use `NEXT_PUBLIC_APP_URL` with a `http://localhost:3000` fallback. | A missing/incorrect env in production would mint localhost accept/manage links. | Fail loudly (or assert) when `NEXT_PUBLIC_APP_URL` is unset in production. | `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:21-23`; `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:19-21` |
| WIH-08 | Info | Security | `WorkspaceMember.role`/`status` are free-form `VarChar(20)`. Context resolver fails closed on unknown status (allow-list) — good — but role is cast directly to `WorkspaceRole` and an unknown role falls through `can()` default→`false` (deny). | Defensive posture is acceptable; flagged for awareness only. | Consider Prisma enums or a CHECK constraint to prevent invalid role/status writes. | `packages/db/prisma/schema.prisma:2213-2214`; `apps/web/src/lib/workspace-context.ts:191-205` |

---

## 9. Flow TODO

1. **WIH-01** — Gate the token-accept route on verified email (parity with the in-app route).
2. **WIH-02** — Add rate limiting to accept/decline + the public validate route.
3. **WIH-03** — Decide and document data-ownership semantics for joiner data on leave/removal; consider provenance-based restore.
4. **WIH-04** — Reconcile/flag dangling over-limit PENDING invites on owner downgrade.
5. **WIH-05** — Resolve the misleading unique-index/dedup duplication.
6. **WIH-06** — Add a UI confirmation for demotions that reduce visibility.
7. Verify tests cover: unverified-email token accept, seat race, joiner-data restore on removal (current tests exist for accept/seat but not data-restore).
