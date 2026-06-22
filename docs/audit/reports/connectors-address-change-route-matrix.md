# Connectors And Address-Change Route Matrix

Date: 2026-06-22
Scope: connector catalog, consent, dispatch, webhook, admin connector controls, connector runtime, and connector package contracts.

This is a source-backed matrix pass. No live USPS, carrier, provider, Stripe, Apple, Google, or production credentials were used.

## Method

Inspected connector and address-change routes, connector runtime helpers, OAuth consent helpers, Prisma connector models, and the `packages/connectors` contract files with targeted source searches.

## Web Connector Routes

| Route | Methods | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/web/src/app/api/connectors/catalog/route.ts` | GET | `getUserSession` at lines 3 and 119 | feature gate at line 126; connector registry at line 129; OAuth URL allowlist check at lines 46-47 | No bypass verified |
| `apps/web/src/app/api/connectors/changes/route.ts` | GET | `getUserSession` at lines 3 and 16 | session-user scoped query and no-store response at lines 18 and 40 | No bypass verified |
| `apps/web/src/app/api/connector-dispatch/route.ts` | POST | `getUserSession` at lines 3 and 20 | workspace scope/action check at lines 24-25; feature gate at line 27; entitlement check at line 30; enqueues address change at line 55 | No bypass verified |
| `apps/web/src/app/api/connectors/[key]/webhook/route.ts` | POST | connector-specific webhook signature header at line 32 | feature gate at line 44; webhook secret config at line 49; HMAC verifier at lines 55-57; fail-closed missing secret at lines 97-100; invalid signature rejection at lines 105-106; idempotency reserve at lines 130-131; terminal dispatch no-reopen at line 145 | No bypass verified |
| `apps/web/src/app/api/partner-consents/route.ts` | GET | `getUserSession` at line 3 and session at line 23 | comment states encrypted token is never exposed at lines 17-20; selected fields at lines 35-41 exclude token columns | No bypass verified |
| `apps/web/src/app/api/partner-consents/[id]/route.ts` | DELETE | session auth at lines 13-14 | route comment says revoke own consent and zero token at lines 8-10; implementation delegates to `revokeConsent` | No bypass verified |
| `apps/web/src/app/api/partner-consents/oauth/initiate/route.ts` | GET | `getUserSession` at lines 2 and 29 | feature gate at line 33; workspace scope/action at lines 39-40; entitlement at line 48; connector/config validation at lines 52-63; state/PKCE cookies at lines 83-85 | No bypass verified |
| `apps/web/src/app/api/partner-consents/oauth/callback/route.ts` | GET | `getUserSession` at lines 2 and 50-51 | feature gate at line 52; state/code validation at lines 57-64; workspace scope/action at lines 70-71; entitlement at line 81; token exchange at lines 92-93; server-side token persistence at lines 98-108 | No bypass verified |
| `apps/web/src/app/api/cron/connector-dispatch/route.ts` | GET, POST | `guardCronRequest` import at line 2 and guard at line 21 | feature gate at line 23; dispatch worker entry at lines 32 and 35 | No bypass verified |
| `apps/web/src/app/api/cron/partner-consents/[id]/refresh/route.ts` | POST | cron route family | refresh helper verified in `apps/web/src/lib/partner-consent-refresh.ts` | Full route body not manually proven in this pass |

## Admin Connector Routes

| Route | Methods | Boundary observed | Important controls | Status |
| --- | --- | --- | --- | --- |
| `apps/admin/src/app/api/connectors/route.ts` | GET | `requirePermission("connectors", "canRead", { minimumRole: "ADMIN" })` at line 80 | lists connector config, dispatch counts, consent counts, and recent failures | No bypass verified |
| `apps/admin/src/app/api/connectors/route.ts` | POST | `requirePermission("connectors", "canCreate", { minimumRole: "ADMIN" })` at line 186 | password/MFA step-up at lines 197-198; starts disabled/SHADOW by route comment at line 183; audit at lines 226-227 | No bypass verified |
| `apps/admin/src/app/api/connectors/route.ts` | PUT | `requirePermission("connectors", "canUpdate", { minimumRole: "ADMIN" })` at line 241 | password/MFA step-up at lines 248-249; controls enabled/rollout/stage/circuit at lines 265-271; audit at lines 278-281 | No bypass verified |
| `apps/admin/src/app/api/connectors/[connectorKey]/route.ts` | GET | `requirePermission("connectors", "canRead", { minimumRole: "ADMIN" })` at line 96 | read-only detail route; comment says mutation uses separate step-up routes at lines 88-92 | No bypass verified |
| `apps/admin/src/app/api/connectors/test-connection/route.ts` | POST | `requirePermission("connectors", "canRead", { minimumRole: "ADMIN" })` at line 27 | read-style credential canary; USPS-only guard at lines 29-39 | No bypass verified |
| `apps/admin/src/app/api/connectors/healthcheck/route.ts` | POST | `requirePermission("connectors", "canRead", { minimumRole: "ADMIN" })` at line 43 | tokenless health canary; idempotency key at line 70; connector health check at line 75 | No bypass verified |
| `apps/admin/src/app/api/connectors/consents/route.ts` | GET | `requirePermission` at line 28 | comment says encrypted token is never selected at lines 23-24; selected fields at lines 40-47 exclude token columns | No bypass verified |
| `apps/admin/src/app/api/connectors/consents/route.ts` | POST | `requirePermission` at line 81 | bulk revoke uses password/MFA step-up at lines 90-91; token columns nulled at lines 104-110; dispatches canceled at lines 115-119 | No bypass verified |
| `apps/admin/src/app/api/connector-fallbacks/route.ts` | GET | `requirePermission("connectors", "canRead", { minimumRole: "ADMIN" })` at line 58 | read-only fallback action list | No bypass verified |
| `apps/admin/src/app/api/connector-fallbacks/route.ts` | POST | `requirePermission("connectors", "canCreate", { minimumRole: "ADMIN" })` at line 71 | action/url validation at lines 83-114; URL type allowlist at lines 41-47; audit at lines 133-137 | Finding `SEC-CONNECTOR-001` |
| `apps/admin/src/app/api/connector-fallbacks/route.ts` | DELETE | `requirePermission("connectors", "canDelete", { minimumRole: "ADMIN" })` at line 149 | action key validation at lines 150-153; delete and audit at lines 155-160 | Finding `SEC-CONNECTOR-001` |

## Runtime And Contract Controls

| Area | Evidence | Notes |
| --- | --- | --- |
| Address-change enqueue | `apps/web/src/lib/connector-runtime.ts:179-330` | consent lookup, connector config, rate limits, encrypted dispatch payload, idempotency key, and address-change status update are visible in source. |
| Egress allowlist | `apps/web/src/lib/connector-runtime.ts:152-169` | OAuth endpoints are required to be HTTPS and host allowlisted. |
| Dispatch worker claim | `apps/web/src/lib/connector-runtime.ts:541-623` | worker sweeps stale rows, selects due queued rows, and atomically flips `QUEUED` to `DISPATCHING`. |
| Payload and confirmations | `apps/web/src/lib/connector-runtime.ts:382-384`, `apps/web/src/lib/connector-runtime.ts:530` | payloads and confirmation numbers are encrypted at rest. |
| Consent token storage | `apps/web/src/lib/connector-oauth.ts:263-348` | granted consent stores encrypted access and refresh tokens. |
| Consent revocation | `apps/web/src/lib/connector-oauth.ts:372-395` | revoked consent nulls tokens and cancels queued/dispatching rows. |
| Connector contract | `packages/connectors/src/core/types.ts:88-104` | manifest includes auth, scopes, allowed hosts, and rate limits. |
| Manifest validation | `packages/connectors/src/core/manifest.ts:20-48` | invalid allowed hosts, missing OAuth scopes, and missing fallback actions for push-capable connectors are rejected. |
| Contract test kit | `packages/connectors/src/core/contract-test-kit.ts:57-80` | built requests are checked for valid methods and allowlisted target hosts. |
| USPS connector | `packages/connectors/src/usps/index.ts:36-48`, `packages/connectors/src/usps/index.ts:96-97` | scopes, allowed host, rate limits, fallback action, Bearer auth, and idempotency header are declared. |

## Findings

### SEC-CONNECTOR-001: Connector fallback action mutations lack step-up parity

Severity: Low
Priority: P2

Evidence:

- Connector config creation/update uses `requirePasswordConfirm` for `connector_config_write` at `apps/admin/src/app/api/connectors/route.ts:197-198` and `apps/admin/src/app/api/connectors/route.ts:248-249`.
- Fallback action POST uses admin create permission at `apps/admin/src/app/api/connector-fallbacks/route.ts:71`, validates action and URL shape at `apps/admin/src/app/api/connector-fallbacks/route.ts:83-114`, then upserts at `apps/admin/src/app/api/connector-fallbacks/route.ts:128-130`.
- Fallback action DELETE uses admin delete permission at `apps/admin/src/app/api/connector-fallbacks/route.ts:149`, then deletes at `apps/admin/src/app/api/connector-fallbacks/route.ts:155`.
- No `requirePasswordConfirm` call was detected in `apps/admin/src/app/api/connector-fallbacks/route.ts`.

Impact:

- A compromised active admin browser session could alter connector fallback guidance, phone/mailto targets, or local fallback paths without the same password/MFA confirmation used by connector config writes.

Risk-limiting controls:

- The route limits URL template types at `apps/admin/src/app/api/connector-fallbacks/route.ts:41-47`.
- Writes are permission-gated and audit-logged.

Recommendation:

- Add password/MFA step-up to fallback action POST and DELETE, or document an explicit no-step-up rationale with tests.

## Not Verified In Code

- Complete row-by-row proof for every provider, affiliate, and carrier-adjacent route.
- External provider response contracts beyond the checked connector package.
- User notification behavior when dispatches move to `NEEDS_USER`.
- Retention policy for connector dispatch payloads, confirmations, and address-change events.
- Live runtime connector credential separation across local, staging, and production.

## Recommended Next Tests

- Connector fallback POST/DELETE tests for missing/invalid/valid password/MFA step-up if the finding is fixed.
- Dispatch idempotency and retry tests for duplicate address-change requests.
- Webhook replay tests for duplicate connector provider callbacks.
- Consent revocation tests that prove token fields are nulled and queued/dispatching rows are canceled.
- Retention/export/delete tests for connector dispatch payloads and confirmations.
