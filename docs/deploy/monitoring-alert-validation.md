# Monitoring And Alert Validation

Purpose: validate staging observability before treating the current product as launch-ready.

## Sentry / Error Monitoring

Current code reads:

- `NEXT_PUBLIC_SENTRY_DSN` for web, admin, and mobile-compatible Sentry SDK setup.
- Optional source-map upload variables only if release upload is configured outside the current code path.

Staging env:

- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_AUTH_TOKEN` if source maps are uploaded by CI
- `SENTRY_ORG` if source maps are uploaded by CI
- `SENTRY_PROJECT` if source maps are uploaded by CI

## Redaction Checks

- [ ] User emails are redacted or minimized.
- [ ] Phone numbers are redacted or minimized.
- [ ] Passwords, password hashes, MFA secrets, reset tokens, auth tokens, cookies, API keys, private keys, backup object paths, and download URLs are filtered.
- [ ] Custom provider notes are not logged.
- [ ] Task notes/local-effect metadata are not logged beyond allowed audit context.

## Required Alerts

- [ ] Web API error spike.
- [ ] Admin API error spike.
- [ ] Mobile crash/error spike.
- [ ] Auth error/failure spike.
- [ ] Admin login failure spike.
- [ ] Backup creation failure.
- [ ] Backup verify/import failure.
- [ ] Stripe webhook failure.
- [ ] Google Play RTDN validation failure.
- [ ] Task generation failure.
- [ ] Custom provider create/update/delete failure spike.
- [ ] Rate-limit spike.
- [ ] Database connection errors.

## Staging Validation

- [ ] Trigger a harmless web test error and confirm Sentry event.
- [ ] Trigger a harmless admin test error and confirm Sentry event.
- [ ] Trigger a mobile preview test error and confirm event if mobile Sentry is configured.
- [ ] Confirm environment tag is staging.
- [ ] Confirm alert routes notify `ALERT_EMAIL_TO` or configured incident channel.
- [ ] Confirm no sensitive data appears in logs/events.

## Missing Credential Impact

If `NEXT_PUBLIC_SENTRY_DSN` is missing:

- App can run.
- Error capture and alert validation are not proven.
- Launch remains YELLOW.

If alert recipient settings are missing:

- App can run.
- Detection/response readiness is incomplete.
