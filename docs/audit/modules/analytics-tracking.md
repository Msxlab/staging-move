# Module Audit: Analytics And Tracking

Status: scanned for event route.

## Source Inspected

- `apps/web/src/app/api/tracking/event/route.ts`
- Prisma `UserEvent` model reference

## Verified Facts

- Tracking event route has a sanitizer.
- Metadata is serialized and stored.
- Batch endpoint caps events with `events.slice(0, 50)`.

Evidence:

- `apps/web/src/app/api/tracking/event/route.ts:13`
- `apps/web/src/app/api/tracking/event/route.ts:28-32`
- `apps/web/src/app/api/tracking/event/route.ts:105`
- `apps/web/src/app/api/tracking/event/route.ts:139`
- `apps/web/src/app/api/tracking/event/route.ts:156`
- `apps/web/src/app/api/tracking/event/route.ts:161`
- `packages/db/prisma/schema.prisma:1190`

## Findings

- `PRIV-TRACK-001`

## Not Verified In Code

- All event names and intended metadata schemas.
- Retention policy for `UserEvent`.
- User export/deletion treatment of analytics rows.
- Whether production sampling is enabled or disabled.

## Next Steps

- Create event-schema allowlist.
- Add tests for sensitive values under benign keys.
- Document retention and deletion behavior.
