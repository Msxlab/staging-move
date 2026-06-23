# Module Audit: Notifications, Email, Push

Status: mapped.

## Source Inspected

- Prisma notification/email/push-related models.
- Mobile package manifest and route inventory.

## Verified Facts

- Push device, notification preference, notification, queue, email template, and email log models exist.

Evidence:

- `packages/db/prisma/schema.prisma:88`
- `packages/db/prisma/schema.prisma:1459`
- `packages/db/prisma/schema.prisma:1476`
- `packages/db/prisma/schema.prisma:1512`
- `packages/db/prisma/schema.prisma:1539`
- `packages/db/prisma/schema.prisma:1564`

## Findings

No source-backed notification finding was verified in this pass.

## Not Verified In Code

- Consent/preference enforcement across all notification send paths.
- Push token lifecycle and deletion behavior.
- Email retry/dedupe behavior.
- User unsubscribe and preference UX.

## Next Steps

- Map each notification type to consent/preference source, send route, dedupe key, retry path, and audit log.
