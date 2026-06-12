# LocateFlow Audit TODO - 2026-06-12

## In Progress

- [x] TestFlight version/build investigation and new iOS TestFlight submission. Build `99762e3e-8d7c-4d1a-bc66-2cb59235205d` submitted as `1.0.2 (21)`; Apple processing is pending.
- [x] Current system map from source/config only.
- [x] Web module audit.
- [x] Mobile module audit.
- [x] Admin module audit.
- [x] Shared provider/recommendation/AI/data pipeline audit.
- [x] Security review from source code and 6-worker Codex Security merge/validation.
- [x] Release/deployment/runtime configuration audit.

## Findings

- [x] Confirm whether stale `1.0.0` marketing version / remote EAS build-number split caused the TestFlight version issue. Root cause is confirmed enough for release action: app config stayed at `1.0.0` while EAS remote build numbers advanced; stale `ios.buildNumber: 1` is ignored for EAS but still appears in Expo config/manifest.
- [x] Removed `ios.buildNumber` from `apps/mobile/app.json`; EAS remote version source now has no stale manifest build-number field.
- [x] Aligned committed Android native version fields to `versionName "1.0.2"` and `versionCode 21`.
- [ ] Implement real FCC bulk ingest in `scripts/ingest/fcc-bulk-ingest.ts`; current file is a documented stub.
- [ ] Convert high-risk state-only provider coverage rows to ZIP/polygon coverage, starting with water/transit then electric/gas.
- [ ] Smoke-test FCC live availability endpoint with real FCC username/hash token before enabling it in production.
- [x] Fix mover application / passwordless mover portal middleware allowlist and upload-size mismatch.
- [ ] Harden mover proof-document uploads with magic-byte validation and private/signed admin download URLs.
- [ ] Replace/remove legacy `/api/partner-consents/[id]/refresh` route; use the CAS/tokenVersion refresh path from connector runtime.
- [ ] Add trusted-proxy configuration for web/admin client IP resolution before depending on forwarding headers for rate limits/IP rules.
- [ ] Split high-impact admin backup/retention cron secrets from the broad `CRON_SECRET`.
- [ ] Make mover portal emailed tokens single-use and exchange them for a separate session token.
- [ ] Commit/push mobile release config and audit-memory files so GitHub matches the submitted TestFlight release lineage.
- [ ] Ensure CI/EAS uses Node 22.x; local verification ran under Node v24.12.0 and emitted engine warnings.

## Completed

- [x] Synced local `main` with GitHub `origin/main`.
- [x] Confirmed mobile tests pass before new iOS build attempt.
- [x] Confirmed mobile TypeScript passes before new iOS build attempt.
- [x] Confirmed full web/admin/mobile/db/connectors typecheck after Prisma Client regeneration.
- [x] Confirmed web/admin/mobile/connectors tests pass.
- [x] Confirmed targeted web middleware regression tests pass after mover portal/apply fix.
