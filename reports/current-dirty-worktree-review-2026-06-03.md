# Current Dirty Worktree Review - 2026-06-03

Repository: `Msxlab/move-main`
Current branch: `main`
Upstream: `origin/main`

## Summary

- `git diff --check`: passed.
- Changed-file secret scan: no token, key, private key, database URL, or bearer-token pattern found.
- Scope is coherent: Android native runtime/build fixes, Expo app config drift fix, mobile password-policy UX, web paid-plan terms enforcement, and release-readiness reporting.
- Recommended branch: `codex/release-readiness-mobile-android-fixes`
- Recommended commit message: `fix mobile android release readiness`
- Safe to commit: yes, after final verification.
- Safe to push: yes to a feature branch. Do not push directly to `main`.

## Modified Files

### `apps/mobile/android/app/src/main/AndroidManifest.xml`

- Why changed: fixes native Android drift from `app.json`.
- Details: adds Android 13+ notification permission, removes stale app-link hosts, adds `/invitations` app-link path on `locateflow.com`.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, improves native Android permissions and verified app-link scope.
- Android build/runtime impact: yes, expected and positive.
- Payments/IAP impact: no direct impact.

### `apps/mobile/android/app/src/main/java/com/locateflow/mobile/MainApplication.kt`

- Why changed: fixes Android dev-client RedBox where `expo-updates` was accessed before initialization.
- Details: uses `ExpoReactHostFactory.getDefaultReactHost(...)` so Expo host handlers initialize correctly.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, affects Android app startup.
- Android build/runtime impact: yes, required for stable launch.
- Payments/IAP impact: no direct impact.

### `apps/mobile/android/gradle.properties`

- Why changed: Android debug build ran out of Gradle JVM metaspace.
- Details: raises Gradle JVM heap/metaspace from `2048m/512m` to `4096m/1024m`.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: no runtime behavior change.
- Android build/runtime impact: build-only improvement.
- Payments/IAP impact: no.

### `apps/mobile/app.json`

- Why changed: keeps Expo config aligned with the native manifest.
- Details: adds `android.permission.POST_NOTIFICATIONS` to Android permissions so future prebuilds keep the permission.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, Android release permission declaration.
- Android build/runtime impact: yes, expected.
- Payments/IAP impact: no.

### `apps/mobile/app/(auth)/sign-up.tsx`

- Why changed: mobile sign-up did not show the backend password policy before submit.
- Details: adds live password rule feedback and disables Create Account until policy is met.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, improves mobile auth UX and reduces avoidable backend 400 errors.
- Android build/runtime impact: yes, UI behavior.
- Payments/IAP impact: no.

### `apps/mobile/app/setup-password.tsx`

- Why changed: removes duplicate password-rule definitions.
- Details: reuses the shared mobile password-policy helper.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, same behavior with cleaner source of truth.
- Android build/runtime impact: yes, UI helper path.
- Payments/IAP impact: no.

### `apps/web/src/app/api/subscription/change-plan/route.ts`

- Why changed: closes a direct API bypass where paid plan changes could mutate Stripe without explicit subscription-terms acceptance.
- Details: requires `acceptedSubscriptionTerms: true` before target plan validation, Stripe lookup, schedule creation, or proration mutation.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, safer billing/legal gate.
- Android build/runtime impact: no.
- Payments/IAP impact: yes, Stripe plan change API.

### `apps/web/src/app/api/subscription/change-plan/route.test.ts`

- Why changed: regression coverage for the server-side terms gate.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: no.
- Android build/runtime impact: no.
- Payments/IAP impact: test coverage for Stripe plan changes.

### `apps/web/src/app/api/subscription/switch-cycle/route.ts`

- Why changed: closes a direct API bypass where billing-cycle switches could create Stripe proration/schedules without explicit terms acceptance.
- Details: requires `acceptedSubscriptionTerms: true` before Stripe cycle mutation logic.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, safer billing/legal gate.
- Android build/runtime impact: no.
- Payments/IAP impact: yes, Stripe billing-cycle API.

### `apps/web/src/app/api/subscription/switch-cycle/route.test.ts`

- Why changed: regression coverage for the server-side billing-cycle terms gate.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: no.
- Android build/runtime impact: no.
- Payments/IAP impact: test coverage for Stripe cycle switching.

### `apps/web/src/components/settings/plan-change-section.tsx`

- Why changed: sends the explicit terms-acceptance flag required by the hardened plan-change API.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, keeps self-serve plan changes usable after the API hardening.
- Android build/runtime impact: no.
- Payments/IAP impact: yes, web Stripe plan changes.

### `apps/web/src/components/settings/subscription-management.tsx`

- Why changed: requires visible acceptance before Individual monthly/yearly billing-cycle switch and sends the explicit API flag.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, improves billing-cycle legal/UX gate.
- Android build/runtime impact: no.
- Payments/IAP impact: yes, web Stripe cycle switching.

## Untracked Files

### `apps/mobile/src/lib/password-policy.ts`

- Why changed: new shared mobile password-policy helper used by sign-up and setup-password.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: yes, mobile auth UX.
- Android build/runtime impact: yes.
- Payments/IAP impact: no.

### `apps/mobile/src/lib/password-policy.test.ts`

- Why changed: test coverage for the mobile password-policy helper.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: no.
- Android build/runtime impact: no direct runtime impact.
- Payments/IAP impact: no.

### `reports/release-readiness-todo-2026-06-03.md`

- Why changed: active release-readiness TODO/report for Stripe, plans, mobile, stores.
- Safe to commit: yes.
- Contains secrets: no. Bearer token and secret values intentionally omitted.
- Production behavior: no.
- Android build/runtime impact: no.
- Payments/IAP impact: no runtime impact.

### `reports/current-dirty-worktree-review-2026-06-03.md`

- Why changed: this review report required before committing dirty worktree changes.
- Safe to commit: yes.
- Contains secrets: no.
- Production behavior: no.
- Android build/runtime impact: no.
- Payments/IAP impact: no.

## Exclusions

- Temporary screenshots under `C:\Users\Kutay\AppData\Local\Temp\...` are evidence only and should not be committed.
- Temporary Java truststore under `C:\Users\Kutay\AppData\Local\Temp\locateflow-java-truststore\...` was local build support only and should not be committed.
- `pnpm verify:ci` regenerated timestamp-only changes in `docs/generated/state-provider-*.md/json`; those generated artifacts were restored and should not be committed for this release-readiness fix.
- `pnpm build` regenerated `apps/admin/next-env.d.ts` and `apps/web/next-env.d.ts`; those generated path changes were restored and should not be committed.
- No build artifacts are currently tracked or staged.

## Next Actions

1. Run baseline verification again after this report is created.
2. Continue safe Android/Expo build validation.
3. Create a feature branch before commit because current branch is `main`.
4. Commit only the files listed above.
5. Push the feature branch if GitHub auth/remotes allow and it does not trigger production deployment.
