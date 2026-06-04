# Recheck task: `feat/connector-and-workspace-foundation`

Status: completed
Date: 2026-05-31

Branch: `origin/feat/connector-and-workspace-foundation`
Base: `origin/main`
Range: `origin/main..origin/feat/connector-and-workspace-foundation`
Current commit count: 104

This is a fresh recheck after the follow-up fixes. The original review covered 98 commits; the branch now has 6 additional commits that explicitly target the previous blockers.

## Verification

- `git fetch origin --prune`: passed
- `git rev-list --left-right --count origin/main...origin/feat/connector-and-workspace-foundation`: `0 104`
- `pnpm verify:typecheck`: passed
- `pnpm verify:tests`: passed
  - web: 178 files, 1262 tests passed
  - admin: 78 files, 427 tests passed
  - mobile: 9 files, 21 tests passed
  - connectors: 11 files, 72 tests passed
- `pnpm audit:providers`: passed with existing data-quality warnings
- `pnpm audit:providers:coverage`: passed, no coverage gaps
- `pnpm audit:providers:state-completeness`: passed, 310 official URL validations ok
- `git diff --check origin/main...origin/feat/connector-and-workspace-foundation`: clean

Environment note: commands ran on Node `v24.12.0`; repo declares Node `22.x`, so pnpm prints engine warnings.

Worktree note: several report/generated files are dirty/untracked. I did not revert or remove them.

## New commits since the 98-commit review

- `7a7281d` - fixes auto-sync entitlement, member leave/remove reconciliation, and adds a workspace ownership cap.
- `b9485a7` - drops Authorization on cross-host connector redirects and hides ADMIN invite option for non-owners.
- `2bae75f` - adds recovery for stranded `DISPATCHING` rows and exposes batch failures.
- `0eec9cd` - enforces `perUserPerDay` connector manifest dispatch cap.
- `06eabbb` - adds USPS null-origin guard and serializable invitation accept seat checks.
- `28bf10c` - adds `Subscription.pendingPlan` for scheduled downgrade target plan.

## Previous findings: recheck result

| Previous issue | Current result |
|---|---|
| Auto-sync bypasses annual-Pro entitlement | Closed. Address PATCH now checks `userHasApiConnectorEntitlement(userId)` before enqueue. |
| Member leave/remove does not reconcile overflow seats | Closed. Both routes call `reconcileWorkspaceSeats(id)`. |
| Redirect keeps Authorization on cross-host redirect | Closed. Cross-host redirects filter Authorization. |
| Dispatch can stay stranded in `DISPATCHING` | Mostly closed. A stale sweep flips old rows to `NEEDS_USER` and notifies. |
| USPS can be queued without origin | Closed for dispatch creation. USPS manifest now has `requiresOrigin`; enqueue skips it when `from` is null. |
| Invitation accept seat race | Mostly closed. Accept transaction uses `Serializable` and handles `P2034`. |
| Pending downgrade target plan not persisted | Partially fixed. DB column/write exists, but clear/select/UI logic is still incomplete. |
| Connector rate limits declared but not enforced | Partially fixed. `perUserPerDay` is enforced; `perConnectorPerMinute` is still not enforced. |
| Workspace creation unlimited | Partially fixed. It is capped at 3 owned workspaces, but the policy is hard-coded and can still multiply seats. |
| Workspace/domain isolation incomplete | Still open. Address/service/budget routes remain legacy user-scoped and new rows are not stamped with `workspaceId`. |

## Current open findings

### P1 - Workspace isolation is still incomplete

The core domain APIs still do not call `requireWorkspaceContext`, and new domain rows are not stamped with a workspace.

Evidence:

- `apps/web/src/app/api/addresses/route.ts` reads with `{ userId, deletedAt: null }` and creates addresses with `userId` only.
- `apps/web/src/app/api/services/route.ts` still works through `activeTrackedServiceWhere(userId)` and creates service rows by user/address ownership.
- `apps/web/src/app/api/budget/route.ts` still uses `userId` and does not assign `workspaceId`.
- `apps/web/src/app/api/workspaces/[id]/sync/route.ts` still allows null `address.workspaceId`: it only rejects when `address.workspaceId && address.workspaceId !== id`.
- `packages/db/prisma/migrate-to-workspaces.ts` backfills old rows, but new address/service/budget writes still produce null `workspaceId`.

Why it matters: once users can belong to multiple workspaces, a manager in workspace A can potentially operate on a member's address that is not actually bound to workspace A, because null `workspaceId` is treated as acceptable.

Recommended fix: retrofit address/service/budget/moving routes through workspace context when `WORKSPACE_MODEL_ENABLED` is on, stamp new rows with the resolved workspace, and make workspace sync require `address.workspaceId === id` after backfill.

### P2 - Scheduled downgrade pending plan is still not correctly integrated

`pendingPlan` is now persisted, but the rest of the system does not consistently use it.

Evidence:

- `apps/web/src/app/api/subscription/change-plan/route.ts` writes `pendingPlan`.
- `packages/db/prisma/schema.prisma` has `pendingPlan`.
- `apps/web/src/lib/billing.ts` select includes `pendingBillingInterval` but not `pendingPlan`.
- `apps/web/src/components/settings/subscription-management.tsx` has no `pendingPlan` field/type/display.
- `apps/web/src/app/api/webhooks/stripe/route.ts` clears pending state when `derivedBillingInterval === local.pendingBillingInterval`, without checking that the derived plan equals `pendingPlan`.

Why it matters: `PRO YEAR -> FAMILY YEAR` has the same interval. A pre-transition Stripe webhook can match the interval and clear pending state before the plan actually changes.

Recommended fix: select and serialize `pendingPlan`, display it in settings, and clear pending state only when both derived plan and derived interval match the pending target. Also clear `pendingPlan` in immediate plan/cycle change paths.

### P2 - Connector rate limit enforcement is partial

`perUserPerDay` is enforced, but `perConnectorPerMinute` remains declared-only.

Evidence:

- `packages/connectors/src/usps/index.ts` declares `rateLimit: { perUserPerDay: 2, perConnectorPerMinute: 60 }`.
- `apps/web/src/lib/connector-runtime.ts` checks `manifest.rateLimit?.perUserPerDay`.
- No runtime code uses `perConnectorPerMinute`.

Recommended fix: enforce connector-wide minute caps at enqueue or claim time. Add tests for both per-user and connector-wide limits, including concurrent enqueue.

### P2/P3 - Workspace owner cap is hard-coded and may still multiply seats

The unlimited workspace issue is no longer unlimited, but the cap is a local constant:

- `apps/web/src/app/api/workspaces/route.ts`: `MAX_OWNED_WORKSPACES = 3`

If Family has 6 seats per workspace, 3 workspaces can still allow 18 active seats owned by one subscriber. That may be acceptable if product wants 3 household/workspace containers, but it should be a shared entitlement policy, not an untested route-local constant.

Recommended fix: move owned-workspace cap into shared plan entitlements and define whether seats are per workspace or per subscription.

### P3 - New fixes are under-tested

The full suite passes, but targeted coverage for the new fixes is thin.

Missing or weak tests found:

- no direct test for address PATCH auto-sync entitlement gate
- no direct test for stale `DISPATCHING` recovery
- no direct test for `perUserPerDay` skip behavior
- no direct test for `perConnectorPerMinute`
- no direct test for `requiresOrigin` skip in enqueue
- no direct test that cross-host redirect drops Authorization
- no direct test for workspace create cap
- no test for same-interval plan downgrade pending state

## Commit-by-commit recheck matrix

- [x] 001 `85572fa` - Recommendation scoring profile-aware/cache-backed. Still OK.
- [x] 002 `3ab9fab` - Provider coverage confidence cleanup. Still OK; provider data warnings remain non-blocking.
- [x] 003 `e1254e3` - Stripe webhook hardening. Still OK.
- [x] 004 `c3ff31d` - Login brute-force/enumeration hardening. Still OK.
- [x] 005 `1173f4e` - Moving migration endpoint hardening. Still OK.
- [x] 006 `55223ca` - Services/address consistency. OK in legacy user scope; workspace scoping still open.
- [x] 007 `1333da6` - Budget consistency. OK in legacy user scope; workspace scoping still open.
- [x] 008 `44c1573` - Bound/order provider scan. OK.
- [x] 009 `22015f0` - Custom provider consistency. OK.
- [x] 010 `b499552` - Moving plan deletion consistency. OK.
- [x] 011 `85721f9` - Notification config validation. OK.
- [x] 012 `e1b3dc7` - Sensitive consent withdrawal cleanup. OK.
- [x] 013 `18475b0` - Onboarding progress rate-limit. OK.
- [x] 014 `ad63b75` - Idempotency comment correction. OK.
- [x] 015 `e0d632e` - Push register/unregister rate-limit. OK.
- [x] 016 `9b0f97a` - Locale preference rate-limit. OK.
- [x] 017 `039bc0f` - Admin UX confirmations. OK.
- [x] 018 `5b5cdc2` - Blog data loss/SEO. OK.
- [x] 019 `9d7e838` - Connector framework + workspace data layer. Still high-blast-radius; later fixes improve it, but workspace isolation and partial rate limit remain open.
- [x] 020 `cf9e965` - Connector/workspace APIs and UI. Improved by later fixes; workspace domain isolation remains open.
- [x] 021 `d9f9468` - Workspace soft-delete model. OK.
- [x] 022 `e71462e` - SEO/billing/auth/provider fixes. OK.
- [x] 023 `f4c085d` - Admin hardening/billing/privacy/MFA/audits. OK.
- [x] 024 `3e3425e` - Mobile MFA/dead-code/error states. OK.
- [x] 025 `aeb84ce` - Recommendation/runtime config/blog seed. OK.
- [x] 026 `9ac21e9` - Workspace plan feature/seat matrix. OK abstraction; route policy still needs central workspace cap.
- [x] 027 `c321cfe` - Connections settings page. OK.
- [x] 028 `9bc2deb` - DELETE JSON content-type fix. OK.
- [x] 029 `b7c64cc` - Workspace-authorized sync trigger. Still affected by null `workspaceId` allowance.
- [x] 030 `24e060c` - Invitation accept page. OK.
- [x] 031 `89930f5` - Managed-sync consent column. OK.
- [x] 032 `333eeb1` - Managed sync on behalf of members. Improved, but depends on stricter workspace/address binding.
- [x] 033 `97d5256` - Invite link route fix. OK.
- [x] 034 `5706c4c` - Workspace members page. ADMIN invite UI fixed later.
- [x] 035 `da2a3a9` - Workspace invitation emails. OK.
- [x] 036 `65638f0` - Feature-gated Family/Teams homepage. OK.
- [x] 037 `4f16bb5` - Workspace sync tests. OK but still missing null workspaceId/entitlement cases.
- [x] 038 `0b51802` - Member role/removal authz tests. OK.
- [x] 039 `c01a7a5` - Address-sync homepage section. OK.
- [x] 040 `30ddb04` - Mobile invite deep link. OK.
- [x] 041 `10ae6ea` - Redirect allowlist. Improved further by `b9485a7`.
- [x] 042 `4ec2195` - Suspended workspace mutation gate. OK.
- [x] 043 `5c8448f` - Atomic dispatch claim. Improved by stale recovery in `2bae75f`.
- [x] 044 `138804d` - Connector entitlement/workspace binding. Improved; auto-sync entitlement closed by `7a7281d`.
- [x] 045 `d740495` - Access/refresh token split. OK.
- [x] 046 `00aea2f` - Control-plane runtime gating. OK.
- [x] 047 `9442fc3` - Personal workspace provisioning. OK, but workspace cap policy should be shared/tested.
- [x] 048 `1243836` - Needs-action sync notification. OK.
- [x] 049 `01c9e2c` - Ownership transfer/account deletion. OK.
- [x] 050 `ee3716c` - Dispatch cron registration. Improved by `2bae75f`.
- [x] 051 `632809f` - Primary address auto-sync/manual sync. Entitlement fixed; USPS null-origin now skipped.
- [x] 052 `73b45bb` - Seat overflow/reconcile on plan change. Removal/leave gap fixed by `7a7281d`.
- [x] 053 `8f7d189` - Revoke cancellation/abort/sanitize. OK.
- [x] 054 `3616f8d` - Membership lifecycle notifications. OK.
- [x] 055 `00ee1d2` - Workspace purge cron/UI errors. OK.
- [x] 056 `b46e6c6` - Mobile workspace management. OK.
- [x] 057 `c6c4085` - Admin dispatch observability. OK.
- [x] 058 `478f05f` - Coordination-only homepage copy. OK.
- [x] 059 `1494c52` - Workspace UI network toasts. OK.
- [x] 060 `ba8d253` - Invite email localization. OK.
- [x] 061 `4e36d02` - Family/Pro billing cascade. OK.
- [x] 062 `b494e0c` - Admin nav simplification. OK.
- [x] 063 `08b3198` - Provider bulk-edit controls. OK.
- [x] 064 `0ebb314` - Family/Pro checkout. Still has pending-row normalization concern for existing subscription rows.
- [x] 065 `3d4622a` - Pricing tiers. OK.
- [x] 066 `b579963` - Sentry server init. OK.
- [x] 067 `7895b6d` - Provider list error/retry. OK.
- [x] 068 `e79760f` - Mobile upgrade to web. OK.
- [x] 069 `e22cfa0` - Reconcile seats on owner plan change. OK.
- [x] 070 `941b81a` - Notification taxonomy/icons/toggles. OK.
- [x] 071 `47e9b92` - DB hot-path indexes. OK.
- [x] 072 `21a0f5e` - Admin boundaries/a11y dialog. OK.
- [x] 073 `957e622` - GDPR export workspace context. OK.
- [x] 074 `400aea2` - Annual Pro connector entitlement. Auto-sync path fixed later.
- [x] 075 `4c8ebbf` - Plan change endpoint. Pending-plan integration still incomplete.
- [x] 076 `11a58a0` - Plan switcher. Pending-plan UI still incomplete.
- [x] 077 `51f7bb3` - Read-only gate leave/restore/revoke. Reconcile fixed later.
- [x] 078 `e3fc2fe` - Preserve member data on owner delete. OK.
- [x] 079 `ff6240e` - Ownership transfer notifications. OK.
- [x] 080 `949b217` - Seat demote/restore notifications. OK.
- [x] 081 `cf9decd` - Role/removal emails + invite 409. OK; reconcile fixed later.
- [x] 082 `1a0dd88` - Heir ownership notification. OK.
- [x] 083 `7d22afe` - Household setup rename/onboarding. OK.
- [x] 084 `958951d` - Family/Pro exact-match sweep. OK.
- [x] 085 `a45dbb9` - COPPA min-age gate. OK.
- [x] 086 `9e3cc0a` - Guardian consent for CHILD invite. OK.
- [x] 087 `0b1229d` - Session fingerprint IP alignment. OK.
- [x] 088 `7310045` - Soft-delete completeness. OK.
- [x] 089 `e37617d` - Cron auth + Ofelia jobs. OK.
- [x] 090 `cb1a810` - PII scrub in logs/errors. OK.
- [x] 091 `6b601b8` - Family/Pro Stripe price config. OK.
- [x] 092 `13106ee` - Email-template double-submit guard. OK.
- [x] 093 `7fa128c` - Shared Dialog a11y. OK.
- [x] 094 `4564c6c` - Duplicate T-Mobile seed row. OK.
- [x] 095 `4324aba` - Wide-scope provider bulk confirmation. OK.
- [x] 096 `d82fa5c` - Admin modal semantics/Escape. OK.
- [x] 097 `85691b6` - Address autocomplete combobox. OK.
- [x] 098 `da7a3d0` - Invitation accept + ownership transfer tests. OK; more targeted tests needed.
- [x] 099 `7a7281d` - Entitlement + seat reconcile + workspace cap. Mostly good; workspace cap should be shared/tested and workspace isolation remains open.
- [x] 100 `b9485a7` - Drop auth on cross-host redirect + hide ADMIN invite. Good fix; add direct tests.
- [x] 101 `2bae75f` - Recover stranded `DISPATCHING` rows. Good operational fix; add direct tests/metrics expectations.
- [x] 102 `0eec9cd` - Enforce per-user-per-day cap. Partial fix; connector-wide per-minute cap still missing.
- [x] 103 `06eabbb` - USPS null-origin guard + serializable accept seats. Good fix; pending-invite overbooking is still allowed but final accept is protected.
- [x] 104 `28bf10c` - Persist pending target plan. Partial fix; clear/select/UI paths are incomplete.

## Final recheck judgement

The branch is much better than the 98-commit version. Several launch blockers were genuinely closed: entitlement bypass, stale dispatch recovery, member leave/remove reconciliation, cross-host Authorization leak, USPS null-origin dispatch, and accept-time seat race.

I still would not call it fully production-merge-ready if `WORKSPACE_MODEL_ENABLED` and public Family/Pro/connector launch are intended now. The remaining risks are integration risks, not syntax/test failures: workspace domain isolation, pending downgrade correctness, partial connector rate limits, and under-tested follow-up fixes.

