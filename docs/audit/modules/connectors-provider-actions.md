# Module Audit: Connectors And Provider Actions

Status: source-backed connector/address-change matrix added; provider ranking and retention still require deep dive.

## Source Inspected

- `packages/connectors` inventory.
- Prisma connector/provider/address-change models.
- Web connector catalog, changes, dispatch, partner consent, OAuth initiate/callback, connector webhook, and connector cron routes.
- Admin connector control, connector detail, test-connection, healthcheck, consent, and fallback action routes.
- Connector runtime and OAuth/consent helper files.

## Verified Facts

- Connector and address-change event models exist.
- Connector catalog and changes routes require user session.
- Connector dispatch requires user session, workspace scope/action, feature gate, entitlement, and then enqueues address-change dispatch.
- Connector provider webhooks use feature gates, HMAC signatures, secret fail-closed behavior, event idempotency, and terminal-dispatch no-reopen checks.
- Partner consent routes do not expose encrypted token fields in inspected responses.
- Connector config writes require admin connector permission, password/MFA step-up, and audit logging.
- Connector fallback writes require admin connector permission, input validation, URL type validation, and audit logging, but no step-up was detected.
- Provider, coverage, recommendation feedback, saved provider, affiliate, and lead/partner models exist.

Evidence:

- `packages/db/prisma/schema.prisma:733`
- `packages/db/prisma/schema.prisma:884`
- `packages/db/prisma/schema.prisma:2039`
- `packages/db/prisma/schema.prisma:2059`
- `packages/db/prisma/schema.prisma:2114`
- `packages/db/prisma/schema.prisma:2150`
- `packages/db/prisma/schema.prisma:2385`
- `packages/db/prisma/schema.prisma:2469`

## Findings

- `SEC-CONNECTOR-001`: Connector fallback action mutations lack step-up parity. See `docs/audit/reports/connectors-address-change-route-matrix.md`.

## Not Verified In Code

- Provider submission logic.
- Complete address-change retry/idempotency/fallback behavior across every connector.
- PII minimization across provider boundaries.
- Sponsored placement disclosure behavior.
- Affiliate attribution correctness.
- Connector dispatch retention/export/delete behavior.

## Next Steps

- Use `docs/audit/reports/connectors-address-change-route-matrix.md` as the starting evidence table.
- Decide whether fallback action POST/DELETE should require password/MFA step-up.
- Create provider action matrix with input, output, PII fields, external target, retry policy, retention, export/delete behavior, and user notification.
