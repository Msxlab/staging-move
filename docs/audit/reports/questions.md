# Open Questions

All items below are `not verified in code` in this pass.

## Security

- Does every web API route have a clear public/user/workspace/cron/internal/webhook classification?
- Does every admin API route have a clear role/permission/step-up classification?
- Are all destructive admin actions protected by password confirmation or a stronger step-up?
- Are cron/internal secrets separated and rotated by bucket in current runtime config?
- Does production rate limiting use Redis for high-risk routes and fail closed where intended?

## Privacy/Data

- Does account deletion remove or anonymize analytics, connector, partner, lead, notification, and audit-adjacent records according to policy?
- Does export include all user-visible data and exclude internal/security-only metadata?
- Are connector dispatch records retained only as long as needed?
- Are telemetry metadata schemas intentionally limited by event type?
- Should backup records, mover documents, partner leads, connector dispatch payloads, and address-change confirmations be included, excluded, or retained-only in export/delete policy?

## Billing/IAP

- Are entitlement transitions tested for purchase, renewal, cancellation, expiration, refund, revocation, sandbox/test, duplicate, and out-of-order events?
- Is mobile UI entitlement state always server-authoritative?
- Are live billing credentials unavailable in local/staging by default?

## Connectors

- Should connector fallback action POST/DELETE require the same password/MFA step-up as connector config writes?
- Are connector dispatch records, encrypted payloads, and confirmations retained only as long as needed?
- Are connector dispatch records included in export/delete flows where policy requires it?

## UI/UX

- Do web/admin/mobile screens pass visual QA in dark and light themes?
- Are mobile theme changes live on all priority screens?
- Are long labels, translations, empty states, and errors polished on mobile and desktop?
- Is keyboard/focus/screen-reader behavior verified for core flows?

## Ops

- Are `tmp-*` untracked artifacts intentional local QA output?
- Are mutable image tags acceptable anywhere outside local development?
- What is the latest trusted dependency audit result from CI?
- When was the last disposable restore drill run from an app-level backup and a SQL dump?
