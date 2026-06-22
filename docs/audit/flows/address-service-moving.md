# Flow Audit: Address, Service, Moving

Status: source-backed connector route matrix added.

## Verified Flow Components

- Address, service, service cost log, moving plan, budget, reminder, move task, provider, and connector models exist.
- Connector dispatch route requires user session, workspace scope/action, feature gate, entitlement, and then enqueues address-change dispatch.
- Connector runtime encrypts dispatch payloads, uses idempotency keys, rate limits by connector/user, claims queued rows atomically, and encrypts confirmation numbers.
- Connector fallback action writes are admin permission-gated, validated, and audited, but step-up parity is missing.

Evidence:

- `packages/db/prisma/schema.prisma:434`
- `packages/db/prisma/schema.prisma:488`
- `packages/db/prisma/schema.prisma:585`
- `packages/db/prisma/schema.prisma:605`
- `packages/db/prisma/schema.prisma:649`
- `packages/db/prisma/schema.prisma:689`
- `packages/db/prisma/schema.prisma:939`
- `packages/db/prisma/schema.prisma:733`
- `packages/db/prisma/schema.prisma:2059`
- `docs/audit/reports/connectors-address-change-route-matrix.md`

## Not Verified In Code

- End-to-end move creation and service update behavior.
- Address PII minimization.
- Complete connector submission boundaries across every provider.
- Reminder scheduling correctness.
- Dispatch retention, export, deletion, and user notification behavior.

## Recommendation

- Build a user-flow QA script covering move setup, address entry, service selection, reminder/task creation, connector fallback, and deletion/export.
- Decide whether connector fallback action writes require password/MFA step-up.
