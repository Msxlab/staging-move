# High Findings

No high-severity findings were verified in this first-pass source/config audit.

High-risk areas still requiring deep review:

- Billing, Stripe, Apple IAP, Google Play IAP.
- Authentication and account deletion.
- Address-change connectors and provider integrations.
- Admin backup/import/restore.
- Webhooks and cron/internal routes.
- User data export/deletion and analytics privacy.

Each unverified item should remain marked `not verified in code` until a route/test/source pass proves it.
