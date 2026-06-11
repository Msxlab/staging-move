# LocateFlow Last 30 Commits Detailed Code Review - 2026-06-05

Scope: full code, architecture, security, operations, UI/UX, mobile, billing, connector, and docs review for the last 30 commits on `codex/release-readiness-mobile-billing-guards`. This review was performed from the repository state and fresh local/live commands, not from memory.

## Audited Range

- Branch: `codex/release-readiness-mobile-billing-guards`
- Range: `HEAD~30..HEAD`
- Base: `7acfacac`
- Head: `4cd466e7fe21ab16c7b7e3291bf0837d98cea0f9`
- Origin head at review time: `af17b8488820aed85d6c74c39f282ec04c8d3292`
- Local branch state: ahead of origin by 2 commits:
  - `bb4b41d feat(connectors): connector SDK - contract test kit + scaffolding generator`
  - `4cd466e docs(strategy): full QA checklist + partner onboarding runbook`
- Diff size: 126 files, 5,953 insertions, 775 deletions.

## Executive Verdict

The 30-commit set is broadly sensible, internally coherent, and safe to keep. I did not find a critical or high-confidence exploitable production security vulnerability in the application code.

The strongest parts of the change set are the payment-state fixes, SHADOW connector isolation, fallback URL validation/audit logging, timeline data scoping, Google Play test-purchase allowlisting, and the new connector contract test kit. The code generally follows the intended safety posture: connector features remain gated/inert, real push is separated from SHADOW, and user-facing APIs avoid exposing encrypted connector payloads.

There are still several important follow-up gaps, mostly operational and future-partner readiness rather than current launch blockers:

- The Stripe matrix script can mutate external Stripe/app state and should get explicit safety guards before reuse.
- Async connector webhooks require a second manual registry in the webhook route.
- Connector token refresh still has a race window under concurrent dispatches.
- Fallback deep links allow external `http:` links; admin-gated, but HTTPS-only would be safer.
- New metrics/history UI hides API failures behind empty states.

## Deployment / App Reflection

The app-facing UI/runtime commits up to `af17b84` appear pushed to origin and deployed. Fresh read-only checks on 2026-06-05:

- DigitalOcean app list shows active deployment `90ed0c56-22a8-4035-9942-22d1338e8218`.
- `GET https://locateflow.com/api/ready` returned HTTP 200, `ready=true`.
- `GET https://locateflow.com/api/health` returned HTTP 200, `status=healthy`.
- `GET https://locateflow.com/api/mobile/iap/products` returned HTTP 200.
- `GET https://locateflow.com/settings/address-changes` returned HTTP 307 to `/sign-in?redirect=%2Fsettings%2Faddress-changes`.
- `GET https://locateflow.com/connector-metrics` returned HTTP 307 to `/sign-in?redirect=%2Fconnector-metrics`.
- `GET https://locateflow.com/connector-fallbacks` returned HTTP 307 to `/sign-in?redirect=%2Fconnector-fallbacks`.

The latest two local commits (`bb4b41d`, `4cd466e`) are not yet on origin and therefore not deployed. They add docs, a package script, connector SDK exports/tests, and a generator script; they do not change the current customer/admin UI runtime unless pushed and redeployed.

## Findings

### F1 - P1 Operational Risk: Stripe matrix script needs stronger destructive-action guards

File: `scripts/stripe-live-plan-matrix.cjs`

The script defaults to staging, requires QA credentials and a secret file, and was useful for the Stripe plan matrix. However it can create Stripe customers/subscriptions and mutate app subscription state:

- Base URL is environment-overridable at `scripts/stripe-live-plan-matrix.cjs:6`.
- It reads QA email/password and a local secret file at `scripts/stripe-live-plan-matrix.cjs:7-11`.
- It creates Stripe customers/subscriptions at `scripts/stripe-live-plan-matrix.cjs:262-282`.
- It reads `stripeSecret` from the secret file and builds a Basic auth header at `scripts/stripe-live-plan-matrix.cjs:293-294`.

This is not a production app vulnerability, but it is a foot-gun. If someone points `LOCATEFLOW_QA_BASE_URL` or the secret file at the wrong environment, the script can create external Stripe state and write subscription metadata into a real app account. `tok_visa` limits some live-key misuse, but it is not a sufficient guardrail.

Recommendation:

- Require an explicit acknowledgement env var such as `STRIPE_MATRIX_I_UNDERSTAND_EXTERNAL_MUTATION=staging-only`.
- Refuse `https://locateflow.com` unless a separate production drill flag is present.
- Validate the secret prefix and expected mode, e.g. require `sk_test_` for the current matrix script.
- Print a preflight summary and require `--apply`; default should be dry-run.
- Add cleanup failure reporting with a nonzero exit code when created subscriptions cannot be canceled.

### F2 - P2 Architecture Gap: async webhook receiver has a separate connector map

File: `apps/web/src/app/api/connectors/[key]/webhook/route.ts`

The route is secure in its fail-closed behavior, but it has a future integration trap. It defines its own local map:

- `CONNECTORS` is hard-coded at `apps/web/src/app/api/connectors/[key]/webhook/route.ts:44-46`.
- Runtime lookup uses that map at `apps/web/src/app/api/connectors/[key]/webhook/route.ts:80-82`.

Today this is harmless because only USPS is registered and USPS does not implement `parseWebhook`, so the route correctly returns 404. But when a real async connector is added, registering it in `apps/web/src/lib/connector-registry.ts` is not enough; the developer must also remember this webhook-local map. That can lead to a connector that passes G5/contract tests and dispatches to `SUBMITTED`, but never receives live async confirmations.

Recommendation:

- Reuse the app connector registry for webhook lookup and filter by `parseWebhook`.
- Add a test that every `asyncConfirm` connector in the dispatch registry is webhook-addressable.
- Add a docs note to the generator output until the registry is unified.

### F3 - P2 Reliability/Security Gap: token refresh has no concurrency lock

File: `apps/web/src/lib/connector-oauth.ts`

`refreshConsentAccessToken` decrypts the stored refresh token, calls the partner token endpoint, and updates the consent row:

- Refresh begins at `apps/web/src/lib/connector-oauth.ts:180-193`.
- Token persistence is a single `updateMany` on status at `apps/web/src/lib/connector-oauth.ts:195-202`.

There is no per-consent lock or compare-and-swap on token version. If two dispatch workers refresh the same consent simultaneously, a provider that rotates refresh tokens can invalidate one response or let the later write overwrite a newer refresh token. Current impact is likely failed dispatch/degraded reconsent rather than data leak, because tokens remain encrypted and dispatches are idempotent, but this is still the G6 gap that should be fixed before high-volume connector rollout.

Recommendation:

- Add a small DB-backed lock or version column on `PartnerConsent`.
- Use `where: { id, status, tokenVersion }` and increment version on successful refresh.
- Treat stale update count as "another worker refreshed; reload token and continue."

### F4 - P3 Security/Trust Hardening: fallback links allow external plain HTTP

Files:

- `apps/admin/src/app/api/connector-fallbacks/route.ts`
- `apps/web/src/lib/fallback-actions.ts`

Unsafe schemes like `javascript:` are rejected and audited, which is good:

- Server URL validation lives at `apps/admin/src/app/api/connector-fallbacks/route.ts:41-48`.
- Rejection/audit path lives at `apps/admin/src/app/api/connector-fallbacks/route.ts:98-111`.
- User-facing resolver revalidates URLs at `apps/web/src/lib/fallback-actions.ts:54-62`.

However external `http:` is accepted for `DEEP_LINK` and `PDF`. Because fallback actions become user-facing buttons, accepting non-TLS links increases phishing/downgrade risk if an admin typo or compromised admin account enters a weak URL. This is not critical because only admins can write fallback rows and writes are audit-logged.

Recommendation:

- Require `https:` for external `DEEP_LINK` and `PDF`.
- Keep root-relative app links, `mailto:`, and `tel:` as-is.
- If `http:` is needed for local testing, allow only localhost/private test hostnames outside production.

### F5 - P3 UI/UX Observability: new metrics/history pages hide API failures as empty states

Files:

- `apps/admin/src/app/(admin)/connector-metrics/connector-metrics-client.tsx`
- `apps/web/src/app/(app)/settings/address-changes/page.tsx`

The admin metrics page ignores fetch failure:

- `catch(() => undefined)` at `apps/admin/src/app/(admin)/connector-metrics/connector-metrics-client.tsx:13-18`.

The address change history page converts any non-OK response into `{ changes: [] }`:

- Fetch handling at `apps/web/src/app/(app)/settings/address-changes/page.tsx:43-48`.

This is safe, but it can mislead operators/users during outages by showing "No dispatches yet" or "No address changes yet" instead of "Could not load." For release it is acceptable because the connector feature is still inert, but it should be tightened before relying on these pages operationally.

Recommendation:

- Track `error` state separately from empty state.
- For admin metrics, show API status and a retry button.
- For user history, show a calm retryable error if the API fails or auth expires.

### F6 - P3 Developer Tooling Gap: connector generator is safe but minimal

File: `scripts/new-connector.mjs`

The generator validates the key with `/^[a-z][a-z0-9-]*$/`, so path traversal through the key is blocked. It also refuses an existing connector directory. That is good.

Remaining gaps are developer-experience issues:

- It assumes the current working directory is the repo root.
- It does not update the connector registry or package barrel beyond creating the new folder.
- It does not support a dry-run/list-output mode.

Recommendation:

- Assert repo root by checking `package.json` plus `packages/connectors`.
- Add `--dry-run`.
- Optionally print exact registry/index patch instructions or support `--register`.

## Positive Findings

### Connector SHADOW isolation is well-designed

`resolveDispatchPlan` separates `LIVE`, `SHADOW`, and `SKIP` at `apps/web/src/lib/connector-runtime.ts:102-113`. Enqueue treats SHADOW as dry-run only, without API_SYNC credential/agreement requirements, while LIVE remains gated through `isApiSyncConnector` at `apps/web/src/lib/connector-runtime.ts:213-247`.

`runDispatchRow` then preserves row-level dry-run semantics even if the connector stage later changes:

- SHADOW branch at `apps/web/src/lib/connector-runtime.ts:404-423`.
- Stale SHADOW rows become internal `FAILED`, not user notifications, at `apps/web/src/lib/connector-runtime.ts:527-538`.
- Live stale dispatches and submitted rows go to `NEEDS_USER` at `apps/web/src/lib/connector-runtime.ts:540-569`.

This matches the intended "no real COA in SHADOW" posture.

### Timeline API is scoped and leak-safe

`GET /api/connectors/changes` requires a user session, filters by `userId`, excludes `isShadow` dispatches, and selects only status-oriented fields. Tests explicitly cover no encrypted payload/confirmation leakage. This is the correct privacy boundary for a user-facing address-change history.

### Fallback CRUD is permission-gated and audited

Admin fallback CRUD uses connector permissions and logs upsert/delete/rejected URL attempts. Server and client both reject unsafe protocols. The resolver falls back to code defaults if the DB row is missing, disabled, invalid, or the table is temporarily unavailable, so shipped guided flows do not regress.

### G5 / connector SDK work is coherent

The contract kit is pure and intentionally does not call partner `push` or `verify`. It checks manifest validity, capability/method coherence, deterministic `buildRequest`, egress allowlist host, and webhook parser null-safety.

The async connector tests correctly prove two contracts:

- Async push can remain `SUBMITTED` without read-back verification.
- `parseWebhook` maps an external callback to `{ ref, result }`.

This is valuable framework coverage. It is not proof of a live async partner, and the report should keep making that distinction.

### Stripe subscription fixes are appropriate

The payment commits address real correctness issues:

- Failed initial checkout invoice now persists `UNPAID`, not grace `PAST_DUE`.
- Stale pending schedule fields are cleared when Stripe sync moves to a new subscription.
- Downgrades use local period-end fallback when Stripe omits period fields.
- Stored missing interval can be recovered from price mapping.
- Flexible-billing subscription schedules use the preview API version only for schedule create/retrieve/update/release calls.

The tests cover immediate vs scheduled behavior, fallback period end, missing DB column rollback, and initial vs renewal payment failure.

### Google Play test-purchase handling is safe enough for QA

`normalizeGoogleResult` preserves a verified Google test purchase as Sandbox state, but `applyIapStateToUser` then blocks production-like test purchases unless the server-side user email is allowlisted:

- Test purchase detection at `apps/web/src/lib/iap-common.ts:428-435`.
- User/email allowlist check at `apps/web/src/lib/iap-common.ts:438-455`.
- Enforcement before upsert at `apps/web/src/lib/iap-common.ts:510-513`.

This is the right split: provider verification can normalize the state, but entitlement persistence remains gated.

### Web session IP change fix is reasonable

Web fingerprints are now UA-bound rather than IP-bound:

- New generator at `apps/web/src/lib/user-auth.ts:79-89`.
- Legacy IP-bound sessions are accepted only when the stored UA matches at `apps/web/src/lib/user-auth.ts:548-566`.

This improves real web usability. It weakens replay resistance versus IP+UA cookies, but sensitive operations still have step-up gates and DB session validation remains in place. No critical issue found.

### Mobile service logo polish is low-risk

`ServiceLogoMark` centralizes provider-logo fallback, trims URL inputs, and uses React Native `Image` with per-logo failure fallback. Tests cover provider-logo preference and accessibility fallback name. No security issue found.

### Dead reviews scaffolding removal is consistent

The reviews/admin moderation removal cleans dead routes/types/validators and removes `/community` from safe redirects. That reduces dead surface. I did not see an active dependency left in the changed code path.

## Affected Areas

- Web billing: Stripe webhook, plan change, cycle switch, subscription copy regression tests.
- Web auth: session fingerprint and legacy session handling.
- Web connectors: catalog fallback resolution, address-change history API/UI, connector runtime SHADOW accounting.
- Web IAP: Google Play test-purchase QA allowlist.
- Admin connectors: fallback CRUD API/UI, metrics dashboard, nav/i18n, backup table catalog/import.
- Connector package: dry-run executor path, async connector tests, contract test kit, scaffolding generator.
- DB schema: `AddressChangeEvent`, `ConnectorFallbackAction`, `ConnectorDispatch.isShadow`, `addressChangeEventId`.
- Mobile: service logo rendering and subscription card copy/visibility.
- Docs/reports: release readiness, store guidance, Layer-4 strategy/runbooks, full QA checklist, partner onboarding docs.

## Commit-by-Commit Review

| Commit | Area | Assessment | Remaining Notes |
|---|---|---|---|
| `2a16cd6` | Stripe webhook failed initial payments | Correct. Initial failed checkout is `UNPAID`, renewal failures stay `PAST_DUE`. | Good tests. |
| `c12f83c` | Stripe pending schedule cleanup + matrix script | Correct app fix. | Matrix script needs stronger safety guards before reuse. |
| `b0dae7e` | Stripe downgrade period fallback | Correct. Handles Stripe missing period fields. | Covered by tests. |
| `0582274` | Stripe interval from price mapping | Correct. Protects against stale/missing DB interval. | Covered by tests. |
| `9876a7e` | Stripe flexible billing API version | Correct scoped use of preview version for schedules. | Avoid broad Stripe API version changes. |
| `14b66d2` | QA/report docs | Useful evidence trail. | Script risk inherited from matrix file. |
| `fc3a31b` | Payment/store QA reports | Good documentation. | No runtime risk. |
| `f4ebb2a` | App Store resubmission docs | Good ops record. | Apple status remains external. |
| `37507a0` | Play internal upload blocker docs | Good ops record. | No runtime risk. |
| `9ce3e18` | Play build 15 release docs | Good ops record. | No runtime risk. |
| `9ed53d2` | Play install sign-in docs | Good ops record. | No runtime risk. |
| `3cfd03f` | Store console declaration guidance | Helpful. | Human/legal steps remain operator-owned. |
| `1d3058a` | Google Play test-purchase allowlist | Correct. Allows QA without opening production entitlement abuse. | Keep allowlist narrow. |
| `46b10bf` | Play Billing QA docs + mobile copy | Correct polish. | Build/update needed for binary-visible copy. |
| `2c9c253` | Move audit reports | Pure file organization. | No app risk. |
| `9b05528` | Remove dead reviews scaffolding | Sensible surface reduction. | Ensure product does not plan to revive reviews. |
| `c7727a4` | Mobile service logos | Sensible UI polish. | No image proxying; uses existing URL behavior. |
| `cba9396` | Web sessions across IP changes | Product-correct. | Slight replay-resistance tradeoff; acceptable with step-up. |
| `3531d1d` | SHADOW accounting/timeline/fallback | Strong core connector work. | HTTP fallback links and token refresh lock remain. |
| `d9d47b1` | SHADOW/fallback hardening | Good hardening and audit logging. | `http:` allowed; consider HTTPS-only. |
| `4c3b604` | Privacy mailing address | Correct legal page fix. | No risk. |
| `da3824b` | Strategy/runbooks | Useful launch/SHADOW docs. | Some checklist counts now stale after SDK tests. |
| `9f186f4` | G5 async connector tests | Correct framework contract coverage. | Not live async partner validation. |
| `9cc732c` | G5 live audit report | Good evidence trail. | No runtime risk. |
| `392e430` | Admin fallback editor UI | Useful admin tool. | Add error states and maybe stronger URL helper text. |
| `70082d3` | Metrics dashboard + address-change history UI | Good first UI. | Empty-state-on-error UX should be improved. |
| `0cba738` | Nav links | Correct discoverability improvement. | Live route protection verified. |
| `af17b84` | UI live QA report | Good evidence trail. | Deployed to origin/DO. |
| `bb4b41d` | Connector SDK + generator | Sensible and tested. | Generator should assert repo root/dry-run; webhook registry remains separate. |
| `4cd466e` | Full QA checklist + partner onboarding | Useful ops docs. | Not pushed/deployed at review time. |

## Verification Performed

All commands below passed on 2026-06-05. Recurring local warning: repo expects Node 22.x, machine is Node v24.12.0.

- `pnpm --filter @locateflow/connectors test -- src/core/contract-test-kit.test.ts src/core/async-connector.test.ts src/core/executor.test.ts`
  - Passed: 3 files / 22 tests.
- `pnpm --filter @locateflow/web test -- src/lib/connector-runtime.test.ts src/lib/fallback-actions.test.ts src/app/api/connectors/changes/route.test.ts src/app/api/connectors/[key]/webhook/route.test.ts src/app/api/subscription/change-plan/route.test.ts src/app/api/subscription/switch-cycle/route.test.ts src/app/api/webhooks/stripe/route.test.ts src/lib/iap-common.test.ts src/lib/user-auth-session.test.ts src/lib/__tests__/user-auth-fingerprint.test.ts`
  - Passed: 10 files / 146 tests.
- `pnpm --filter @locateflow/admin test -- src/app/api/connector-fallbacks/route.test.ts src/app/api/connectors/route.test.ts src/lib/connector-metrics.test.ts src/lib/backup-tables.test.ts`
  - Passed: 4 files / 27 tests.
- `pnpm --filter @locateflow/mobile test -- src/lib/service-logo.test.ts src/lib/subscription-visible-plans.test.ts`
  - Passed: 2 files / 9 tests.
- `git diff --check`
  - Passed.
- `pnpm --filter @locateflow/connectors lint`
  - Passed.
- `pnpm --filter @locateflow/db generate`
  - Passed.
- `pnpm verify:typecheck`
  - Passed.
- `pnpm verify:tests`
  - Passed: web 197 files / 1472 tests, admin 91 files / 501 tests, mobile 15 files / 42 tests, connectors 15 files / 102 tests.
- `pnpm lint`
  - Passed.
- `pnpm build`
  - Passed. Warnings only: known Next middleware convention warning, edge-runtime static generation warning, and admin Prisma CJS export warning.
- `pnpm verify:ci`
  - Passed, including provider guards and web tests.

Generated churn from `pnpm verify:ci` and build was cleaned after verification:

- `apps/admin/next-env.d.ts`
- `apps/web/next-env.d.ts`
- `docs/generated/state-provider-completeness-catalog.*`
- `docs/generated/state-provider-seed-diff.*`

## Recommendations

### Before next push/deploy

1. Decide whether to push the two local-ahead commits. They are low-risk docs/SDK commits, but they are not currently deployed.
2. Add guardrails to `scripts/stripe-live-plan-matrix.cjs` before any future reuse.
3. If pushing, expect DigitalOcean to redeploy even though runtime app behavior is basically unchanged by the last two commits.

### Before connector SHADOW pilot

1. Keep `FEATURE_API_CONNECTORS` globally off until a controlled test window.
2. Use only `stage=SHADOW` first; verify no partner `push()` is called.
3. Add explicit UI error states to connector metrics/history if operators will depend on them during the pilot.
4. Consider HTTPS-only fallback URLs before adding real user-facing partner fallback rows.

### Before real connector GA

1. Implement token refresh locking/versioning.
2. Unify async webhook connector lookup with the app registry.
3. Add a live-like async test connector in staging or a fake partner harness before first real async partner.
4. Add operational alerts for confirm-rate drop, stale submitted rows, and circuit-open events.

### Consumer launch

The consumer payment/mobile work is in materially better shape than the connector GA path. Remaining launch decisions are operational/legal/store decisions rather than code blockers:

- Apple is approved/pending developer release or external review/release state, depending on current App Store Connect status.
- Android production rollout remains an operator action.
- A real Stripe live card E2E/refund should be deliberate and documented.

## Final Call

Keep the 30 commits. Do not treat the connector platform as "real async partner live" yet. Treat it as "framework + SHADOW + guided fallback ready, real push gated by agreement and ops controls." No critical security issue was found, but I would fix F1, F2, and F3 before a high-volume connector rollout.
