# Email And Alerts Setup Checklist

Purpose: validate transactional email, support notifications, and operational alert delivery in staging.

## Required Staging Env

Web:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `NEXT_PUBLIC_APP_URL=https://locateflow.com`

Admin:

- `RESEND_API_KEY`
- `EMAIL_FROM`
- `ALERT_EMAIL_FROM`
- `ALERT_EMAIL_TO`

Optional:

- `SLACK_WEBHOOK_URL` if Slack alerts are enabled.

## Sender Domain

- [ ] Sender domain is verified in Resend.
- [ ] SPF is configured.
- [ ] DKIM is configured.
- [ ] DMARC is configured.
- [ ] `EMAIL_FROM` uses the verified domain.
- [ ] `ALERT_EMAIL_FROM` uses the verified domain.

## Email QA

- [ ] Email verification sends.
- [ ] Password reset sends.
- [ ] Billing/trial reminder emails can be generated in staging.
- [ ] Support notification path works or logs honest disabled state.
- [ ] Admin security/ops alerts deliver to `ALERT_EMAIL_TO`.
- [ ] No secrets or sensitive notes appear in email logs.

## Missing Credential Impact

If `RESEND_API_KEY` is missing:

- App can still run.
- Email verification and password reset cannot be fully tested.
- Staging launch remains blocked for auth recovery QA.
- Alert delivery cannot be validated.

If alert recipients are missing:

- App can still run.
- Alerting readiness remains incomplete.
