# Global Findings

## Severity Summary

| Severity | Count | IDs |
| --- | ---: | --- |
| Critical | 0 | none verified |
| High | 0 | none verified |
| Medium | 5 | SEC-DEPLOY-001, SEC-WORKSPACE-001, PRIV-TRACK-001, UX-MOB-001, REPO-HYGIENE-001 |
| Low | 2 | UX-THEME-001, SEC-CONNECTOR-001 |
| Inconclusive | 1 | AUDIT-COVERAGE-001 |

## Findings

### SEC-DEPLOY-001: Mutable third-party image tags in production-like compose

Severity: Medium
Priority: P1

Evidence:

- `docker-compose.dokploy.yml:343` uses `darthsim/imgproxy:latest`.
- `docker-compose.dokploy.yml:372` uses `mcuadros/ofelia:latest`.

Impact:

- Image behavior can change without code review or reproducible deploy evidence.

Risk:

- Supply-chain and rollback risk.

Recommendation:

- Pin each third-party image to a reviewed version or digest.
- Add a config/CI check that blocks `:latest` in production compose files.

### SEC-WORKSPACE-001: Workspace member administration lacks step-up parity

Severity: Medium
Priority: P1

Evidence:

- Workspace delete, restore, and transfer routes import/use `requireWorkspaceStepUp` at `apps/web/src/app/api/workspaces/[id]/delete/route.ts:6`, `apps/web/src/app/api/workspaces/[id]/delete/route.ts:35`, `apps/web/src/app/api/workspaces/[id]/restore/route.ts:6`, `apps/web/src/app/api/workspaces/[id]/restore/route.ts:29`, `apps/web/src/app/api/workspaces/[id]/transfer/route.ts:9`, and `apps/web/src/app/api/workspaces/[id]/transfer/route.ts:41`.
- Workspace member role/status changes authenticate the session and check workspace permissions at `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:69`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:72`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:101`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:104`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:181`, and `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:196`.
- Workspace member removal authenticates the session and checks `member.remove` at `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:252`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:255`, `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:266`, and deletes the membership at `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:276`.
- Workspace invitation creation authenticates the session and checks invite/promote permissions at `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:53`, `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:56`, `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:64`, `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:82`, then creates an invitation at `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:141`.

Impact:

- A stolen active browser session can invite, promote, suspend/reactivate, or remove household/workspace members without the same password/MFA step-up used for workspace delete, restore, and transfer.

Risk:

- Account-sharing and household-control operations are high-trust actions. CSRF and role checks reduce risk, but they do not mitigate active session theft or unattended unlocked-device scenarios.

Recommendation:

- Reuse `requireWorkspaceStepUp` for admin invite, admin promotion, member role changes, suspension/reactivation, and member removal.
- Add workspace audit events and tests for missing/invalid/valid step-up on these actions.
- Consider lower-friction handling for self-service leave and non-privileged updates.

### PRIV-TRACK-001: Analytics metadata sanitizer can miss sensitive data under benign keys

Severity: Medium
Priority: P1

Evidence:

- `apps/web/src/app/api/tracking/event/route.ts:13` defines a PII key pattern.
- `apps/web/src/app/api/tracking/event/route.ts:28-32` sanitizes by key pattern and value heuristics.
- `apps/web/src/app/api/tracking/event/route.ts:105`, `apps/web/src/app/api/tracking/event/route.ts:156`, and `apps/web/src/app/api/tracking/event/route.ts:161` persist serialized metadata.

Impact:

- Sensitive strings can be retained if sent under keys not covered by the regex and not matching current heuristics.

Risk:

- Privacy and data-minimization weakness in event storage.

Recommendation:

- Use event-specific metadata allowlists.
- Drop unknown keys by default.
- Add tests for benign-key/sensitive-value cases.

### UX-MOB-001: Mobile dynamic theming is incomplete where static theme imports remain

Severity: Medium
Priority: P1/P2 based on product promise

Evidence:

- `apps/mobile/src/lib/theme.ts:35-48` documents static and context-driven theming.
- `apps/mobile/src/lib/theme.ts:240` exports static dark `theme`.
- Source search found 100 mobile files referencing static `theme.colors`, `theme.spacing`, `theme.radius`, or `theme.shadow`.

Impact:

- Theme preference changes can produce mixed visual states.

Risk:

- UI inconsistency, lower trust, accessibility/contrast drift if light-mode assumptions differ.

Recommendation:

- Migrate static theme call sites by screen priority to `useAppTheme`/`useThemedStyles`.
- Add mobile visual QA for dark, light, and system modes.

### REPO-HYGIENE-001: Credential-like content exists in legacy markdown

Severity: Medium
Priority: P1 if real/reused, P2 if fake/stale

Evidence:

- `SYSTEM_STATUS.md` has credential-like/admin setup markers at lines 19, 42, 44, 58, 60, 63, 121, and 245.
- Values were not printed, copied, or summarized.

Impact:

- If any value is real, active, or reused, repository readers may be exposed to sensitive setup material.

Risk:

- Secret hygiene and operational confusion.

Recommendation:

- Owner should verify, redact/remove, and rotate anything potentially real.

### UX-THEME-001: Manual token synchronization can drift

Severity: Low
Priority: P2

Evidence:

- `packages/shared/src/design-tokens.ts:22` documents manual sync for web/admin CSS.
- Web CSS tracking variables are zero at `apps/web/src/styles/globals.css:201-202`.
- Web/admin Tailwind display tracking uses negative values at `apps/web/tailwind.config.ts:181-184` and `apps/admin/tailwind.config.ts:170-173`.

Impact:

- Brand, accessibility, and layout changes can diverge across surfaces.

Risk:

- UI inconsistency and slower design-system maintenance.

Recommendation:

- Generate theme outputs or add drift tests.

### SEC-CONNECTOR-001: Connector fallback action mutations lack step-up parity

Severity: Low
Priority: P2

Evidence:

- Connector config creation/update uses password/MFA step-up at `apps/admin/src/app/api/connectors/route.ts:197-198` and `apps/admin/src/app/api/connectors/route.ts:248-249`.
- Fallback action POST uses admin create permission at `apps/admin/src/app/api/connector-fallbacks/route.ts:71`, validates input at `apps/admin/src/app/api/connector-fallbacks/route.ts:83-114`, then upserts at `apps/admin/src/app/api/connector-fallbacks/route.ts:128-130`.
- Fallback action DELETE uses admin delete permission at `apps/admin/src/app/api/connector-fallbacks/route.ts:149`, then deletes at `apps/admin/src/app/api/connector-fallbacks/route.ts:155`.
- No `requirePasswordConfirm` call was detected in `apps/admin/src/app/api/connector-fallbacks/route.ts`.

Impact:

- A compromised active admin browser session could alter connector fallback guidance, phone/mailto targets, or local fallback paths without the same password/MFA confirmation used by connector config writes.

Risk:

- User-guidance and provider-boundary integrity risk. Existing URL type validation and audit logging reduce severity.

Recommendation:

- Add password/MFA step-up to fallback action POST and DELETE, or document an explicit no-step-up rationale with tests.

### AUDIT-COVERAGE-001: Dependency vulnerability result is inconclusive locally

Severity: Inconclusive
Priority: P1 follow-up

Evidence:

- Local `pnpm audit --prod --audit-level high` timed out after about 124 seconds.
- CI has a production dependency audit step at `.github/workflows/ci.yml:85-86`.

Impact:

- This local audit pass cannot confirm current dependency vulnerability status.

Risk:

- Vulnerabilities could be present but not confirmed in this pass.

Recommendation:

- Re-run with an approved longer timeout or inspect the latest trusted CI audit artifact.
