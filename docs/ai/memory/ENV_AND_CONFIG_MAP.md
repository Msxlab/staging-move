# Environment and Config Map

Updated: 2026-06-15

## Evidence Rules

- `.env` and `.env.*` files were not read.
- This map is based on source references, runtime config definitions, manifests, Docker/CI config, and EAS config.
- Values are intentionally not recorded.

## Config Architecture

- `packages/shared/src/runtime-config.ts` defines managed runtime config keys, masking, validation, required-in-production flags, categories, and source resolution.
- `apps/web/src/lib/runtime-config.ts` resolves env first when configured as authoritative, then DB-backed `RuntimeConfigEntry` where allowed.
- `apps/admin/src/lib/runtime-config.ts` lists/validates/updates runtime config and rejects deployment-only keys.
- `packages/shared/src/env-catalog.ts` classifies expected env keys as required, optional, or platform and reports presence without raw values.

## Required Production Categories

- Core secrets: `USER_JWT_SECRET`, `ADMIN_JWT_SECRET`, `FIELD_ENCRYPTION_KEY`, `CRON_SECRET`, `INTERNAL_WEBHOOK_SECRET`, `IMPERSONATION_HANDOFF_SECRET`.
- Database: `DATABASE_URL`.
- Distributed state: `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`.
- Canonical URLs: `APP_URL`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_ADMIN_URL`.
- Stripe web billing: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, Stripe price IDs.
- Email: `RESEND_API_KEY`, `EMAIL_FROM`, `SUPPORT_EMAIL`.
- Maps/Places: `GOOGLE_MAPS_API_KEY`.
- Storage/images: R2 endpoint/bucket/access keys/public base, imgproxy key/salt/public URL.

## Optional / Feature Flags Observed

- `FEATURE_API_CONNECTORS`
- `WORKSPACE_MODEL_ENABLED`
- `DAILY_DIGEST_ENABLED`
- `ADMIN_DIGEST_*`
- `FCC_BDC_*`
- `ELECTRIC_LOOKUP_ENABLED`
- `OPENEI_API_KEY`
- `AIRNOW_API_KEY`
- `CENSUS_API_KEY`
- `HUD_*`
- `NLR_*`
- `NOTIFICATION_PUSH_ENABLED`
- `SECURITY_ALERTS_ENABLED`
- `SECURITY_ALERT_WEBHOOK_URL`
- `SLACK_WEBHOOK_URL`
- `COPPA_AGE_GATE_ENABLED`
- `PLACES_AUTOCOMPLETE_*`
- `NEXT_PUBLIC_SENTRY_DSN`
- `TRUSTED_PROXY_HEADERS`
- mobile `EXPO_PUBLIC_*` API/store/OAuth/Sentry flags

## Deployment/Platform Keys

- `NODE_ENV`
- `APP_ENV`
- `VERCEL_ENV`
- `NEXT_RUNTIME`
- `DIGITALOCEAN_APP_ID`
- `EAS_BUILD_*`

## Validation and Masking Controls

- Secret values are masked before display.
- Public runtime config keys that look like secrets are detected.
- Stripe key prefixes and production live-key expectations are validated.
- Field encryption/imgproxy keys require 64 hex characters.
- URL keys validate scheme/shape and selected keys require HTTPS.
- Deployment-only keys cannot be stored in Runtime Config DB.
- Runtime config DB values are ignored when deployment env is authoritative unless a restricted break-glass override is enabled for selected Stripe keys.

## Config Risks

- Distributed Redis config is a production readiness gate. Without it, important controls degrade to process-local memory.
- Docker/runtime startup migration behavior should be decoupled from application boot.
- Production EAS mobile store-purchase flags are enabled, so server and store-side IAP config must be complete before release.

## Not Verified

- Actual deployed environment variable presence/values.
- DigitalOcean app spec.
- App Store / Play / Stripe dashboard configuration.
