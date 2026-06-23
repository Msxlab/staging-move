# Security Surface

## Verified Controls

### Web

- Public API prefixes are centralized in middleware at `apps/web/src/middleware.ts:76`.
- JSON and upload body limits are set at `apps/web/src/middleware.ts:156-157`.
- CSRF protection is applied at `apps/web/src/middleware.ts:192` and invoked at `apps/web/src/middleware.ts:809`.
- Rate limiting is applied at `apps/web/src/middleware.ts:302` and invoked at `apps/web/src/middleware.ts:812`.
- Session validation is checked at `apps/web/src/middleware.ts:575` and applied at `apps/web/src/middleware.ts:819`.
- CSP and HSTS are set at `apps/web/src/middleware.ts:752` and `apps/web/src/middleware.ts:768`.
- Internal routes sampled use `verifyInternalAuth`.

### Admin

- Public paths are centralized at `apps/admin/src/middleware.ts:24`.
- HSTS is set at `apps/admin/src/middleware.ts:253`.
- Backup body limit is set at `apps/admin/src/middleware.ts:327`.
- CSRF is implemented at `apps/admin/src/middleware.ts:355` and invoked at `apps/admin/src/middleware.ts:671`.
- Admin route rate limiting is implemented at `apps/admin/src/middleware.ts:554` and invoked at `apps/admin/src/middleware.ts:657`.
- Admin auth helpers include `requireAdmin`, `requireRole`, `requirePasswordConfirm`, and `requirePermission` at `apps/admin/src/lib/auth.ts:316`, `apps/admin/src/lib/auth.ts:347`, `apps/admin/src/lib/auth.ts:491`, and `apps/admin/src/lib/auth.ts:652`.

### CI

- CI runs a production dependency audit at `.github/workflows/ci.yml:85-86`.
- CI runs gitleaks at `.github/workflows/ci.yml:89`.
- CI checks Prisma migration status at `.github/workflows/ci.yml:138`.

## Findings

### SEC-DEPLOY-001: Mutable third-party production image tags

Severity: Medium

Evidence:

- `docker-compose.dokploy.yml:343` uses `darthsim/imgproxy:latest`.
- `docker-compose.dokploy.yml:372` uses `mcuadros/ofelia:latest`.

Impact:

- Production-like deploys can pull different image contents without a repository code change.
- Security, behavior, or runtime compatibility can change outside review.

Risk:

- Supply-chain and reproducibility risk for image proxy and scheduler infrastructure.

Recommendation:

- Pin images to reviewed version tags or immutable digests.
- Track upgrade cadence in ops docs.
- Add CI/config check for `:latest` on production compose files.

Priority:

- P1.

### PRIV-TRACK-001: Tracking metadata sanitizer is not strict enough for arbitrary metadata

Severity: Medium

Evidence:

- PII key regex is defined at `apps/web/src/app/api/tracking/event/route.ts:13`.
- Sanitizer skips values mainly when the key matches the PII pattern or when string heuristics match at `apps/web/src/app/api/tracking/event/route.ts:28-32`.
- Sanitized metadata is persisted after JSON serialization at `apps/web/src/app/api/tracking/event/route.ts:105` and `apps/web/src/app/api/tracking/event/route.ts:156`.
- Batch persistence uses `createMany` at `apps/web/src/app/api/tracking/event/route.ts:161`.

Impact:

- Sensitive free text under benign keys can be stored in `UserEvent` if it does not match the current key/value heuristics.

Risk:

- Privacy and data-minimization gap in analytics storage.

Recommendation:

- Replace generic metadata acceptance with event-specific allowlists.
- Reject or drop unknown metadata keys by default.
- Add tests for sensitive values under benign keys.
- Keep aggregate counters separate from user-level event metadata where possible.

Priority:

- P1.

### SEC-WORKSPACE-001: Workspace member administration lacks step-up parity

Severity: Medium

Evidence:

- Workspace delete/restore/transfer use `requireWorkspaceStepUp`: `apps/web/src/app/api/workspaces/[id]/delete/route.ts:35`, `apps/web/src/app/api/workspaces/[id]/restore/route.ts:29`, `apps/web/src/app/api/workspaces/[id]/transfer/route.ts:41`.
- Workspace member mutation/removal routes use session and workspace permission checks, but no step-up helper was detected in the inspected file: `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:69`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:72`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:101`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:104`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:252`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:255`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:266`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:276`.
- Workspace invite creation similarly uses session and permission checks, then creates an invitation: `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:53`, `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:56`, `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:64`, `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:82`, `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:141`.

Impact:

- Sensitive household administration actions do not have the same step-up posture as workspace delete, restore, and ownership transfer.

Recommendation:

- Add `requireWorkspaceStepUp` to privileged invitation/member administration actions and tests for step-up enforcement.

Priority:

- P1.

### REPO-HYGIENE-001: Existing markdown contains credential-like setup content

Severity: Medium

Evidence:

- `SYSTEM_STATUS.md` contains credential-like/admin setup markers at lines 19, 42, 44, 58, 60, 63, 121, and 245.
- Values were intentionally not printed or copied into this report.

Classification:

- Repository hygiene finding, not product-behavior evidence.

Impact:

- If any value is real or reused, repository readers could be exposed to credential material.

Risk:

- Secret hygiene, audit trust, and operational confusion.

Recommendation:

- Owner should verify whether these are stale/examples.
- Remove or redact credential-like material from markdown.
- Rotate any value that may have been real.
- Prefer a secret manager or local-only bootstrap flow.

Priority:

- P1 if values are real or reused; P2 if confirmed fake/stale.

### SEC-CONNECTOR-001: Connector fallback action mutations lack step-up parity

Severity: Low

Evidence:

- Connector config creation/update uses `requirePasswordConfirm` at `apps/admin/src/app/api/connectors/route.ts:197-198` and `apps/admin/src/app/api/connectors/route.ts:248-249`.
- Fallback action POST uses admin create permission and then upserts at `apps/admin/src/app/api/connector-fallbacks/route.ts:71` and `apps/admin/src/app/api/connector-fallbacks/route.ts:128-130`.
- Fallback action DELETE uses admin delete permission and then deletes at `apps/admin/src/app/api/connector-fallbacks/route.ts:149` and `apps/admin/src/app/api/connector-fallbacks/route.ts:155`.
- URL type validation limits fallback targets at `apps/admin/src/app/api/connector-fallbacks/route.ts:41-47`.

Impact:

- Admin fallback guidance can be changed without the step-up used for connector config writes.

Recommendation:

- Add `requirePasswordConfirm` to fallback action POST/DELETE, or record a tested no-step-up exception.

Priority:

- P2.

## Open Security Questions

- Are all 296 web/admin API route files classified by auth boundary? Not verified in code.
- Are all destructive admin routes protected by step-up confirmation? Not verified in code.
- Is account deletion/export complete across analytics, connectors, logs, backups, and partners? Not verified in code.
- Are production cron/internal secrets rotated and scoped by bucket? Not verified in code.
- Does current production rate limiting use Redis and fail closed for high-risk endpoints? Not verified in code.
- Dependency vulnerabilities are not verified because local `pnpm audit --prod --audit-level high` timed out.
