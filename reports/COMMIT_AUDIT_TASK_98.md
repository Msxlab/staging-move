# Task: Review all 98 commits in `feat/connector-and-workspace-foundation`

Status: completed

Branch under review: `origin/feat/connector-and-workspace-foundation`
Base: `origin/main`
Range: `origin/main..origin/feat/connector-and-workspace-foundation`
Commit count: 98

## Acceptance criteria

- Review every commit as its own task item.
- For each commit, check intent, system fit, data/security risk, UX/product impact where relevant, and test/coverage signal.
- Report merge-blocking and non-blocking issues separately.
- Verify the final integrated branch with available automated checks.

## Verification on final branch

- `pnpm verify:typecheck`: passed
- `pnpm verify:tests`: passed
- `pnpm audit:providers`: passed with existing data-quality warnings
- `pnpm audit:providers:coverage`: passed
- `pnpm audit:providers:state-completeness`: passed
- `git diff --check origin/main...origin/feat/connector-and-workspace-foundation`: clean

Note: I reviewed each commit's changed files, intent, and integrated behavior. I did not check out and run the full test suite on each historical commit snapshot one by one; tests were run on the final branch state.

## Merge-blocking findings

- P1: Workspace isolation is incomplete. Address/service/budget APIs remain mostly user-scoped and create rows without `workspaceId`, while workspace sync allows null `workspaceId` addresses through.
- P1: Workspace creation is not capped per owner/plan, so seat limits can be bypassed by creating multiple workspaces.
- P1: Primary-address auto-sync can enqueue connector work without the same annual-Pro entitlement check used by manual/OAuth paths.
- P1/P2: Connector manifest rate limits are declared but not enforced.
- P2: Member remove/leave does not trigger overflow-seat reconciliation.
- P2: Invitation seat checks are count-then-create and race-prone under concurrency.
- P2: Connector dispatch can remain stuck in `DISPATCHING`; no stale recovery sweep was found.
- P2: USPS can be queued without a source/old address.
- P2/P3: Scheduled downgrade state persists pending interval, not the full pending plan.
- P3: Existing checkout subscription rows are not fully normalized while pending checkout.
- P3: Workspace invite UI can expose ADMIN role to admins, although backend rejects that role for non-owners.
- P3: Connector redirect handling should drop Authorization on cross-origin redirects, even when host is allowlisted.

## Commit tasks

- [x] 01 `85572fa` - Make recommendation scoring profile-aware, tunable, and cache-backed
  - Intent: improve recommendation quality and configurability.
  - System fit: good; adds shared engine/runtime config and web recommendation integration.
  - Risk/tests: tested; no blocker. Watch cache/config drift over time.

- [x] 02 `3ab9fab` - Tighten provider coverage confidence and prune dead matching code
  - Intent: make provider coverage more trustworthy and remove unused matching code.
  - System fit: good; improves provider metadata integrity and matching tests.
  - Risk/tests: tested; provider audit still reports data-quality warnings, but not a merge blocker by itself.

- [x] 03 `e1254e3` - Harden Stripe webhook billing state transitions
  - Intent: prevent stale/out-of-order Stripe events from corrupting subscription state.
  - System fit: good; billing source-of-truth direction is correct.
  - Risk/tests: tested; no blocker found.

- [x] 04 `c3ff31d` - Harden login brute-force protection and close enumeration oracle
  - Intent: reduce login abuse and user enumeration.
  - System fit: good; aligns auth and rate-limit policy.
  - Risk/tests: tested; no blocker found.

- [x] 05 `1173f4e` - Harden moving migration analysis endpoint
  - Intent: strengthen moving migration endpoint validation.
  - System fit: good; narrow endpoint hardening.
  - Risk/tests: low risk; no blocker found.

- [x] 06 `55223ca` - Harden services & addresses data consistency
  - Intent: improve user-scoped address/service consistency.
  - System fit: good for the pre-workspace model.
  - Risk/tests: tested; later workspace changes must extend this to `workspaceId` or isolation breaks.

- [x] 07 `1333da6` - Harden budget data consistency
  - Intent: improve budget consistency and address relation behavior.
  - System fit: good for user-scoped budget.
  - Risk/tests: tested; later workspace model still needs budget scoping.

- [x] 08 `44c1573` - Bound and order move-task destination provider scan
  - Intent: cap and stabilize provider scan work.
  - System fit: good; performance/ordering improvement.
  - Risk/tests: low risk; no blocker found.

- [x] 09 `22015f0` - Harden custom provider data consistency
  - Intent: protect custom provider update/delete consistency.
  - System fit: good.
  - Risk/tests: tested; no blocker found.

- [x] 10 `b499552` - Harden moving plan deletion data consistency
  - Intent: make moving plan deletion safer.
  - System fit: good.
  - Risk/tests: tested; no blocker found.

- [x] 11 `85721f9` - Validate notification digest/reminder config on write
  - Intent: prevent invalid notification preference state.
  - System fit: good; shared preference validation is appropriate.
  - Risk/tests: tested; no blocker found.

- [x] 12 `e1b3dc7` - Clear sensitive profile data when SENSITIVE consent is withdrawn
  - Intent: enforce privacy consent withdrawal.
  - System fit: strong; matches data minimization expectations.
  - Risk/tests: tested; no blocker found.

- [x] 13 `18475b0` - Rate-limit the onboarding progress endpoint
  - Intent: abuse protection.
  - System fit: good.
  - Risk/tests: tested; no blocker found.

- [x] 14 `ad63b75` - Correct misleading idempotency comment in acquisition redeem
  - Intent: documentation/comment correctness.
  - System fit: neutral.
  - Risk/tests: no behavior risk.

- [x] 15 `e0d632e` - Rate-limit push device register/unregister
  - Intent: abuse protection for push endpoints.
  - System fit: good.
  - Risk/tests: tested; no blocker found.

- [x] 16 `9b0f97a` - Rate-limit the locale preference endpoint
  - Intent: abuse protection for preference writes.
  - System fit: good.
  - Risk/tests: tested; no blocker found.

- [x] 17 `039bc0f` - Improve admin UX clarity and confirmations
  - Intent: reduce risky admin actions and clarify UI.
  - System fit: good; introduces reusable confirm/info primitives.
  - Risk/tests: UI change; later a11y commits improve this further.

- [x] 18 `5b5cdc2` - Fix blog new-post data loss and enrich article SEO
  - Intent: prevent editor data loss and improve SEO.
  - System fit: good; scoped to blog/admin editor.
  - Risk/tests: no blocker found.

- [x] 19 `9d7e838` - connector framework + Family/Pro data layer
  - Intent: add connector package, dispatcher primitives, USPS adapter, workspace schema, and permissions foundation.
  - System fit: direction is good, but this is a high-blast-radius foundation commit.
  - Risk/tests: core tests are present. Risks introduced/left: declared connector rate limits not enforced, USPS can receive null old-address input, workspace migration needs stricter domain scoping.

- [x] 20 `cf9e965` - connector + workspace API surfaces & UI
  - Intent: expose connector/admin/mobile/workspace APIs and UI surfaces.
  - System fit: necessary product layer over the foundation.
  - Risk/tests: high-risk integration commit. Workspace creation cap, invitation concurrency, domain-data isolation, and dispatch recovery are not fully solved.

- [x] 21 `d9f9468` - mark Workspace as a soft-delete model
  - Intent: include Workspace in soft-delete behavior.
  - System fit: correct.
  - Risk/tests: small, good. Later soft-delete completeness fixes build on it.

- [x] 22 `e71462e` - SEO blog system, billing source-of-truth, provider/auth fixes
  - Intent: SEO/blog expansion plus billing/auth/provider fixes.
  - System fit: generally good, though broad.
  - Risk/tests: mapping tests included; no blocker found.

- [x] 23 `f4c085d` - admin hardening, billing metrics, privacy redaction, MFA, audits
  - Intent: harden admin operations and reporting.
  - System fit: good; improves admin security and observability.
  - Risk/tests: tested for billing/privacy; no blocker found.

- [x] 24 `3e3425e` - mobile MFA sign-in, dead-code cleanup, list error states
  - Intent: improve mobile auth and remove unused hooks.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 25 `aeb84ce` - recommendation engine + runtime config + blog seed
  - Intent: fix shared recommendation/runtime config and seed content.
  - System fit: good.
  - Risk/tests: runtime-config tests present; no blocker found.

- [x] 26 `9ac21e9` - workspace plan feature + seat matrix
  - Intent: centralize workspace plan entitlements and seat limits.
  - System fit: good shared abstraction.
  - Risk/tests: tested. Route-level enforcement gaps appear later, not in the abstraction itself.

- [x] 27 `c321cfe` - connections settings page
  - Intent: user-facing connector connections UI.
  - System fit: good.
  - Risk/tests: UI only; no blocker found.

- [x] 28 `9bc2deb` - send application/json on connections disconnect DELETE
  - Intent: API compatibility fix.
  - System fit: good.
  - Risk/tests: small correct fix.

- [x] 29 `b7c64cc` - workspace-authorized connector sync trigger
  - Intent: allow workspace-authorized sync trigger.
  - System fit: useful, but relies on strict workspace/address binding.
  - Risk/tests: high-risk gap remains: null `workspaceId` address can bypass workspace match.

- [x] 30 `24e060c` - workspace invitation accept page
  - Intent: explicit consent UX for accepting invitations.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 31 `89930f5` - WorkspaceMember.managedSyncEnabled consent column
  - Intent: store managed-sync consent explicitly.
  - System fit: good; correct data-model approach.
  - Risk/tests: migration is small; no blocker found.

- [x] 32 `333eeb1` - managed sync on behalf of consenting members
  - Intent: let authorized managers sync for consenting members.
  - System fit: product logic is reasonable.
  - Risk/tests: tests exist, but safety depends on workspace/data isolation and entitlement checks being strict everywhere.

- [x] 33 `97d5256` - point invite link at the /invitations accept page
  - Intent: route fix.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 34 `5706c4c` - workspace members management page
  - Intent: workspace management UI and route polish.
  - System fit: good user-facing completion.
  - Risk/tests: UI can expose ADMIN role to admins though backend rejects it; workspace create route still lacks cap.

- [x] 35 `da2a3a9` - send workspace invitation emails
  - Intent: email delivery for invitations.
  - System fit: good.
  - Risk/tests: no blocker found; later localization/sanitization improves it.

- [x] 36 `65638f0` - flag-gated families & teams section on homepage
  - Intent: feature-gated marketing copy.
  - System fit: safe due to flag.
  - Risk/tests: no blocker found.

- [x] 37 `4f16bb5` - tests for workspace sync authz + managed-sync consent
  - Intent: cover high-risk workspace sync authz paths.
  - System fit: very good.
  - Risk/tests: still missing tests for null `workspaceId` and auto-sync entitlement.

- [x] 38 `0b51802` - tests for member role-change + removal authorization
  - Intent: cover role/removal authorization.
  - System fit: good.
  - Risk/tests: missing post-removal overflow-seat reconciliation case.

- [x] 39 `c01a7a5` - flag-gated address-sync section on homepage
  - Intent: marketing/UI surface for connectors.
  - System fit: safe due to flag.
  - Risk/tests: no blocker found.

- [x] 40 `30ddb04` - native invite deep-link accept screen
  - Intent: mobile deep-link invitation acceptance.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 41 `10ae6ea` - re-enforce egress allowlist on redirects
  - Intent: close SSRF/token-leak redirect path.
  - System fit: strong security fix.
  - Risk/tests: tests added. Remaining hardening: drop auth headers on cross-origin allowed redirects.

- [x] 42 `4ec2195` - enforce SUSPENDED gate on workspace mutation routes
  - Intent: block suspended workspaces from mutation.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 43 `5c8448f` - atomic dispatch claim to prevent double-send
  - Intent: avoid duplicate connector sends.
  - System fit: good concurrency fix.
  - Risk/tests: incomplete lifecycle: no stale `DISPATCHING` recovery found.

- [x] 44 `138804d` - gate connectors on plan entitlement + bind sync to workspace
  - Intent: enforce entitlement and workspace binding.
  - System fit: right direction.
  - Risk/tests: tests added. Later address auto-sync path is not fully covered by the same entitlement enforcement.

- [x] 45 `d740495` - split access vs refresh token + in-band refresh
  - Intent: improve connector credential handling.
  - System fit: good security improvement.
  - Risk/tests: migration included; no blocker found.

- [x] 46 `00aea2f` - honor control-plane stage/rollout/circuit at runtime
  - Intent: make dispatch respect operational controls.
  - System fit: good production-safety feature.
  - Risk/tests: no blocker found.

- [x] 47 `9442fc3` - provision a personal workspace for new signups
  - Intent: create default workspace for new users.
  - System fit: good product direction.
  - Risk/tests: needs plan/workspace-count policy so users cannot create unlimited workspaces.

- [x] 48 `1243836` - notify user when sync needs action
  - Intent: prevent silent connector failures.
  - System fit: good UX/ops feedback.
  - Risk/tests: no blocker found.

- [x] 49 `01c9e2c` - workspace ownership transfer + owner deletion unblock
  - Intent: make ownership lifecycle workable.
  - System fit: good.
  - Risk/tests: later tests/notifications improve this; no blocker found in concept.

- [x] 50 `ee3716c` - register dispatch cron so outbox drains
  - Intent: make connector dispatch actually run.
  - System fit: necessary ops fix.
  - Risk/tests: still needs stale-dispatch recovery beyond cron registration.

- [x] 51 `632809f` - primary-address auto-sync + manual Sync button
  - Intent: make sync user-triggered/automatic from address changes.
  - System fit: useful UX.
  - Risk/tests: P1/P2 risk: auto-sync bypasses annual-Pro entitlement path and can queue USPS without source address.

- [x] 52 `73b45bb` - seat overflow read-only + reconcile on plan change
  - Intent: enforce workspace seat limits.
  - System fit: core idea is correct.
  - Risk/tests: removal/leave should trigger reconciliation; invite/accept concurrency remains race-prone.

- [x] 53 `8f7d189` - cancel dispatches on revoke + abort handling + invite subject sanitize
  - Intent: cleanup pending dispatches and improve safety.
  - System fit: good.
  - Risk/tests: no blocker, but redirect auth-header hardening still recommended.

- [x] 54 `3616f8d` - in-app notifications for membership lifecycle
  - Intent: notify users of membership events.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 55 `00ee1d2` - workspace soft-delete purge cron + UI error states
  - Intent: purge soft-deleted workspaces and improve UI failures.
  - System fit: good.
  - Risk/tests: cron auth later improved; no blocker found here.

- [x] 56 `b46e6c6` - mobile workspace management screen
  - Intent: mobile parity for workspace management.
  - System fit: good.
  - Risk/tests: backend risks are separate; no mobile-specific blocker found.

- [x] 57 `c6c4085` - admin dispatch-health observability + bulk-revoke token fix
  - Intent: improve connector admin visibility and revoke behavior.
  - System fit: good.
  - Risk/tests: observability is useful but does not solve stale dispatch recovery.

- [x] 58 `478f05f` - homepage family copy matches coordination-only data model
  - Intent: align marketing copy with actual data model.
  - System fit: good product accuracy fix.
  - Risk/tests: no blocker found.

- [x] 59 `1494c52` - toast on network error in workspace actions
  - Intent: improve workspace UI error feedback.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 60 `ba8d253` - localize workspace invitation email
  - Intent: Spanish email localization.
  - System fit: good i18n addition.
  - Risk/tests: no blocker found.

- [x] 61 `4e36d02` - FAMILY/PRO BillingPlan cascade
  - Intent: extend billing plan model across web/admin/shared.
  - System fit: good; centralizes Family/Pro plan handling.
  - Risk/tests: tests included; no blocker found.

- [x] 62 `b494e0c` - simplify admin nav
  - Intent: reduce sidebar complexity via section tabs.
  - System fit: good admin UX.
  - Risk/tests: no blocker found.

- [x] 63 `08b3198` - replace prompt-based provider bulk edits
  - Intent: safer admin bulk-edit controls.
  - System fit: good.
  - Risk/tests: no blocker found; later wide-scope confirm strengthens this.

- [x] 64 `0ebb314` - accept Family/Pro in Stripe checkout
  - Intent: self-serve Family/Pro checkout.
  - System fit: correct direction.
  - Risk/tests: tests present. Existing subscription rows should be normalized to target plan/provider while pending checkout.

- [x] 65 `3d4622a` - surface Family & Pro tiers on pricing page
  - Intent: expose new plan tiers.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 66 `b579963` - Sentry server init + onRequestError
  - Intent: improve server-side error capture.
  - System fit: good.
  - Risk/tests: no blocker; later PII scrub is important.

- [x] 67 `7895b6d` - providers list error+retry state
  - Intent: improve provider list resilience.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 68 `e79760f` - mobile Family/Pro upgrade goes to web
  - Intent: avoid wrong mobile purchase flow for Family/Pro.
  - System fit: good platform behavior.
  - Risk/tests: no blocker found.

- [x] 69 `e22cfa0` - reconcile seats on every owner plan change
  - Intent: catch all owner billing state transitions for seat reconciliation.
  - System fit: good fix.
  - Risk/tests: tests added. Still missing reconciliation after member leave/remove.

- [x] 70 `941b81a` - notification taxonomy + icons + toggles
  - Intent: organize notification types for workspace/connector events.
  - System fit: good product polish.
  - Risk/tests: no blocker found.

- [x] 71 `47e9b92` - index hot audit-log + reminder-cron query paths
  - Intent: DB performance improvement.
  - System fit: good.
  - Risk/tests: small migration; no blocker found.

- [x] 72 `21a0f5e` - admin boundaries + accessible ConfirmDialog
  - Intent: improve admin error boundaries and dialog accessibility.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 73 `957e622` - include workspace context in GDPR export
  - Intent: export workspace context for privacy/compliance.
  - System fit: good.
  - Risk/tests: tests added; no blocker found.

- [x] 74 `400aea2` - gate API connectors to active annual Pro
  - Intent: enforce commercial entitlement for connectors.
  - System fit: correct rule.
  - Risk/tests: OAuth tests added. Needs centralized enforcement so auto-sync enqueue cannot bypass it.

- [x] 75 `4c8ebbf` - in-app plan change endpoint
  - Intent: support graceful upgrade/downgrade in app.
  - System fit: good billing UX.
  - Risk/tests: tests added. Pending downgrade needs full pending plan persisted/displayed, not just interval.

- [x] 76 `11a58a0` - in-app plan switcher
  - Intent: expose plan changes in settings.
  - System fit: good.
  - Risk/tests: inherits pending-plan visibility limitation.

- [x] 77 `51f7bb3` - read-only gate on leave/restore/revoke + invite email language
  - Intent: prevent read-only members from mutating restricted flows.
  - System fit: good hardening.
  - Risk/tests: after leave/remove, overflow-seat reconciliation should run.

- [x] 78 `e3fc2fe` - never destroy member data when owner deletes
  - Intent: preserve member-owned data.
  - System fit: strong data-safety fix.
  - Risk/tests: tests updated; no blocker found.

- [x] 79 `ff6240e` - notify on ownership transfer
  - Intent: make ownership transfer visible.
  - System fit: good lifecycle UX.
  - Risk/tests: no blocker found.

- [x] 80 `949b217` - notify members when seats demote/restore
  - Intent: communicate seat-status changes.
  - System fit: good.
  - Risk/tests: works when reconciliation is triggered; more triggers needed.

- [x] 81 `cf9decd` - role-change/removal emails + invite P2002 to 409
  - Intent: improve API correctness and lifecycle emails.
  - System fit: good.
  - Risk/tests: removal path should also reconcile seats.

- [x] 82 `1a0dd88` - notify heir who inherits ownership
  - Intent: close owner deletion notification gap.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 83 `7d22afe` - household setup rename API + new-owner onboarding
  - Intent: improve workspace onboarding/rename flow.
  - System fit: good.
  - Risk/tests: route tests added; no blocker found.

- [x] 84 `958951d` - sweep exact-match INDIVIDUAL sites
  - Intent: fix Family/Pro compatibility where code assumed only Individual.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 85 `a45dbb9` - COPPA minimum-age gate
  - Intent: flag-gated age compliance at registration.
  - System fit: good and safely flag-gated.
  - Risk/tests: tests added; no blocker found.

- [x] 86 `9e3cc0a` - guardian-consent gate for CHILD invite
  - Intent: require guardian consent for child invitations.
  - System fit: good policy control.
  - Risk/tests: no blocker in policy logic; invitation concurrency remains separate.

- [x] 87 `0b1229d` - align session-fingerprint IP with rate-limit resolver
  - Intent: make IP derivation consistent.
  - System fit: good auth/rate-limit hardening.
  - Risk/tests: no blocker found.

- [x] 88 `7310045` - soft-delete completeness
  - Intent: cover updateMany filtering and cron relation guard.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 89 `e37617d` - unify cron auth + Ofelia jobs
  - Intent: standardize cron auth and ensure jobs are registered.
  - System fit: good ops fix.
  - Risk/tests: no blocker; dispatch stale recovery still missing.

- [x] 90 `cb1a810` - scrub free-text PII in errors/logs
  - Intent: reduce PII leakage in observability.
  - System fit: strong privacy/security improvement.
  - Risk/tests: no blocker found.

- [x] 91 `6b601b8` - register Family/Pro Stripe price keys
  - Intent: add runtime-config entries for new plan prices.
  - System fit: necessary config completeness.
  - Risk/tests: no blocker found.

- [x] 92 `13106ee` - email-template double-submit guard
  - Intent: prevent duplicate admin saves.
  - System fit: good UI/data-safety fix.
  - Risk/tests: no blocker found.

- [x] 93 `7fa128c` - shared web Dialog accessibility
  - Intent: improve dialog primitive semantics.
  - System fit: good a11y foundation.
  - Risk/tests: no blocker found.

- [x] 94 `4564c6c` - drop duplicate T-Mobile seed row
  - Intent: seed data cleanup.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 95 `4324aba` - confirm wide-scope provider bulk changes
  - Intent: protect admins from broad accidental edits.
  - System fit: good admin safety improvement.
  - Risk/tests: no blocker found.

- [x] 96 `d82fa5c` - raw admin modal dialog semantics + Escape
  - Intent: improve accessibility and expected keyboard behavior.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 97 `85691b6` - address autocomplete combobox keyboard semantics
  - Intent: improve address autocomplete accessibility.
  - System fit: good.
  - Risk/tests: no blocker found.

- [x] 98 `da7a3d0` - invitation accept + ownership transfer tests
  - Intent: add coverage for important workspace flows.
  - System fit: good.
  - Risk/tests: more tests are still needed for workspace isolation, concurrent seats, auto-sync entitlement, and stale dispatch recovery.

## Final judgement

The branch is a serious and mostly coherent foundation for connectors, workspaces, Family/Pro billing, and admin/mobile/web support. The code quality signal is positive because typecheck and tests pass and many security/a11y/data-safety fixes are included.

The branch should not be merged to production yet. The remaining blockers are integration-level issues: workspace scoping, entitlement centralization, seat accounting, connector queue lifecycle, and rate-limit enforcement. These are exactly the kinds of bugs that do not always fail unit tests but can break real multi-user production behavior.

