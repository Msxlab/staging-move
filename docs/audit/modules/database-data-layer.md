# Module Audit: Database And Data Layer

Status: mapped.

## Source Inspected

- `packages/db/prisma/schema.prisma`
- Prisma migration directory inventory
- root scripts relevant to Prisma
- CI migration status step

## Verified Facts

- Prisma schema has 87 models and 1 enum.
- Migration directory count is 72.
- CI checks Prisma migration status at `.github/workflows/ci.yml:138`.
- Root script for production-style migration deploy exists at `package.json:39`; it was not run.

## High-Risk Data Areas

- Authentication/session.
- Billing/subscriptions/IAP.
- User addresses and services.
- Connector dispatch/address-change events.
- Admin audit logs and backup records.
- Leads/partners/invoices.
- Analytics events.

## Findings

No destructive migration or data-loss bug was verified in this pass.

## Not Verified In Code

- Migration correctness.
- Query performance.
- Index coverage.
- Data retention/deletion across all models.
- Backup and restore safety.

## Next Steps

- Review migrations by domain.
- Build deletion/export matrix across models.
- Run safe local typecheck/tests before any source changes.
