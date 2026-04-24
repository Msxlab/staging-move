# PII Breach Response Runbook

Use this for suspected or confirmed exposure of user data, session material, auth credentials, billing identifiers, addresses, support content, backups, or admin exports.

## First Response

1. Stop the leak source.
2. Preserve evidence.
3. Identify affected systems, users, fields, and time window.
4. Classify data sensitivity.
5. Start legal/privacy notification assessment.

## Data Classes In Current System

- High sensitivity: passwords/password hashes, MFA secrets/backup codes, session tokens/hashes, reset/verification token hashes, backup archives, runtime secrets.
- Medium sensitivity: email, name, addresses, subscription identifiers, support messages, IP/user agent/session history.
- Lower sensitivity: non-PII aggregate analytics, public provider catalog data.

## Containment Examples

- Session/token leak: revoke sessions and rotate JWT secret if needed.
- Backup archive exposure: revoke storage credentials, rotate backup storage keys, assess archive contents.
- Runtime secret exposure: rotate the exact secret and any downstream secret it could access.
- Admin export exposure: identify export scope and affected rows.

## Notification Assessment

Record:

- What data was exposed.
- Whether data was viewed, downloaded, or only technically accessible.
- Number of affected users.
- Jurisdictions involved.
- Whether credentials/session material were included.

Do not send legal breach notices without privacy/legal owner approval, but do not delay internal escalation.

## Closure

- Confirm containment.
- Complete user/admin remediation.
- Add monitoring for repeated access attempts.
- Write post-incident action items.
