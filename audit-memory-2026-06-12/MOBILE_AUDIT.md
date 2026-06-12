# Mobile Audit

Status: source-reviewed and verified.

## Verification

- `pnpm --filter @locateflow/mobile exec tsc --noEmit`: passed.
- `pnpm --filter @locateflow/mobile test`: 26 files / 266 tests passed.
- `eas config --platform ios --profile production`: version `1.0.2`, production remote auto-increment, no stale iOS buildNumber warning after cleanup.

## TestFlight Release

- New iOS build: `99762e3e-8d7c-4d1a-bc66-2cb59235205d`.
- Version/build: `1.0.2 (21)`.
- Submit ID: `5531132f-e109-45ac-9c55-b04c57048993`.
- Apple status after submit: binary uploaded and processing.
- TestFlight URL: https://appstoreconnect.apple.com/apps/6771878736/testflight/ios

## Findings

1. Root cause of the 1.0.0 confusion was version-source drift.
   - `eas.json` uses remote app version source and auto-increment.
   - `app.json` marketing version stayed `1.0.0`; remote iOS build number advanced to 20.
   - A stale `ios.buildNumber: "1"` was ignored by EAS but still exposed in app config/manifest.
   - Fixed locally: marketing version is now `1.0.2`, `ios.buildNumber` removed, Android native version set to `1.0.2/21`.

2. Submitted TestFlight binary was built before the later cleanup of `ios.buildNumber` and Android native version fields.
   - Impact: the TestFlight build is still valid as `1.0.2 (21)`.
   - Recommendation: commit the cleanup before the next build so repo, manifest, and native files stay aligned.

3. Local Node version does not match repo engine.
   - Repo wants Node `22.x`; local machine ran Node `v24.12.0`.
   - Impact: all tests passed, but release/build scripts should run under Node 22 in CI/EAS for reproducibility.

## What Looks Good

- Auth token is stored in Expo SecureStore.
- API client enforces HTTPS fallback in release builds.
- Logout clears token, plan tier, app-lock, offline caches, dashboard snapshots, and widget snapshots.
- IAP finishes transactions only after server verification.
- Pending purchase reconciler handles charged-but-unverified purchases on next launch.
- Mobile dossier renderer hides degraded/unconfigured sections instead of fabricating values.
