# Mobile Android Preview Build

Goal: build an internal Android APK that talks to the current DigitalOcean App Platform web/API and supports real-device QA for the current product.

This does not prove iOS readiness and does not add mobile product features.

## Current Config

- Android package: `com.locateflow.mobile`
- iOS bundle ID: `com.locateflow.mobile`
- App version: `1.0.0`
- Android version code: `1`
- iOS build number: `1`
- EAS profile for staging device QA: `staging-preview`
- Active API URL in `preview`, `staging-preview`, and `production`: `https://locateflow.com/api`

Use `staging-preview` for internal QA builds. It currently targets the active DigitalOcean web/API domain.

## Staging API Protection Decision

Mobile device requests will fail if the entire web/API staging deployment is protected by a platform-level gate that the app cannot satisfy.

Recommended safe option:

1. Keep admin staging protected by platform access controls and admin login.
2. For mobile QA, expose the staging web/API service behind app-level auth, rate limits, staging DB, and non-production data only.
3. Keep public web staging pages protected if possible, but do not block `/api/*` calls required by mobile unless a safe bypass is implemented.

Alternative if full platform protection is required:

- Use a platform-provided protection bypass only for controlled testing.
- Do not hardcode the bypass secret into the mobile app.
- Prefer a short-lived test proxy or controlled QA network path rather than shipping the bypass token in an APK.

## Prerequisites

- EAS account and project access.
- `EAS_TOKEN` or interactive `eas login`.
- Java for local builds.
- Android SDK and `ANDROID_HOME` or `ANDROID_SDK_ROOT` for local builds.
- Android signing credentials, or EAS-managed credentials.
- Web/API deployment reachable from the device.
- Staging DB migrated and seeded with QA data.

## Verification Before Native Build

```bash
cd apps/mobile
pnpm exec expo install --check
npx expo-doctor@latest
pnpm exec expo export --platform android --output-dir dist-export-android
pnpm exec expo export --platform ios --output-dir dist-export-ios
```

Clean generated export folders after verification:

```bash
Remove-Item -Recurse -Force dist-export-android, dist-export-ios
```

Known current Expo Doctor warnings:

- Duplicate React versions in the monorepo.
- Native Android folder plus app config fields that may not sync in non-CNG builds.

These warnings must be resolved or proven non-blocking by a successful native build.

## Android EAS Build

Cloud/internal build:

```bash
cd apps/mobile
eas build --platform android --profile staging-preview --non-interactive
```

Local build, if Android toolchain is installed:

```bash
cd apps/mobile
eas build --platform android --profile staging-preview --local --non-interactive
```

Expected result:

- APK build completes.
- APK installs on a real Android device or emulator.
- API calls go to `https://locateflow.com/api`.
- Login, onboarding, provider list/detail, custom provider create/edit/delete, moving plan, move task lifecycle, settings, support, and logout smoke pass.

## Exact Missing Prerequisites In This Workspace

The last local check found:

- No `EAS_TOKEN` or `EXPO_TOKEN`.
- `java` unavailable.
- `ANDROID_HOME` unset.
- `ANDROID_SDK_ROOT` unset.
- No Android signing credentials available.

Android native build status: not proven.

## iOS Readiness Summary

Use EAS cloud build from any OS, or local build from macOS with Xcode:

```bash
cd apps/mobile
eas build --platform ios --profile staging-preview --non-interactive
```

iOS blockers in this workspace:

- Windows host, so no local Xcode build.
- Apple developer credentials unavailable.
- Certificates and provisioning profiles unavailable.

iOS native build status: not proven.
