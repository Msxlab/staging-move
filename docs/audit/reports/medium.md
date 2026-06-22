# Medium Findings

## SEC-DEPLOY-001: Mutable third-party production-like images

Evidence:

- `docker-compose.dokploy.yml:343`
- `docker-compose.dokploy.yml:372`

Impact:

- Production-like runtime can change without repo review.

Recommendation:

- Pin to reviewed version tags or digests and add a config check.

## PRIV-TRACK-001: Tracking metadata sanitizer is not strict enough

Evidence:

- `apps/web/src/app/api/tracking/event/route.ts:13`
- `apps/web/src/app/api/tracking/event/route.ts:28-32`
- `apps/web/src/app/api/tracking/event/route.ts:105`
- `apps/web/src/app/api/tracking/event/route.ts:156`
- `apps/web/src/app/api/tracking/event/route.ts:161`

Impact:

- Sensitive values can be persisted under benign metadata keys.

Recommendation:

- Use strict per-event metadata allowlists and tests.

## SEC-WORKSPACE-001: Workspace member administration lacks step-up parity

Evidence:

- `apps/web/src/app/api/workspaces/[id]/delete/route.ts:35`
- `apps/web/src/app/api/workspaces/[id]/restore/route.ts:29`
- `apps/web/src/app/api/workspaces/[id]/transfer/route.ts:41`
- `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:69`
- `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:72`
- `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:101`
- `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:104`
- `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:252`
- `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:255`
- `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:266`
- `apps/web/src/app/api/workspaces/[id]/members/[memberId]/route.ts:276`
- `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:53`
- `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:56`
- `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:64`
- `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:82`
- `apps/web/src/app/api/workspaces/[id]/invitations/route.ts:141`

Impact:

- Active-session compromise can modify household/workspace membership without password/MFA confirmation.

Recommendation:

- Reuse `requireWorkspaceStepUp` for privileged invite, role/status, and member-removal actions; add tests.

## UX-MOB-001: Mobile theme switching is incomplete for static theme users

Evidence:

- `apps/mobile/src/lib/theme.ts:35-48`
- `apps/mobile/src/lib/theme.ts:240`
- 100 mobile files reference static theme fields.

Impact:

- Mixed dark/light UI states can appear after changing preference.

Recommendation:

- Migrate priority screens to `useAppTheme`/`useThemedStyles`.

## REPO-HYGIENE-001: Credential-like markdown content

Evidence:

- `SYSTEM_STATUS.md` has credential-like/admin setup markers at lines 19, 42, 44, 58, 60, 63, 121, and 245.
- Values were intentionally not reproduced.

Impact:

- If real or reused, secrets may be exposed to repository readers.

Recommendation:

- Verify, redact/remove, and rotate anything potentially real.
