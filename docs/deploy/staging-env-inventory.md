# Active Deployment Environment Inventory

Current branch: `pr/staging-qa-fixes`

Current active targets are DigitalOcean App Platform components on the real domains:

- Web/user app: `https://locateflow.com`
- www app alias: `https://www.locateflow.com`
- Admin app: `https://admin.locateflow.com`

The temporary `https://locateflow-staging-owew7.ondigitalocean.app` URL is legacy/starter-only. The old `https://locateflow-staging-owew7.ondigitalocean.app/move-main/login` admin path is deprecated and should not be used for active deployments.

## DigitalOcean App Platform Components

| Component | Domain | Purpose | Build command | Run command |
|---|---|---|---|---|
| `web-staging` | `locateflow.com`, `www.locateflow.com` | User app and API | `DATABASE_URL="$MYSQL_DATABASE_URL" pnpm db:generate && DATABASE_URL="$MYSQL_DATABASE_URL" pnpm --filter @locateflow/web build && pnpm web:prepare-standalone` | `DATABASE_URL="$MYSQL_DATABASE_URL" pnpm db:migrate:deploy && DATABASE_URL="$MYSQL_DATABASE_URL" HOSTNAME=0.0.0.0 PORT=$PORT node apps/web/.next/standalone/apps/web/server.js` |
| `admin-staging` | `admin.locateflow.com` | Admin console | `DATABASE_URL="${MYSQL_DATABASE_URL:-$DATABASE_URL}" pnpm db:generate && DATABASE_URL="${MYSQL_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @locateflow/admin build && pnpm admin:prepare-standalone` | `DATABASE_URL="${MYSQL_DATABASE_URL:-$DATABASE_URL}" HOSTNAME=0.0.0.0 PORT=$PORT node apps/admin/.next/standalone/apps/admin/server.js` |

Required active URL values:

```bash
NEXT_PUBLIC_APP_URL=https://locateflow.com
NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com
EXPO_PUBLIC_API_URL=https://locateflow.com/api
GOOGLE_PLAY_RTDN_AUDIENCE=https://locateflow.com/api/webhooks/playstore
APP_ENV=production
NEXT_PUBLIC_SITE_URL=https://locateflow.com
SITE_URL=https://locateflow.com
```

Although the active DigitalOcean component names still include `staging`, the
real `locateflow.com` domains must use production SEO env values. Leaving
`APP_ENV=staging` or a staging/preview canonical URL on the active web
component intentionally blocks indexing with `X-Robots-Tag: noindex`, a global
`robots.txt` disallow, an empty sitemap, and `# Not indexed` in `llms.txt`.

## Legacy Vercel Projects

These are historical references only unless staging is intentionally moved back to Vercel.

| Project | Root directory | Purpose | Build command | Notes |
|---|---|---|---|---|
| `locateflow-web-staging` | `apps/web` | User app and API | `pnpm build` from app root, or `pnpm --filter @locateflow/web build` if configured from repo root | Existing `apps/web/vercel.json` contains web cron paths. |
| `locateflow-admin-staging` | `apps/admin` | Admin console | `pnpm build` from app root, or `pnpm --filter @locateflow/admin build` if configured from repo root | Must use Vercel deployment protection plus admin login. |

Recommended Vercel settings:

- Framework preset: Next.js.
- Package manager: pnpm, pinned by root `packageManager: pnpm@9.15.0`.
- Install command: auto-detected pnpm install, or `pnpm install --frozen-lockfile` if overridden.
- Migrations: do not run during Vercel build. Run `prisma migrate deploy` separately before deployment smoke tests.
- Prisma generate: root postinstall already runs `pnpm --filter @locateflow/db generate`; if disabled in Vercel, add an explicit generate step before build.

## Secret Generation

Do not commit generated values. Generate locally and paste into Vercel/EAS/local env stores only:

```bash
openssl rand -hex 32
```

Use separate values for:

- `USER_JWT_SECRET`
- `ADMIN_JWT_SECRET`
- `FIELD_ENCRYPTION_KEY`
- `INTERNAL_WEBHOOK_SECRET`
- `CRON_SECRET`
- `IMPERSONATION_HANDOFF_SECRET`

Place secrets in:

- DigitalOcean `web-staging` component env: web/API secrets.
- DigitalOcean `admin-staging` component env: admin, backup, alert, and shared secrets.
- EAS preview env: mobile build-time public API URL only, plus EAS secrets where required.
- Local `.env` files that are gitignored.

## Environment Matrix

| Variable | Web staging | Admin staging | Mobile preview | Production later | Secret | Exposure | Missing impact |
|---|---|---|---|---|---|---|---|
| `DATABASE_URL` | Required | Required | No | Required | Yes | Server-only | App cannot access DB; launch blocked. |
| `USER_JWT_SECRET` | Required | Required if admin impersonation/internal user session verification is used | No | Required | Yes | Server-only | User auth/session verification fails. |
| `QA_RESETTABLE_ACCOUNT_EMAIL` | Optional controlled QA only | No | No | Optional controlled QA only | No | Server-only | When set to one exact email, that QA account auto-verifies on signup and hard-resets itself on logout; leave unset for normal operation and never use comma-separated values. |
| `ADMIN_JWT_SECRET` | Required if admin handoff validates admin JWT | Required | No | Required | Yes | Server-only | Admin auth fails. |
| `FIELD_ENCRYPTION_KEY` | Required | Required | No | Required | Yes | Server-only | Production encryption/backup safety blocked. |
| `NEXT_PUBLIC_APP_URL` | Required | Required for links/impersonation return URLs | No | Required | No | Public/client-safe | OAuth/email/portal links may point to wrong host. |
| `NEXT_PUBLIC_ADMIN_URL` | Recommended for staging URL inventory | Recommended for admin staging URL inventory | No | Optional | No | Public/client-safe | Wrong or missing value can confuse operator links and future admin deep links. |
| `NODE_ENV` | Vercel sets | Vercel sets | EAS sets build env | Vercel sets | No | Server-only | Do not override unless needed. |
| `APP_ENV` | Required: `production` on active real domains | Required: `production` on active admin domain | Not used | Required | No | Server-only | Controls billing/live-mode assumptions and SEO indexing; staging/preview blocks public indexing. |
| `WEB_INTERNAL_URL` | No | Optional for admin-to-web internal calls | No | Recommended | No | Server-only | Admin impersonation may fall back to `NEXT_PUBLIC_APP_URL`. |
| `INTERNAL_WEBHOOK_SECRET` | Required | Required | No | Required | Yes | Server-only | Internal webhooks disabled/fail closed. |
| `CRON_SECRET` | Required for web cron | Required for admin backup cron | No | Required | Yes | Server-only | Scheduled jobs cannot run safely. |
| `IMPERSONATION_HANDOFF_SECRET` | Required for web handoff endpoint | Required for admin handoff issuer | No | Required | Yes | Server-only | Admin impersonation unavailable. |
| `GOOGLE_OAUTH_CLIENT_ID` | Optional staging | No | No native token handoff required for current preview | Optional | No | Public OAuth ID | Google sign-in stays disabled. |
| `GOOGLE_OAUTH_CLIENT_SECRET` | Optional staging | No | No | Optional | Yes | Server-only | Google sign-in stays disabled. |
| `APPLE_OAUTH_CLIENT_ID` | Optional staging | No | No native Apple sign-in yet | Optional, required for iOS App Store if offered | No | OAuth ID | Apple sign-in stays disabled. |
| `APPLE_OAUTH_TEAM_ID` | Optional staging | No | No | Optional | No | OAuth ID | Apple sign-in stays disabled. |
| `APPLE_OAUTH_KEY_ID` | Optional staging | No | No | Optional | No | OAuth ID | Apple sign-in stays disabled. |
| `APPLE_OAUTH_PRIVATE_KEY` | Optional staging | No | No | Optional | Yes | Server-only | Apple sign-in stays disabled. |
| `STRIPE_SECRET_KEY` | Required to test checkout/portal | Optional context checks | No | Required for web billing | Yes | Server-only | Billing checkout/portal/webhooks cannot be fully tested. |
| `STRIPE_WEBHOOK_SECRET` | Required for Stripe webhook test | No | No | Required | Yes | Server-only | Webhook events rejected. |
| `STRIPE_PRICE_INDIVIDUAL_MONTHLY` | Required for checkout test | Optional display/context | No | Required | No | Server-only/public ID | Monthly checkout cannot create Individual subscription. |
| `STRIPE_PRICE_INDIVIDUAL_YEARLY` | Required for annual checkout test | Optional | No | Required | No | Server-only/public ID | Yearly checkout unavailable. |
| `STRIPE_ANNUAL_TRIAL_DAYS` | Optional, defaults to 90 | Optional | No | Recommended | No | Plain | Annual checkout falls back to 90 days. |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Required for Stripe readiness | No | No | Required | No | Public | Client Stripe integrations unavailable. |
| `APPLE_APP_STORE_ISSUER_ID` | Required only for IAP validation tests | Admin readiness context | No | Required for live iOS IAP validation | No | Server-only ID | IAP verification unavailable/stale. |
| `APPLE_APP_STORE_KEY_ID` | Required only for IAP validation tests | Admin readiness context | No | Required for live iOS IAP validation | No | Server-only ID | IAP verification unavailable/stale. |
| `APPLE_APP_STORE_PRIVATE_KEY` | Required only for IAP validation tests | Admin readiness context | No | Required for live iOS IAP validation | Yes | Server-only | IAP verification unavailable/stale. |
| `APPLE_APP_STORE_ENVIRONMENT` | Optional, use `Sandbox` for staging | Optional | No | Required for live IAP | No | Server-only | Defaults may be wrong for store validation. |
| `MOBILE_IOS_PRODUCT_INDIVIDUAL` | Optional for product endpoint | Optional | No | Required for live IAP | No | Product ID | Product endpoint may return no iOS product. |
| `MOBILE_ANDROID_PRODUCT_INDIVIDUAL` | Optional for product endpoint | Optional | No | Required for live IAP | No | Product ID | Product endpoint may return no Android product. |
| `GOOGLE_PLAY_PACKAGE_NAME` | Required for Google Play validation tests | Admin readiness context | No | Required for live Android IAP | No | Server-only ID | Play validation unavailable. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_EMAIL` | Required for Google Play validation tests | Admin readiness context | No | Required for live Android IAP | No | Server-only ID | Play validation unavailable. |
| `GOOGLE_PLAY_SERVICE_ACCOUNT_PRIVATE_KEY` | Required for Google Play validation tests | Admin readiness context | No | Required for live Android IAP | Yes | Server-only | Play validation unavailable. |
| `GOOGLE_PLAY_RTDN_AUDIENCE` | Required for production-like Play webhook tests | Admin readiness context | No | Required for live Android RTDN | No | URL | Production webhook rejects without it. |
| `RESEND_API_KEY` | Required for email tests | Required for alert email delivery | No | Required | Yes | Server-only | Password reset/email verification cannot be fully tested. |
| `EMAIL_FROM` | Required for email tests | Required if admin sends email | No | Required | No | Server-only config | Email sends may fail or use fallback. |
| `ALERT_EMAIL_FROM` | Optional | Required for alert sender test | No | Recommended | No | Server-only config | Alert email sender may be fallback. |
| `ALERT_EMAIL_TO` | Optional | Required for alert delivery test | No | Recommended | No | Server-only config | Security/ops alert delivery cannot be validated. |
| `NEXT_PUBLIC_SENTRY_DSN` | Optional staging, required for monitoring validation | Optional staging, required for monitoring validation | Optional, public | Recommended production | No | Public DSN | Error capture cannot be validated. |
| `SENTRY_DSN` | Not used by current code | Not used by current code | Not used | Optional future | Yes | Server-only | No current impact. |
| `SENTRY_AUTH_TOKEN` | Only needed for source map upload if configured | Same | No | Optional | Yes | CI/build-only | No source map release upload. |
| `SENTRY_ORG` | Only needed for source map upload if configured | Same | No | Optional | No | CI/build-only | No source map release upload. |
| `SENTRY_PROJECT` | Only needed for source map upload if configured | Same | No | Optional | No | CI/build-only | No source map release upload. |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Optional public fallback | Optional public fallback | No | Optional if maps shown client-side | No | Public/client-safe | Address autocomplete may be unavailable. |
| `GOOGLE_MAPS_API_KEY` | Optional server-side address autocomplete | Optional admin fallback | No | Recommended | Yes | Server-only | Address autocomplete may be unavailable. |
| `PLACES_AUTOCOMPLETE_ENABLED` | Optional kill switch, default enabled | Optional visibility | No | Recommended | No | Server-only/runtime config | Set `false` to stop Google Places calls without redeploying. |
| `PLACES_AUTOCOMPLETE_DAILY_USER_LIMIT` | Optional, default `250` | No | No | Recommended | No | Server-only | Controls per-user daily prediction calls. |
| `PLACES_AUTOCOMPLETE_DAILY_IP_LIMIT` | Optional, default `1000` | No | No | Recommended | No | Server-only | Controls per-IP daily prediction calls. |
| `PLACES_DETAILS_DAILY_USER_LIMIT` | Optional, default `250` | No | No | Recommended | No | Server-only | Controls per-user daily place-details calls. |
| `PLACES_DETAILS_DAILY_IP_LIMIT` | Optional, default `1000` | No | No | Recommended | No | Server-only | Controls per-IP daily place-details calls. |
| `R2_ENDPOINT` | Optional unless upload/imgproxy flows are tested | No | No | Required for upload/logo storage | No | Server-only URL | Upload/storage unavailable. |
| `R2_REGION` | Optional | No | No | Required with R2/S3 | No | Server-only config | Upload/storage unavailable. |
| `R2_BUCKET` | Optional | No | No | Required with R2/S3 | No | Server-only config | Upload/storage unavailable. |
| `R2_ACCESS_KEY_ID` | Optional | No | No | Required with R2/S3 | No | Server-only ID | Upload/storage unavailable. |
| `R2_SECRET_ACCESS_KEY` | Optional | No | No | Required with R2/S3 | Yes | Server-only | Upload/storage unavailable. |
| `R2_PUBLIC_BASE_URL` | Optional | No | No | Optional | No | Public URL | Raw public object URLs unavailable. |
| `IMGPROXY_KEY` | Optional unless image proxy tested | No | No | Required if imgproxy enabled | Yes | Server-only | Signed image proxy unavailable. |
| `IMGPROXY_SALT` | Optional unless image proxy tested | No | No | Required if imgproxy enabled | Yes | Server-only | Signed image proxy unavailable. |
| `NEXT_PUBLIC_IMGPROXY_URL` | Optional unless image proxy tested | No | No | Required if imgproxy enabled | No | Public/client-safe | Image proxy URLs unavailable. |
| `BACKUP_STORAGE_PROVIDER` | No | Required for offsite backup drill | No | Required for DR readiness | No | Server-only config | Offsite backup not proven. |
| `BACKUP_STORAGE_BUCKET` | No | Required for offsite backup drill | No | Required for DR readiness | No | Server-only config | Offsite backup not proven. |
| `BACKUP_STORAGE_REGION` | No | Required for offsite backup drill | No | Required for DR readiness | No | Server-only config | Offsite backup not proven. |
| `BACKUP_STORAGE_ENDPOINT` | No | Required for S3-compatible non-AWS storage | No | Required if using R2/Spaces | No | Server-only URL | Offsite backup not proven. |
| `BACKUP_STORAGE_ACCESS_KEY_ID` | No | Required for offsite backup drill | No | Required for DR readiness | No | Server-only ID | Offsite backup not proven. |
| `BACKUP_STORAGE_SECRET_ACCESS_KEY` | No | Required for offsite backup drill | No | Required for DR readiness | Yes | Server-only | Offsite backup not proven. |
| `UPSTASH_REDIS_REST_URL` | Recommended staging | Recommended admin auth/rate checks | No | Required for production-grade rate limits | No | Server-only URL | Falls back to in-memory; not launch-grade. |
| `UPSTASH_REDIS_REST_TOKEN` | Recommended staging | Recommended admin auth/rate checks | No | Required for production-grade rate limits | Yes | Server-only | Falls back to in-memory; not launch-grade. |
| `ADMIN_SEED_EMAIL` | No | Required if seeding admin | No | Required for first admin seed | No | Server-only config | Admin account must be created another way. |
| `ADMIN_SEED_PASSWORD` | No | Required if seeding admin | No | Required for first admin seed | Yes | Server-only | Admin account must be created another way. |
| `EXPO_PUBLIC_API_URL` | No | No | Required for mobile preview | Required for mobile release | No | Public, inlined into app bundle | Mobile cannot reach API or may hit wrong environment. |
| `EAS_TOKEN` / `EXPO_TOKEN` | No | No | Required for CI/noninteractive EAS build | Required for CI release builds | Yes | CI/build-only | Native build cannot run non-interactively. |
| `EAS_PROJECT_ID` | No | No | Optional unless project requires explicit linking | Optional | No | Build config | EAS may prompt for project link. |

## Known Missing Values In This Workspace

Real staging/prod values are not available in the repo and must be provided by the operator:

- DigitalOcean App Platform component env values.
- DigitalOcean staging MySQL `DATABASE_URL`.
- OAuth client credentials.
- Stripe test-mode keys, Price IDs, and webhook secret.
- Resend sender and alert recipients.
- Sentry DSN and optional source-map upload credentials.
- Backup object storage credentials.
- EAS token, Android signing, and Apple credentials.

References:

- DigitalOcean App Platform staging deploy: `docs/deploy/digitalocean-app-platform-web.md`
- Vercel deployment protection: https://vercel.com/docs/security/deployment-protection
- Vercel protection bypass for automation: https://vercel.com/docs/deployment-protection/methods-to-bypass-deployment-protection/protection-bypass-automation
- Expo EAS environment variables: https://docs.expo.dev/eas/environment-variables
