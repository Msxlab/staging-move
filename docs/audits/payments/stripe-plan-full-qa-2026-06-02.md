# Stripe Plan Full QA - 2026-06-02

Goal: Validate LocateFlow paid plan behavior end to end before public launch readiness:
Individual, Family, Pro, monthly/yearly, web Stripe Checkout, web plan changes, downgrade scheduling,
Family workspace/invites, Pro annual sync entitlement, mobile subscription visibility, and admin observability.

Safety rules:
- [x] Do not delete env files or existing env keys.
- [x] Do not run a real live card charge during QA.
- [ ] Use Stripe test mode/staging customer for full payment completion. BLOCKED: no test-mode deployment/customer flow is safely available yet.
- [x] Before live-mode/public launch, verify live keys/products/webhooks are configured, but do not rotate or remove secrets.
- [ ] If a live configuration change is needed, record exact change and evidence.

## A. Environment and Baseline

- [x] Confirm repo and package layout: web, admin, mobile, shared, connectors.
- [x] Confirm worktree status before edits.
- [ ] Identify DigitalOcean live/staging web URL to use for Stripe test-mode checkout. BLOCKED: app is named staging but routes production domains with production env.
- [ ] Confirm DigitalOcean runtime Stripe key mode without printing secrets.
- [x] Confirm six Stripe price env values exist for web checkout:
  - [x] Individual monthly - verified in DigitalOcean runtime config and live Stripe product.
  - [x] Individual yearly - verified in DigitalOcean runtime config and live Stripe product.
  - [x] Family monthly - verified in DigitalOcean runtime config and live Stripe product.
  - [x] Family yearly - verified in DigitalOcean runtime config and live Stripe product.
  - [x] Pro monthly - verified in DigitalOcean runtime config and live Stripe product.
  - [x] Pro yearly - verified in DigitalOcean runtime config and live Stripe product.
- [x] Confirm Stripe webhook secret exists in DigitalOcean/runtime config.
- [ ] Confirm database target for QA account is not production live-charge data unless explicitly intended.

## B. Code Audit

- [x] Shared plan definitions match pricing UI and product copy.
- [x] Entitlement resolver maps ACTIVE/PAID Stripe subscriptions correctly.
- [x] Free access / pending checkout fallback remains safe if checkout is canceled.
- [x] Checkout route accepts Individual, Family, Pro monthly/yearly with terms consent.
- [x] Checkout route blocks mobile-origin web Stripe checkout.
- [x] Checkout route blocks duplicate checkout for active Stripe/App Store/Play Store subscriptions.
- [x] Checkout route blocks past-due/grace/pending-validation subscriptions and sends billing recovery.
- [x] Checkout cancel route restores usable free/pending state and redirects to public app URL.
- [x] Stripe webhook maps checkout completed and subscription updates to plan, interval, status, price, period end.
- [x] Plan change route handles immediate upgrades and scheduled downgrades.
- [x] Switch-cycle route is Individual-only or correctly blocked/hidden for Family/Pro.
- [x] Subscription action route handles cancel/resume safely.
- [x] Family workspace entitlement and member limits align with Family plan.
- [x] Family invite send/accept/status APIs are gated correctly.
- [x] Pro annual sync entitlement requires Pro + Year + active access.
- [x] Pro monthly does not expose API sync.
- [x] Downgrade from Pro annual preserves sync until period end, then removes it in code/tests.
- [x] Admin subscription screens can see plan/status/provider/interval/pending plan in code/tests.
- [x] Admin manual grant actions cannot create inconsistent entitlement state in code/tests.
- [x] Mobile IAP products map to all six product IDs.
- [x] Mobile subscription screen is store-compliant and does not open web Stripe checkout from app.
- [x] Mobile Family/Pro visibility and current plan display matches backend profile in code/tests.

## C. Automated Test Matrix

- [x] Unit matrix: paid plan transitions for Individual/Family/Pro x Month/Year.
- [x] Unit matrix: Family/Pro checkout sessions choose correct monthly/yearly price.
- [x] Unit matrix: Pro annual only API sync entitlement.
- [x] Run focused web payment tests. 171 tests passed.
- [x] Run shared entitlement/workspace tests. Covered in focused web run.
- [x] Run admin billing/subscription tests. 17 tests passed.
- [x] Run mobile IAP/subscription tests. 14 tests passed.
- [x] Run production readiness/billing/ready regression tests. 36 tests passed.
- [x] Run web typecheck (`pnpm --filter @locateflow/web lint`).
- [x] Run admin typecheck (`pnpm --filter @locateflow/admin lint`).
- [x] Run mobile typecheck (`pnpm --filter @locateflow/mobile lint`).
- [x] Run root typecheck (`pnpm verify:typecheck`).
- [x] Run root test suite (`pnpm verify:tests`).

## D. Stripe Test-Mode Checkout Completion

Use a fresh QA user and Stripe test card. Expected: no live charge.

- [ ] Individual monthly checkout completes; web profile/subscription shows Individual Monthly Active.
- [ ] Individual yearly checkout completes; web profile/subscription shows Individual Annual Active.
- [ ] Family monthly checkout completes; web profile/subscription shows Family Monthly Active.
- [ ] Family yearly checkout completes; web profile/subscription shows Family Annual Active.
- [ ] Pro monthly checkout completes; web profile/subscription shows Pro Monthly Active; sync is not available.
- [ ] Pro yearly checkout completes; web profile/subscription shows Pro Annual Active; sync entitlement is available when catalog is enabled.
- [ ] Checkout cancel returns to subscription screen and does not leave account stuck in unusable pending checkout.
- [ ] Failed/declined card shows recoverable Stripe error and does not activate premium.
- [ ] Duplicate checkout attempt for already active paid subscription is blocked or routes to billing recovery.
- [ ] BLOCKED: Stripe test-mode catalog must be created/fixed for all six products before test-card checkout completion can be run safely.

## E. Web Plan Change Matrix

Expected behavior:
- Tier upgrades are immediate with Stripe proration.
- Same-tier Month -> Year is immediate.
- Tier downgrades are scheduled at period end.
- Same-tier Year -> Month is scheduled at period end.
- Same plan + same interval is rejected/no-op.

- [ ] Individual Monthly -> Individual Annual: immediate.
- [ ] Individual Annual -> Individual Monthly: scheduled.
- [ ] Individual Monthly -> Family Monthly: immediate.
- [ ] Individual Monthly -> Family Annual: immediate.
- [ ] Individual Annual -> Family Monthly: immediate.
- [ ] Individual Annual -> Family Annual: immediate.
- [ ] Individual Monthly -> Pro Monthly: immediate.
- [ ] Individual Monthly -> Pro Annual: immediate; sync available after active Pro Annual.
- [ ] Individual Annual -> Pro Monthly: immediate; sync not available on Pro Monthly.
- [ ] Individual Annual -> Pro Annual: immediate; sync available after active Pro Annual.
- [ ] Family Monthly -> Family Annual: immediate.
- [ ] Family Annual -> Family Monthly: scheduled.
- [ ] Family Monthly -> Individual Monthly: scheduled.
- [ ] Family Monthly -> Individual Annual: scheduled.
- [ ] Family Annual -> Individual Monthly: scheduled.
- [ ] Family Annual -> Individual Annual: scheduled.
- [ ] Family Monthly -> Pro Monthly: immediate.
- [ ] Family Monthly -> Pro Annual: immediate; sync available after active Pro Annual.
- [ ] Family Annual -> Pro Monthly: immediate.
- [ ] Family Annual -> Pro Annual: immediate; sync available after active Pro Annual.
- [ ] Pro Monthly -> Pro Annual: immediate; sync becomes available.
- [ ] Pro Annual -> Pro Monthly: scheduled; sync remains until period end, then removed.
- [ ] Pro Monthly -> Family Monthly: scheduled.
- [ ] Pro Monthly -> Family Annual: scheduled.
- [ ] Pro Annual -> Family Monthly: scheduled.
- [ ] Pro Annual -> Family Annual: scheduled.
- [ ] Pro Monthly -> Individual Monthly: scheduled.
- [ ] Pro Monthly -> Individual Annual: scheduled.
- [ ] Pro Annual -> Individual Monthly: scheduled.
- [ ] Pro Annual -> Individual Annual: scheduled.
- [ ] Pending downgrade banner appears on web subscription UI.
- [ ] Pending downgrade state appears in admin subscription UI.
- [ ] Billing portal/cancel/resume path works for Stripe-managed subscription.

## F. Family Plan Functional QA

- [ ] Family owner sees workspace/family management entry points on web.
- [ ] Family owner can send invite.
- [ ] Invite email/API response is generated without leaking token in UI logs.
- [ ] Invited member can accept invite and joins correct workspace.
- [ ] Family member role cannot manage billing if not owner/admin.
- [ ] Family owner/admin can remove member.
- [ ] Family member cap is enforced.
- [ ] Downgrade Family -> Individual schedules end-of-period and preserves members until period end.
- [ ] After effective Individual downgrade, Family-only workspace features are blocked/hidden safely.
- [ ] Mobile shows current Family plan and does not expose unsupported web checkout.

## G. Pro Plan and Sync QA

- [x] Pro monthly shows Pro plan but no API sync entitlement in code/tests.
- [x] Pro annual shows Pro plan and API sync entitlement when connector feature/catalog is enabled in code/tests.
- [x] Connections page does not claim unsupported automatic provider updates.
- [x] Connector catalog empty/off state is clear and not broken.
- [ ] API sync action requires partner consent.
- [ ] Disconnect/consent revocation removes connector access.
- [ ] Workspace sync validates workspace address, target member status, active member, and consent.
- [ ] Pro Annual -> Pro Monthly scheduled downgrade keeps sync until period end.
- [ ] After period-end downgrade simulation, sync is removed.
- [ ] Mobile connections screen matches web entitlement state.

## H. Admin QA

- [ ] Admin subscriptions list shows Individual/Family/Pro and interval.
- [ ] Admin can filter/search QA users/subscriptions.
- [ ] Admin user detail/actions show pending plan and provider.
- [ ] Admin manual grant can set Family for test user without Stripe.
- [ ] Admin manual grant can set Pro for test user without Stripe.
- [ ] Manual grants are visibly provider=ADMIN and do not look like Stripe paid revenue.
- [x] Admin connector page reflects registered connector/catalog state.
- [ ] Admin billing metrics do not double-count pending checkout or admin grants.

## I. Mobile QA

- [x] App typechecks.
- [ ] Android launches on emulator/dev client. BLOCKED: emulator boots, but app is not installed and `expo run:android` cannot download Gradle due Java SSL trust failure.
- [ ] Subscription screen loads current plan from backend profile.
- [x] Mobile product list maps all six products in live `/api/mobile/iap/products`.
- [x] Individual monthly/yearly options are visible if store products are available.
- [x] Family monthly/yearly options are visible if store products are available.
- [x] Pro monthly/yearly options are visible if store products are available.
- [ ] Existing web Stripe subscription is displayed as managed on web/Stripe, not as an in-app purchase.
- [ ] Mobile blocks/avoids web Stripe checkout initiation.
- [ ] Mobile Family current plan state unlocks workspace-related read paths.
- [ ] Mobile Pro annual current plan state shows connections/sync affordance only when entitled/catalog enabled.
- [ ] Android logcat has no billing/subscription crash during subscription screen.

## J. Production Readiness

- [ ] Verify production env uses live Stripe publishable/secret keys without printing values.
- [x] Verify live Stripe products/prices exist for all six plans and match public pricing.
- [ ] Verify live webhook endpoint is configured and signing secret matches production env.
- [ ] Verify customer portal is configured for cancel/payment method update.
- [ ] Verify legal/billing policy copy matches Family/Pro/connector promise.
- [ ] Verify feature flags for connectors are intentionally on/off for launch.
- [ ] Verify app store / play store product IDs align with mobile product IDs. BLOCKED in consoles: App Store Connect direct subscriptions route required re-auth; Play Console subscription routes returned Google unexpected errors.
- [ ] Verify monitoring/logging paths for webhook failures and billing recovery.
- [ ] Final decision: ready for public paid launch / blocked with reasons.

## Running Notes

- 2026-06-02: Checklist created. Previous commit `b54e5fe` added automated paid plan transition, checkout, and Pro annual sync entitlement matrix tests.
- 2026-06-02: Local `.env.local` is not the source of truth for this QA; production/staging payment config must be verified from DigitalOcean runtime env and/or Runtime Config.
- 2026-06-02: Stripe connector read-only search returned active products `Bronze` and `Quantum` with prices 6/18/50/60/95/180 USD. Need verify whether that connector is pointed at the intended Stripe account/mode before treating it as authoritative.
- 2026-06-02: Hardened production readiness so paid launch now fails if Family/Pro Stripe price IDs are missing. Verified with `pnpm --filter @locateflow/web test -- src/lib/production-readiness.test.ts src/lib/billing.test.ts src/app/api/ready/route.test.ts` (36 passed).
- 2026-06-02: DigitalOcean App Platform app is `locateflow-staging`, but it routes `https://locateflow.com` / `https://admin.locateflow.com` and has `NODE_ENV=production`, `APP_ENV=production`.
- 2026-06-02: DigitalOcean app-level env has all six web Stripe price IDs. Live Stripe products verify as Individual $3.99/mo + $39.99/year, Family $9.99/mo + $99/year, Pro $19.99/mo + $199/year.
- 2026-06-02: Stripe test-mode catalog is not ready for full test-card matrix: only `LocateFlow Individual Annual` is visible in sandbox and it is $79/year; Family/Pro test products are absent.
- 2026-06-02: DigitalOcean billing has a past-due account balance warning ($81.83 due before Friday, June 5, 2026). Treat as launch/availability blocker until paid.
- 2026-06-02: DigitalOcean env form displays `DATABASE_URL` as a plaintext sensitive value rather than a masked secret. Do not print the value; mark for secret-flag cleanup/rotation review.
- 2026-06-02: TypeScript checks passed for web/admin/mobile via package `lint` scripts, and for db/connectors via `tsc --noEmit`. Local Node is v24.12.0 while repo expects Node 22.x.
- 2026-06-02: Root verification passed: `pnpm verify:typecheck`; `pnpm verify:tests` with web 191 files/1414 tests, admin 89 files/480 tests, mobile 9 files/21 tests, connectors 13 files/87 tests.
- 2026-06-02: Live client subscription UI (`/settings/subscription`) shows Monthly/Annual tabs and all three paid plans with correct prices; console warnings/errors were empty.
- 2026-06-02: Live `/api/mobile/iap/products` returns all six iOS and all six Android product IDs from Runtime Config DB even though they are not present as DigitalOcean app env vars.
- 2026-06-02: Connector tests passed: `@locateflow/connectors` 87 tests; web connector/workspace OAuth/catalog focused run 38 tests. Live `/settings/connections` shows a clear empty catalog state. Admin `/connectors` shows built-in USPS adapter as supported but not registered; no console errors.
- 2026-06-02: Live `/api/ready` returned 200 with `ready=true`, `productionLike=true`, and database ready.
- 2026-06-02: App Store Connect app page shows LocateFlow 1.0 `Waiting for Review`, but direct subscriptions page redirects to login with `authResult=FAILED`; product IDs could not be console-verified.
- 2026-06-02: Play Console app route for `com.locateflow.mobile` opens but direct monetization/subscription product routes return unexpected Google Console errors; product IDs could not be console-verified there.
- 2026-06-02: Android emulator `Pixel_7a` booted via SDK AVD. App was not installed. `expo run:android` first failed because `JAVA_HOME` was missing; with Android Studio JBR it failed downloading Gradle due PKIX/certificate trust failure.
