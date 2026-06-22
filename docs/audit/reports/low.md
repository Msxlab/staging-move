# Low Findings

## UX-THEME-001: Manual design-token mirroring can drift

Evidence:

- `packages/shared/src/design-tokens.ts:22`
- `apps/web/src/styles/globals.css:201-202`
- `apps/web/tailwind.config.ts:181-184`
- `apps/admin/tailwind.config.ts:170-173`

Impact:

- Theme, typography, and spacing can diverge across web, admin, and mobile surfaces.

Recommendation:

- Generate CSS/Tailwind/mobile token artifacts from shared tokens or add snapshot drift tests.

## SEC-CONNECTOR-001: Connector fallback action mutations lack step-up parity

Evidence:

- `apps/admin/src/app/api/connectors/route.ts:197-198`
- `apps/admin/src/app/api/connectors/route.ts:248-249`
- `apps/admin/src/app/api/connector-fallbacks/route.ts:71`
- `apps/admin/src/app/api/connector-fallbacks/route.ts:83-114`
- `apps/admin/src/app/api/connector-fallbacks/route.ts:128-130`
- `apps/admin/src/app/api/connector-fallbacks/route.ts:149`
- `apps/admin/src/app/api/connector-fallbacks/route.ts:155`

Impact:

- Active admin-session compromise could alter fallback guidance without fresh password/MFA confirmation.

Recommendation:

- Add password/MFA step-up to fallback POST/DELETE or add an explicit tested no-step-up rationale.
