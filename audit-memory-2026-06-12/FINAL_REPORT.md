# LocateFlow Final Audit Report - 2026-06-12

Status: current pass complete.

## Actions Completed

- Pulled latest GitHub `origin/main` into local `main`.
- Preserved pre-pull local work in a git stash before syncing.
- Investigated TestFlight version issue.
- Built and submitted iOS TestFlight build `1.0.2 (21)`.
- Created a fresh audit memory folder and TODO from source review.
- Mapped Web, Mobile, Admin, DB/packages, provider/recommendation/data flows.
- Ran 6-worker Codex Security scan and merged/validated candidates.
- Fixed the mover self-service public-route middleware bug found during audit.

## Release / TestFlight

Root cause:
- `apps/mobile/app.json` stayed at marketing version `1.0.0` while EAS remote build numbers continued increasing.
- `ios.buildNumber: "1"` was stale and ignored by EAS remote version source, but still made local config misleading.

Action:
- `apps/mobile/app.json` version is now `1.0.2`.
- Removed stale `ios.buildNumber` and Android `versionCode` from Expo config.
- Aligned native Android committed fields to `versionName "1.0.2"` and `versionCode 21`.
- EAS iOS build `99762e3e-8d7c-4d1a-bc66-2cb59235205d` finished as `1.0.2 (21)`.
- Manual EAS submit succeeded with submission ID `5531132f-e109-45ac-9c55-b04c57048993`.
- Apple processing/TestFlight page: https://appstoreconnect.apple.com/apps/6771878736/testflight/ios

## Module Findings

Web:
- Fixed: mover application and passwordless mover portal were blocked by the normal user-session middleware.
- Fixed: mover application uploads were capped at the generic 10MB multipart limit, while the route supports 8 x 10MB documents.
- Open: forwarded client IP handling still needs an explicit trusted-proxy model.
- Open: partner-consent refresh route appears legacy/dead and weaker than the main connector runtime refresh path.

Mobile:
- Release config corrected for TestFlight lineage.
- Tests/typecheck passed.
- Auth token storage, IAP verification, logout cleanup, and dossier degradation paths look structurally sound from source review.

Admin:
- Open: admin IP allow/deny and login/MFA rate-limit keys use forwarding headers without a deployment trust boundary.
- Open: admin backup/retention cron should use backup-specific secrets, not the broad cron secret.
- Admin auth, permissions, step-up, backup archive encryption/signing, and audit patterns are otherwise strong.

Provider / Recommendation / AI/API Data:
- Critical coverage has no full state/category gaps in the audit script.
- Main product risk is precision: 118 state-only overbroad provider coverage candidates remain.
- FCC bulk ingest is still a documented stub, so downloaded FCC bulk datasets are not wired into coverage unless another process loaded them.
- Electric/OpenEI lookup is useful as a confidence signal, not proof of exact serviceability.

Security:
- 17 raw sub-agent candidates were deduped into 8 findings.
- One finding was fixed in code.
- The highest open item is mover proof-document storage/access hardening.
- Full detail is in `SECURITY_AUDIT.md`.

## Verification

- `pnpm --filter @locateflow/db generate`
- `pnpm --filter @locateflow/web exec tsc --noEmit`
- `pnpm --filter @locateflow/admin exec tsc --noEmit`
- `pnpm --filter @locateflow/mobile exec tsc --noEmit`
- `pnpm --filter @locateflow/db exec tsc --noEmit`
- `pnpm --filter @locateflow/connectors exec tsc --noEmit`
- `pnpm --filter @locateflow/web test`: 263 files / 2343 tests
- `pnpm --filter @locateflow/admin test`: 116 files / 733 tests
- `pnpm --filter @locateflow/mobile test`: 26 files / 266 tests
- `pnpm --filter @locateflow/connectors test`: 15 files / 105 tests
- `pnpm --filter @locateflow/web exec vitest run src/middleware.test.ts`: 33/33 tests after middleware fix
- Provider audit scripts completed.

Warnings:
- Local Node is `v24.12.0`; repo engine requests `22.x`.
- EAS CLI is older than latest, but build/submit completed.

External sources used for data/API cross-check:
- https://openei.org/services/doc/rest/util_rates/?version=7
- https://www.fcc.gov/sites/default/files/bdc-public-data-api-spec.pdf
- https://broadbandmap.fcc.gov/data-download
