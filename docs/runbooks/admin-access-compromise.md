# Admin Access Compromise Runbook

Use this for suspected phishing, stolen admin session, malicious admin activity, or unexplained admin audit events.

## Immediate Containment

1. Disable the suspected admin account if the team route is available.
2. Revoke active admin sessions for that account.
3. If token theft is likely, rotate `ADMIN_JWT_SECRET`.
4. Review recent `AdminAuditLog` rows for user edits, backup imports, provider changes, settings/runtime config changes, team changes, notifications, and impersonation.
5. Preserve logs and do not delete the admin account until review is complete.

## Investigation

- Check login history for IP, user agent, MFA usage, and failed attempts.
- Check whether high-risk actions used step-up password confirmation.
- Check backup downloads/imports and runtime secret changes.
- Check user impersonation handoff logs.

## Recovery

1. Reset the admin password.
2. Re-enroll MFA if MFA secret/backup codes may be exposed.
3. Rotate affected runtime/internal secrets.
4. Reverse unauthorized changes where safe.
5. Notify affected users if user data or account state was accessed or changed.

## Prevention Follow-Up

- Review role and permission boundaries.
- Remove unused admin accounts.
- Confirm MFA is active for all privileged admins.
- Add a post-incident action item for any missing step-up boundary.
