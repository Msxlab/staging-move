# Key Rotation Runbook

Use this for routine rotation or suspected compromise of current-system secrets.

## Secret Classes

- `USER_JWT_SECRET`: user session signing.
- `ADMIN_JWT_SECRET`: admin session signing.
- `INTERNAL_WEBHOOK_SECRET`: generic internal webhook authentication.
- `CRON_SECRET`: cron-only authentication.
- `IMPERSONATION_HANDOFF_SECRET`: admin-to-web impersonation handoff.
- `FIELD_ENCRYPTION_KEY`: encrypted fields such as MFA secrets.
- Billing/store secrets: Stripe, App Store, Google Play.
- Backup storage credentials.

## Rotation Steps

1. Identify the exact secret and downstream systems.
2. Create the replacement secret in the secret manager/runtime config.
3. Deploy or reload affected services.
4. Revoke old credentials where provider supports revocation.
5. Verify affected workflows.
6. Add an admin audit or incident note with timestamp and owner.

## Session-Signing Secrets

- Rotating `USER_JWT_SECRET` invalidates user sessions.
- Rotating `ADMIN_JWT_SECRET` invalidates admin sessions.
- Notify support before planned rotations.

## Field Encryption Key

Do not rotate `FIELD_ENCRYPTION_KEY` casually. Current encrypted values require a planned re-encryption path or explicit reset/re-enrollment of affected secrets.

## Verification

- User login works.
- Admin login and MFA work.
- Cron/internal routes reject old secret and accept the intended scoped secret.
- Billing webhooks still verify signatures.
- Backup upload/download works if storage keys changed.
