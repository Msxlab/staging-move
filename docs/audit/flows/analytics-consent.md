# Flow Audit: Analytics And Consent

Status: scanned for event ingestion, mapped for consent models.

## Verified Flow

1. Tracking route receives event metadata.
2. Metadata is sanitized.
3. Metadata is serialized and stored on `UserEvent`.
4. Batch route caps processed events at 50.

Evidence:

- `apps/web/src/app/api/tracking/event/route.ts:13`
- `apps/web/src/app/api/tracking/event/route.ts:28-32`
- `apps/web/src/app/api/tracking/event/route.ts:105`
- `apps/web/src/app/api/tracking/event/route.ts:139`
- `apps/web/src/app/api/tracking/event/route.ts:156`
- `apps/web/src/app/api/tracking/event/route.ts:161`
- `packages/db/prisma/schema.prisma:1190`

## Finding

- `PRIV-TRACK-001`

## Not Verified In Code

- Full consent gate across every analytics event source.
- Retention/deletion of analytics data.
- Event schema ownership.

## Recommendation

- Move to per-event allowlists and add privacy tests before expanding analytics.
