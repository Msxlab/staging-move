# feat/connector-and-workspace-foundation - commit-by-commit review

Scope: `origin/main..origin/feat/connector-and-workspace-foundation`

Count: 98 commits. Diff size: 299 files, about 17,392 insertions and 1,110 deletions.

Verification run on final branch state:

- `pnpm verify:typecheck`: passed
- `pnpm verify:tests`: passed
- `pnpm audit:providers`: passed with data-quality warnings
- `pnpm audit:providers:coverage`: passed
- `pnpm audit:providers:state-completeness`: passed
- `git diff --check origin/main...origin/feat/connector-and-workspace-foundation`: clean

Important review note: this is a per-commit logic/system review using each commit's changed files, diff shape, and the final integrated code paths. I did not check out and run the full test suite at every historical commit snapshot. The executable verification above was run on the final branch state.

## Merge-blocking / high-risk findings

1. P1 - Workspace isolation is incomplete once workspace mode is enabled.
   - Domain APIs such as addresses, services, and budget still read/write mainly by `userId` and create rows without binding `workspaceId`.
   - Workspace sync allows an address with null `workspaceId` through the workspace check.
   - Related commits: `9d7e838`, `cf9e965`, `b7c64cc`, `333eeb1`, `5706c4c`, `632809f`, `73b45bb`.

2. P1 - Workspace count is uncapped, so seat limits can be bypassed by creating multiple workspaces.
   - `POST /api/workspaces` checks plan eligibility but not owner workspace count.
   - Related commits: `cf9e965`, `5706c4c`, `9442fc3`, `73b45bb`.

3. P1 - Primary-address auto-sync can bypass annual-Pro connector entitlement.
   - Manual dispatch and OAuth have entitlement checks, but address PATCH auto-sync calls enqueue based mainly on the feature flag.
   - Related commits: `632809f`, partly corrected by `138804d` and `400aea2`, but not fully centralized.

4. P1/P2 - Connector manifest rate limits are declared but not enforced.
   - USPS declares per-user/per-connector limits; enqueue and dispatch paths do not enforce them.
   - Related commits: `9d7e838`, `cf9e965`, `632809f`.

5. P2 - Workspace member removal/leave does not reconcile overflow seats.
   - Plan changes and transfers reconcile; member removal/leave can leave eligible overflow members read-only until another event occurs.
   - Related commits: `73b45bb`, `51f7bb3`, `cf9decd`.

6. P2 - Invitation seat checks are race-prone under concurrent accept/invite.
   - Count-then-create is not serialized per workspace.
   - Related commits: `cf9e965`, `5706c4c`, `9e3cc0a`, `da7a3d0`.

7. P2 - Connector dispatch rows can get stuck in `DISPATCHING`.
   - Claim is atomic, but the referenced recovery sweep was not found in the final code.
   - Related commits: `5c8448f`, `ee3716c`, `c6c4085`, `e37617d`.

8. P2 - USPS can be queued without an old/source address.
   - Code comments imply USPS should not receive null-origin moves, but manual/auto sync can call enqueue with no `fromAddressId`.
   - Related commits: `9d7e838`, `cf9e965`, `632809f`.

9. P2/P3 - Scheduled downgrade state is incomplete in app DB/UI.
   - Pending plan is carried in Stripe metadata/response, but DB/UI persist mainly pending billing interval.
   - Related commits: `4c8ebbf`, `11a58a0`.

10. P3 - Some existing checkout subscription rows are not normalized to the intended target plan/provider while pending checkout.
    - Related commit: `0ebb314`.

11. P3 - Workspace invite UI can expose ADMIN as an option to admins even though backend rejects non-owner ADMIN invites.
    - Related commit: `5706c4c`.

12. P3 - Connector HTTP redirect handling reuses request headers on allowed-host redirects.
    - Better to drop Authorization on cross-origin redirects even inside the allowlist.
    - Related commits: `9d7e838`, `10ae6ea`, `8f7d189`.

## Commit-by-commit matrix

| # | Commit | Verdict | Review |
|---|---|---|---|
| 1 | `85572fa` | OK | Recommendation scoring becomes profile-aware, tunable, and tested. Logical direction is good; watch cache invalidation/config drift but no blocker found. |
| 2 | `3ab9fab` | OK | Provider coverage confidence cleanup removes dead matching code and adds integrity tests. Good maintainability improvement; provider data warnings still remain at audit level. |
| 3 | `e1254e3` | OK | Stripe webhook state transitions get event ordering/state hardening. Adds `lastStripeEvent` style guard. Good, and tests cover core billing transitions. |
| 4 | `c3ff31d` | OK | Login brute-force and enumeration hardening is sensible. Uses shared rate-limit policy tests. No obvious system conflict found. |
| 5 | `1173f4e` | OK | Moving migration endpoint validation/hardening is narrow and appropriate. Low integration risk. |
| 6 | `55223ca` | OK, later gap | Services/address consistency hardening is good for user-scoped model. Later workspace work does not fully extend this to workspace-scoped data, causing P1 isolation gap. |
| 7 | `1333da6` | OK, later gap | Budget consistency hardening is good locally. Same later issue: workspace mode still leaves budget primarily user-scoped. |
| 8 | `44c1573` | OK | Bounds and orders destination provider scan. Good defensive/performance fix. |
| 9 | `22015f0` | OK | Custom provider consistency hardening with tests. Fits system behavior. |
| 10 | `b499552` | OK | Moving plan deletion consistency improved with tests. No blocker found. |
| 11 | `85721f9` | OK | Notification digest/reminder config validation on write is correct and reduces bad state. |
| 12 | `e1b3dc7` | OK | Sensitive profile data cleared when consent is withdrawn. Good privacy direction and tests included. |
| 13 | `18475b0` | OK | Onboarding progress endpoint gets rate limit. Small, correct hardening. |
| 14 | `ad63b75` | OK | Comment correction only. No behavior risk. |
| 15 | `e0d632e` | OK | Push register/unregister rate limits added. Correct abuse-control change. |
| 16 | `9b0f97a` | OK | Locale preference endpoint rate-limited with tests. Correct. |
| 17 | `039bc0f` | OK | Admin UX clarity and confirmations improve safety. Later a11y fixes build on this. |
| 18 | `5b5cdc2` | OK | Blog new-post data-loss fix and SEO enrichment. Seems logically contained. |
| 19 | `9d7e838` | RISK | Large connector/workspace foundation commit. Good primitives and tests, but it introduces declared-not-enforced connector rate limits, USPS null-origin risk, and broad workspace migration surface that needs later isolation hardening. |
| 20 | `cf9e965` | RISK | Adds web/admin/mobile connector and workspace APIs. Major useful surface, but initial workspace APIs lack workspace count cap, invitation concurrency protection, and full domain-data isolation. |
| 21 | `d9f9468` | OK | Marks Workspace as soft-delete model. Correct and necessary, though later completeness fixes were still required. |
| 22 | `e71462e` | OK | SEO blog system and billing/auth/provider fixes. Mixed commit but no blocker found; Stripe source-of-truth direction is good. |
| 23 | `f4c085d` | OK | Admin hardening, billing metrics, privacy redaction, MFA, audits. Broad but security-positive; tests included for billing/privacy pieces. |
| 24 | `3e3425e` | OK | Mobile MFA/sign-in and dead-code cleanup. Removes unused hooks and improves error states; no system-level issue found. |
| 25 | `aeb84ce` | OK | Recommendation/runtime-config/blog seed fixes. Large seed update but reasonable; runtime config tests help. |
| 26 | `9ac21e9` | OK | Workspace plan feature and seat matrix. Good shared abstraction; later enforcement gaps are not here but in route integration. |
| 27 | `c321cfe` | OK | Connections settings page. UI-only surface mostly fine. |
| 28 | `9bc2deb` | OK | DELETE content-type fix. Correct small API compatibility fix. |
| 29 | `b7c64cc` | RISK | Workspace-authorized sync trigger added. Direction is right, but final code has null `workspaceId` bypass risk and needs stricter workspace-data binding. |
| 30 | `24e060c` | OK | Invitation accept page with explicit consent. Good UX/consent direction. |
| 31 | `89930f5` | OK | Adds `managedSyncEnabled` consent column. Correct data-model addition. |
| 32 | `333eeb1` | RISK | Managed sync on behalf of consenting members. Good permission concept, but depends on workspace isolation and target-address binding being stricter. |
| 33 | `97d5256` | OK | Invite link points to correct accept page. Correct. |
| 34 | `5706c4c` | RISK | Workspace management page and route polish. Useful feature, but UI role options and create-workspace cap/seat model still need tightening. |
| 35 | `da2a3a9` | OK | Workspace invitation emails. Good; later localization/sanitization improves it. |
| 36 | `65638f0` | OK | Feature-gated families/teams homepage copy. Safe due to flagging. |
| 37 | `4f16bb5` | OK | Tests for workspace sync authz and managed-sync consent. Strong positive, but missing cases for null `workspaceId` and entitlement bypass. |
| 38 | `0b51802` | OK | Tests member role-change/removal authz. Good, but does not cover post-removal overflow reconciliation. |
| 39 | `c01a7a5` | OK | Feature-gated address-sync homepage section. Safe marketing/UI change. |
| 40 | `30ddb04` | OK | Mobile native invite deep-link accept screen. Good platform coverage; no blocker found. |
| 41 | `10ae6ea` | OK with hardening note | Re-enforces egress allowlist on redirects. Correct SSRF fix. Remaining improvement: strip Authorization on cross-origin allowed redirects. |
| 42 | `4ec2195` | OK | Enforces suspended gate on workspace mutation routes. Correct authorization hardening. |
| 43 | `5c8448f` | OK, incomplete lifecycle | Atomic dispatch claim prevents double-send. Correct fix, but final system still needs stale `DISPATCHING` recovery. |
| 44 | `138804d` | OK, incomplete | Gates connectors on plan entitlement and binds sync to workspace. Good, but auto-sync path introduced later is not fully covered by this centralization. |
| 45 | `d740495` | OK | Access vs refresh token split and in-band refresh. Good security/data-model improvement. |
| 46 | `00aea2f` | OK | Honors control-plane stage/rollout/circuit at runtime. Correct operational safety improvement. |
| 47 | `9442fc3` | RISK | Personal workspace provisioning for new signups is logical. Needs owner workspace-count/cap policy to avoid seat-limit bypass when combined with create route. |
| 48 | `1243836` | OK | Notifies user when sync needs action. Good visibility; helps prevent silent connector failure. |
| 49 | `01c9e2c` | OK | Ownership transfer and owner deletion unblock. Good lifecycle feature; later notification/test commits strengthen it. |
| 50 | `ee3716c` | OK, incomplete lifecycle | Registers dispatch cron so outbox drains. Correct, but not enough without stale-dispatch recovery. |
| 51 | `632809f` | RISK | Primary-address auto-sync and manual Sync button. Useful UX, but introduces/keeps entitlement bypass path and USPS null-origin queue risk. |
| 52 | `73b45bb` | RISK | Seat overflow/read-only enforcement and plan-change reconciliation. Core idea is sound, but removal/leave reconciliation and concurrency protections are missing. |
| 53 | `8f7d189` | OK with hardening note | Cancels dispatches on revoke and improves abort/sanitization behavior. Good. Remaining redirect-header note still applies. |
| 54 | `3616f8d` | OK | In-app notifications for membership lifecycle. Good user feedback. |
| 55 | `00ee1d2` | OK | Workspace soft-delete purge cron and UI error states. Correct direction; cron auth is later unified. |
| 56 | `b46e6c6` | OK | Mobile workspace management screen. Good feature coverage; backend risks are elsewhere. |
| 57 | `c6c4085` | OK, incomplete ops | Admin connector dispatch-health observability and bulk-revoke token fix. Useful, but observability does not replace stale-dispatch recovery. |
| 58 | `478f05f` | OK | Homepage copy corrected to coordination-only data model. Good product accuracy fix. |
| 59 | `1494c52` | OK | Workspace member/invite network-error toasts. Good UX resilience. |
| 60 | `ba8d253` | OK | ES localization for workspace invitation email. Good i18n addition. |
| 61 | `4e36d02` | OK | FAMILY/PRO BillingPlan cascade. Good shared billing-model evolution with tests. |
| 62 | `b494e0c` | OK | Admin nav simplification via section tabs. Good usability change. |
| 63 | `08b3198` | OK | Replaces prompt-based provider bulk edits with proper controls. Good admin safety improvement. |
| 64 | `0ebb314` | RISK | Family/Pro Stripe checkout support. Core direction is right, but existing subscription rows are not fully normalized to intended pending target plan/provider. |
| 65 | `3d4622a` | OK | Pricing page surfaces Family/Pro tiers. Marketing/UI is coherent with billing additions. |
| 66 | `b579963` | OK | Sentry server init and request-error wiring. Good observability fix. Later PII scrub improves safety. |
| 67 | `7895b6d` | OK | Provider list error/retry state. Good UX resilience. |
| 68 | `e79760f` | OK | Mobile Family/Pro upgrade routes to web instead of wrong individual purchase. Correct platform behavior. |
| 69 | `e22cfa0` | OK | Reconciles seats on every owner plan change. Good fix; still needs member removal/leave reconciliation. |
| 70 | `941b81a` | OK | Notification taxonomy/icons/toggles for workspace/connector types. Good product polish. |
| 71 | `47e9b92` | OK | Adds hot-path DB indexes. Good performance change; migration is small and clear. |
| 72 | `21a0f5e` | OK | Admin boundaries and accessible ConfirmDialog. Good accessibility/resilience fix. |
| 73 | `957e622` | OK | GDPR export includes workspace context. Correct privacy/compliance improvement. |
| 74 | `400aea2` | OK, incomplete | Gates connector OAuth/sync to active annual Pro. Good entitlement rule, but final auto-sync enqueue path still needs centralized enforcement. |
| 75 | `4c8ebbf` | RISK | In-app plan change endpoint. Good upgrade/downgrade flow, but scheduled pending downgrade state is not fully persisted/displayed. |
| 76 | `11a58a0` | RISK | Plan switcher UI. Good UX, but inherits pending-plan visibility limitation from endpoint/data model. |
| 77 | `51f7bb3` | OK, incomplete | Enforces read-only gate on leave/restore/revoke and fixes invite email language. Good hardening, but leave/remove still needs seat reconciliation after deleting membership. |
| 78 | `e3fc2fe` | OK | Prevents destroying member data when owner deletes. Correct data-safety improvement. |
| 79 | `ff6240e` | OK | Ownership-transfer notifications. Good lifecycle communication. |
| 80 | `949b217` | OK | Notifications when seats demote/restore. Good; depends on reconciliation being triggered in all right places. |
| 81 | `cf9decd` | OK, incomplete | Role-change/removal emails and invite duplicate 409 handling. Good UX/API behavior; removal should also reconcile overflow seats. |
| 82 | `1a0dd88` | OK | Notifies inherited owner on owner deletion. Good lifecycle closure. |
| 83 | `7d22afe` | OK | Household setup rename API and new-owner onboarding. Good feature completion; route tests added. |
| 84 | `958951d` | OK | Sweeps exact `INDIVIDUAL` assumptions mishandling Family/Pro. Correct compatibility fix. |
| 85 | `a45dbb9` | OK | Flag-gated COPPA minimum-age registration gate. Good compliance-oriented feature, safe because flag-gated. |
| 86 | `9e3cc0a` | OK, incomplete | Guardian-consent gate for CHILD invite. Good policy check; invitation concurrency/seat race still separate issue. |
| 87 | `0b1229d` | OK | Aligns session-fingerprint IP with rate-limit resolver. Good consistency/security fix. |
| 88 | `7310045` | OK | Soft-delete completeness: updateMany filtering and cron relation guard. Correct hardening. |
| 89 | `e37617d` | OK, incomplete ops | Cron auth unified and orphaned jobs registered in Ofelia. Good operational fix; connector stale-dispatch recovery still not present. |
| 90 | `cb1a810` | OK | Scrubs free-text PII in errors/logs. Good observability privacy fix. |
| 91 | `6b601b8` | OK | Registers Family/Pro Stripe price keys in runtime-config catalog. Required config completeness. |
| 92 | `13106ee` | OK | Email-template double-submit guard. Good admin UX/data-safety fix. |
| 93 | `7fa128c` | OK | Shared web Dialog accessibility fix. Good a11y foundation improvement. |
| 94 | `4564c6c` | OK | Removes duplicate T-Mobile seed row. Correct data cleanup. |
| 95 | `4324aba` | OK | Confirms wide-scope provider bulk changes. Good admin safety improvement. |
| 96 | `d82fa5c` | OK | Adds dialog semantics and Escape behavior to raw admin modals. Good accessibility fix. |
| 97 | `85691b6` | OK | Address autocomplete keyboard and combobox semantics. Good a11y/UX fix. |
| 98 | `da7a3d0` | OK, more tests needed | Adds invitation accept and ownership transfer tests. Good coverage, but still missing tests for workspace isolation, concurrent seats, auto-sync entitlement, and stale dispatch recovery. |

## Overall judgement

The branch is architecturally moving in a good direction: feature flags, shared entitlement modules, OAuth/connector primitives, workspace lifecycle APIs, billing plan expansion, notification taxonomy, and a11y/admin hardening are all reasonable.

However, the branch is not merge-ready for production until the P1/P2 items above are fixed. The biggest issue is not syntax or basic tests; it is cross-feature integration: workspace scope, billing entitlement, connector dispatch, and seat accounting do not yet form one consistently enforced system.

