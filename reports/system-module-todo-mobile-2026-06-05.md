# Mobile Module Todo Audit - 2026-06-05

Source rule followed: existing `.md`, README/docs, and memory summaries were not used as audit inputs. This report is based on code, config, package metadata, native manifests, route files, and command output inspected in this run.

## Completed Audit Todo

- [x] Identify module entry points, Expo SDK, package, native config, and build/test commands.
- [x] Check API base URL resolution and production HTTPS enforcement.
- [x] Check login/OAuth handoff, token storage, auth hydration, and logout cleanup.
- [x] Check deep links, custom scheme, universal/app links, and Android intent filters.
- [x] Check iOS ATS/privacy config and Android cleartext/backup permissions.
- [x] Check app-lock, biometric/passcode gate, local cache cleanup, push registration, and IAP flags.
- [x] Check mobile/web session contract against web-issued bearer sessions.
- [x] Run mobile TypeScript verification.
- [x] Run mobile test suite.
- [x] Write findings and release todo.

## Module Map

| Area | Code/config evidence | Result |
| --- | --- | --- |
| Package | `apps/mobile/package.json` | Expo Router app on Expo SDK 55 and React Native 0.83. |
| App config | `apps/mobile/app.json:1-16` | OTA updates enabled with runtime version `sdk55-1.0.0`. |
| iOS security | `apps/mobile/app.json:17-65` | ATS arbitrary loads disabled; Apple Sign-In and associated domain configured. |
| Android security | `apps/mobile/app.json:66-117`, `apps/mobile/app.json:151-157` | HTTPS links configured; camera/storage blocked; cleartext traffic disabled. |
| Token storage | `apps/mobile/src/lib/auth.ts:3-6` | SecureStore uses `AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY`; biometric auth is not required for every token read. |
| Token lifecycle | `apps/mobile/src/lib/auth-store.ts:4-10` | Mobile treats JWT bearer token as long-lived 30-day session with no refresh flow. |
| Server session TTL | `apps/web/src/lib/user-auth.ts:29-30`, `apps/web/src/lib/user-auth.ts:241-257` | Web/mobile session issuer signs 30-day JWT and stores token hash with DB expiry. |
| EAS profiles | `apps/mobile/eas.json:26-72` | Preview, staging-preview, and production point at `https://locateflow.com/api`; store purchases enabled only in production. |
| Release runtime | `package.json:62-65` | Repo declares `pnpm@9.15.0` and Node `22.x`. |

## Flow Todo Status

- [x] Password login flow checked against `/api/mobile/auth/login`.
- [x] OAuth exchange flow checked for web handoff and PKCE-style verifier handling.
- [x] API client checked for bearer token header and mobile client type header.
- [x] AuthGuard/hydration checked for pending legal consent handling and session refresh behavior.
- [x] Secure local cleanup checked for OAuth code markers, pending consents, onboarding cache, query cache, and analytics state.
- [x] Push registration/unregister flow checked.
- [x] IAP environment flags and native billing permission path checked.
- [x] Native deep link declarations checked for custom scheme and verified HTTPS app links.

## Findings

| ID | Severity | Status | Evidence | Finding | Todo |
| --- | --- | --- | --- | --- | --- |
| M-SEC-001 | Low | Open | `apps/mobile/src/lib/auth.ts:3-6`; `apps/mobile/src/lib/auth-store.ts:4-10`; `apps/web/src/lib/user-auth.ts:29-30` | Mobile bearer sessions are 30-day tokens stored in SecureStore without per-read biometric gating and without access-token/refresh-token rotation. SecureStore and DB revocation reduce risk, but a copied token can remain useful until expiry or server-side revocation. | [ ] Add short-lived mobile access tokens plus rotating refresh tokens, or shorten bearer TTL and add explicit server-side device/session management. Consider biometric-gated reads for the most sensitive local actions. |
| M-REL-001 | Low | Open | `apps/mobile/eas.json:26-60` | `preview` and `staging-preview` both point to the production API/app URL. Internal QA builds can mutate production data unless testers use isolated accounts and backend safeguards. | [ ] Add a real staging API/app URL for `staging-preview`, or rename the profile to make production-backend behavior explicit and require release checklist sign-off. |
| M-REL-002 | Low | Open | `package.json:62-65`; local command warning showed Node `v24.12.0` while engine requires `22.x` | Mobile typecheck/tests passed, but local verification did not match the declared repo runtime. | [ ] Re-run mobile typecheck, tests, and EAS prebuild/build validation in Node 22.x before release sign-off. |

## Positive Checks

- [x] Production API URL handling enforces HTTPS and falls back to `https://locateflow.com/api`.
- [x] Android cleartext traffic is disabled and iOS arbitrary network loads are disabled.
- [x] SecureStore uses device-only keychain accessibility and Android backup excludes sensitive app storage.
- [x] OAuth custom scheme risk is mitigated by verifier-based exchange rather than trusting only the redirect URI.
- [x] Local logout cleanup clears token, cached onboarding/profile/query state, pending legal consents, OAuth code markers, and analytics state.

## Verification

- [x] `pnpm --filter @locateflow/mobile exec tsc --noEmit` passed.
- [x] `pnpm --filter @locateflow/mobile test` passed: 15 test files, 48 tests.
- [x] Caveat recorded: local Node was `v24.12.0`; release engine is `22.x`.

## Release Todo

- [ ] Decide whether current 30-day mobile bearer model is acceptable for launch risk.
- [ ] Split staging-preview from production backend, or add explicit QA data controls.
- [ ] Run Node 22.x verification plus EAS build/prebuild validation.
