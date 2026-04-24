# Incident Response

This runbook covers the current LocateFlow system: web, mobile API access, admin, billing webhooks, backups, runtime config, and support operations.

## Severity

- SEV1: confirmed or likely unauthorized access to user/admin data, auth bypass, production DB corruption, payment/webhook compromise, or admin account takeover.
- SEV2: major customer-impacting outage, billing sync breakage, backup/restore failure, or support/admin workspace outage.
- SEV3: degraded feature, isolated workflow failure, or non-sensitive operational issue.

## First 15 Minutes

1. Assign an incident commander and one scribe.
2. Capture timestamp, affected surface, suspected blast radius, and current deploy SHA.
3. Stop risky changes: pause deploys and do not run migrations unless needed for containment.
4. Contain with the smallest safe control: feature flag off, webhook disabled, admin account disabled, or session revocation.
5. Preserve evidence: do not delete logs, audit rows, webhook payload records, or backups.

## Containment Checklist

- Auth/session issue: revoke affected sessions and rotate relevant JWT/internal secrets.
- Admin compromise: disable admin account, revoke sessions, rotate admin JWT secret if needed, review `AdminAuditLog`.
- Billing webhook issue: disable the affected webhook endpoint or credentials, preserve payloads, and reconcile from provider dashboards.
- Backup/restore issue: stop restore/import attempts, snapshot current DB state, and run a dry-run verification before retrying.
- PII exposure: stop the source, preserve evidence, identify fields exposed, and start the PII breach runbook.

## Communication

- SEV1: notify engineering owner, product/business owner, and legal/privacy owner immediately.
- SEV2: notify engineering and support leads within 30 minutes.
- Customer-facing updates should be factual, dated, and avoid speculation.

## Recovery

1. Apply the minimal fix or rollback.
2. Verify affected workflows directly.
3. Keep monitoring for at least one hour after apparent recovery.
4. Write a post-incident note within five business days with impact, root cause, timeline, and action items.

## Evidence To Collect

- Deploy SHA and time.
- Relevant Sentry events.
- Admin/user audit logs.
- Webhook event IDs.
- Runtime config changes.
- Backup IDs and restore/import responses.
