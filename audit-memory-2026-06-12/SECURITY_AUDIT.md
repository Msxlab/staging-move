# Security Audit - 2026-06-12

Status: completed and merged from 6-worker Codex Security scan.

Scan artifact root: `C:\tmp\codex-security-scans\move-main\ad1937ec1c6f_20260612001815`.

Method:
- Synced `main` from GitHub first.
- Built scan worklists from source/config only; previous repo `.md` and old memory files were not used as audit evidence.
- Generated 11,044-row rank/deep-review worklists.
- Ran 6 discovery workers. Raw output contained 17 candidates, deduped into the findings below.
- Validated candidates against source code and targeted tests.

## Findings

### LF-SEC-01 - Fixed: mover apply/portal middleware boundary mismatch

Severity: High functional bug, fixed.

Evidence:
- Public pages now allowlisted in `apps/web/src/middleware.ts:54-55`.
- Portal/apply APIs now allowlisted in `apps/web/src/middleware.ts:83` and `apps/web/src/middleware.ts:112`.
- Mover apply multipart limit now matches the route's 8-document design in `apps/web/src/middleware.ts:154` and `apps/web/src/middleware.ts:170`.
- Regression tests added in `apps/web/src/middleware.test.ts`.

Impact before fix:
- `/movers/apply`, `/movers/portal`, and `/api/movers/portal/*` were written as public/passwordless flows but were intercepted by the normal user-session middleware.
- `/api/movers/apply` accepted up to 8 x 10MB documents at the route layer, but the global middleware capped multipart requests at 10MB.

Verification:
- `pnpm --filter @locateflow/web exec vitest run src/middleware.test.ts`: 33/33 passed.
- `pnpm --filter @locateflow/web exec tsc --noEmit`: passed.

### LF-SEC-02 - Open: mover proof documents trust declared MIME and are exposed via raw public R2 URLs

Severity: High.

Evidence:
- Upload validation accepts the browser-supplied MIME type via `isAllowedMoverDocContentType(file.type)` in `apps/web/src/app/api/movers/apply/route.ts:106`.
- Shared type allowlist checks the content-type string only in `packages/shared/src/mover-portal.ts:101`.
- Admin review response returns `rawAssetUrl(doc.objectKey)` in `apps/admin/src/app/api/movers/applications/[id]/route.ts:49`.

Impact:
- A malicious applicant can upload bytes that do not match the declared PDF/image type unless R2 or a later consumer rejects them.
- Mover proof documents can include licensing/insurance/business identity material. Raw public URLs are unbounded bearer links if copied, logged, or leaked.

Recommendation:
- Add magic-byte validation for PDF/JPEG/PNG/WebP before upload.
- Store mover proof documents in a private prefix/bucket and serve them through an authenticated admin download route with short-lived signed URLs.
- Force `Content-Disposition: attachment`, set `X-Content-Type-Options: nosniff`, add malware scanning if documents are retained long-term, and audit every document view/download.

### LF-SEC-03 - Open: forwarded IP headers are trusted without a deployment trust boundary

Severity: Medium-High, environment-dependent.

Evidence:
- Web resolver accepts `cf-connecting-ip`, `x-real-ip`, and `x-forwarded-for` in `apps/web/src/lib/client-ip.ts:23-30`.
- Admin middleware has a separate resolver with the same pattern in `apps/admin/src/middleware.ts:66-80`; it feeds route rate limit keys at `apps/admin/src/middleware.ts:416` and IP rules at `apps/admin/src/middleware.ts:480`.
- Admin login repeats the same resolver in `apps/admin/src/app/api/auth/login/route.ts:181-196`; login/MFA rate keys use it at `apps/admin/src/app/api/auth/login/route.ts:333`.

Impact:
- If any production edge path can pass caller-supplied forwarding headers through, an attacker can reset IP-keyed rate limits, poison audit/IP logs, or evade IP allow/deny controls.

Recommendation:
- Centralize admin and web IP resolution.
- Only honor forwarding headers when a trusted proxy mode is explicitly configured for the deployment.
- Prefer one platform-specific source of truth, normalize/validate IPs, reject malformed/private spoofed candidates where appropriate, and add tests for direct-origin requests with spoofed headers.

### LF-SEC-04 - Open: legacy partner-consent refresh route is a dead/high-risk API surface

Severity: Medium.

Evidence:
- `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts:10-17` performs a direct `CRON_SECRET` bearer comparison instead of `guardCronRequest` / `verifyInternalAuth`.
- It refreshes a single consent by arbitrary id and writes tokens directly at `apps/web/src/app/api/partner-consents/[id]/refresh/route.ts:47-63`.
- The main connector runtime already has safer CAS/tokenVersion refresh in `apps/web/src/lib/connector-oauth.ts:180-227`, used by dispatch in `apps/web/src/lib/connector-runtime.ts:461-466`.

Impact:
- This route appears unused by the current dispatcher and duplicates token-refresh logic without the race protections, rate limits, and shared auth guard used elsewhere.

Recommendation:
- Remove it if unused.
- If a standalone refresh endpoint is needed, move it under `/api/cron/`, use `guardCronRequest`, call `refreshConsentAccessToken`, add route-level rate limiting/audit, and avoid accepting arbitrary ids from external callers.

### LF-SEC-05 - Open: one broad CRON_SECRET can drive admin backup/retention actions

Severity: Medium.

Evidence:
- Full admin backup cron accepts `verifyInternalAuth(..., "cron")` in `apps/admin/src/app/api/cron/backup/route.ts:54`.
- Backup retention also accepts cron auth in `apps/admin/src/app/api/backup/retention/route.ts:153` and bypasses the manual super-admin permission path when it matches.

Impact:
- This is not missing auth; it is a secret-scope problem. If the general cron secret is leaked from any scheduled job or environment, it can create full backup archives and run retention cleanup.

Recommendation:
- Split high-impact admin backup secrets from general web cron secrets, e.g. `ADMIN_BACKUP_CRON_SECRET` and `ADMIN_RETENTION_CRON_SECRET`.
- Rotate existing cron secrets, add per-route limits/audit, and restrict these endpoints by network or scheduler identity if the platform supports it.

### LF-SEC-06 - Open: production auth rate limiting can degrade to per-instance memory when Redis is absent

Severity: Medium configuration risk.

Evidence:
- Admin login intentionally falls back to `checkLoginRateLimitMemory` when Upstash is unconfigured in `apps/admin/src/app/api/auth/login/route.ts:227-230`.
- Memory limiter implementation is in `apps/admin/src/app/api/auth/login/route.ts:289-313`.

Impact:
- In a multi-instance production/staging deployment, attackers can spread attempts across instances or wait out deploy restarts.

Recommendation:
- Fail closed for admin/auth limiters in production when Redis is not configured, or fail deployment readiness before traffic.
- Keep memory fallback for local development only.

### LF-SEC-07 - Open hardening: mover portal email token is also the 14-day session token

Severity: Medium-Low.

Evidence:
- `apps/web/src/lib/mover-portal-auth.ts:18-20` defines a 14-day portal token TTL.
- `consumeMoverPortalToken` validates the URL token and stores the same raw token as the `mover_portal` cookie in `apps/web/src/lib/mover-portal-auth.ts:80-85`.

Impact:
- A copied email URL remains a session bearer until expiry or logout. This is an intentional design but broader than typical magic-link hygiene.

Recommendation:
- Make emailed links single-use with a short TTL, exchange them for a separate session token/cookie, revoke older active mover-portal tokens on new login, and audit portal sign-ins.

### LF-SEC-08 - Closed/Low: local `.env.local` contains dev secrets but is ignored

Severity: Low operational hygiene.

Evidence:
- `.env.local` is present locally and ignored by `.gitignore`; no tracked env secret file was found.

Impact:
- Not a GitHub source leak in the current tree. Risk is local sharing/archiving only.

Recommendation:
- Keep ignored. Do not copy into reports, tickets, or screenshots. Rotate if this workspace is ever shared.

## Candidate Closure

- `worker-01-cand-002`: validated and fixed as LF-SEC-01.
- `worker-01-cand-001`: validated as design hardening, LF-SEC-07.
- `LF-W02-001`: closed as LF-SEC-08.
- `LF-W02-002`: validated as LF-SEC-04.
- `LF-W02-003`, `LF-W02-004`: validated as LF-SEC-05.
- `LF-W02-005`: validated as LF-SEC-06.
- `LF-W02-006`, `LF-W02-007`, `LF-W03-001`, `WORKER-04-CAND-002`, `LF-W05-001`, `LF-W05-002`, `CAND-001`: deduped into LF-SEC-02.
- `WORKER-04-CAND-001`, `CAND-002`, `CAND-003`: deduped into LF-SEC-03.

## Verification

- `pnpm --filter @locateflow/web exec tsc --noEmit`: passed.
- `pnpm --filter @locateflow/web exec vitest run src/middleware.test.ts`: 33/33 passed.
- Prior full-suite verification remains recorded in `VERIFICATION_LOG.md`.
