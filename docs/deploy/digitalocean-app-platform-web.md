# DigitalOcean App Platform Active Domain Deploy

Current active domains:

- Web/user app: `https://locateflow.com`
- www app alias: `https://www.locateflow.com`
- Admin app: `https://admin.locateflow.com`

The temporary `https://locateflow-staging-owew7.ondigitalocean.app` URL is a legacy starter URL only. Do not use it for active OAuth, billing, email, mobile, or QA configuration after the real domains are routed.

The old `https://locateflow-staging-owew7.ondigitalocean.app/move-main/login` admin path is deprecated and temporary. Admin must run at root `/` on `admin.locateflow.com` so its `/_next/static/...` assets are served by the admin component instead of colliding with the web component.

## Web Component

DigitalOcean component name: `web-staging`

## Web Dockerfile Option

Use this option when DigitalOcean buildpacks fail before app build while
installing pnpm.

DigitalOcean App Platform settings:

- Build method: Dockerfile
- Dockerfile path: `Dockerfile`
- Source directory: repository root
- HTTP port: `8080`
- Build command: empty
- Run command: empty, unless DigitalOcean requires an explicit command; then use `sh -c 'export DATABASE_URL="${DATABASE_URL:-$MYSQL_DATABASE_URL}"; exec node apps/web/server.js'`
- Runtime env: keep the existing web env values. `DATABASE_URL` should be set to the managed MySQL connection string; the image also falls back to `MYSQL_DATABASE_URL` when `DATABASE_URL` is absent.

Docker build args, if overriding the defaults:

```bash
NEXT_PUBLIC_APP_URL=https://locateflow.com
NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com
NEXT_PUBLIC_SITE_URL=https://locateflow.com
SITE_URL=https://locateflow.com
APP_ENV=production
NEXT_PUBLIC_IMGPROXY_URL=https://img.locateflow.com
R2_BUCKET=locateflow
```

The Dockerfile builds with Node 22 and pnpm 9.15.0, installs dependencies with
`pnpm install --frozen-lockfile --ignore-scripts`, then runs:

```bash
pnpm --filter @locateflow/db generate
pnpm --filter @locateflow/web build
```

It copies the Next standalone server, `apps/web/.next/static`, and
`apps/web/public` into the runtime image. The runtime command does not run
migrations.

## Web Buildpack Option

Build command:

```bash
DATABASE_URL="$MYSQL_DATABASE_URL" pnpm db:generate && DATABASE_URL="$MYSQL_DATABASE_URL" pnpm --filter @locateflow/web build && pnpm web:prepare-standalone
```

Run command:

```bash
DATABASE_URL="$MYSQL_DATABASE_URL" pnpm db:migrate:deploy && DATABASE_URL="$MYSQL_DATABASE_URL" HOSTNAME=0.0.0.0 PORT=$PORT node apps/web/.next/standalone/apps/web/server.js
```

Required public URL env:

```bash
NEXT_PUBLIC_APP_URL=https://locateflow.com
NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com
NEXT_PUBLIC_SITE_URL=https://locateflow.com
SITE_URL=https://locateflow.com
APP_ENV=production
```

`APP_ENV=production` is indexing-critical. The DigitalOcean component names
currently contain `staging`, but the active `locateflow.com` and
`www.locateflow.com` routes must run with production SEO env values. If
`APP_ENV=staging` or `APP_ENV=preview` is left on the live domain, the web app
intentionally emits `X-Robots-Tag: noindex, nofollow, noarchive`, an empty
sitemap, and `robots.txt` with `Disallow: /`.

### Production indexing deploy steps

In DigitalOcean App Platform:

1. Open the LocateFlow app.
2. Open the `web-staging` component that serves `locateflow.com` and `www.locateflow.com`.
3. Confirm these web component environment variables are present in the component scope, not only in local `.env` files:

```bash
APP_ENV=production
NEXT_PUBLIC_SITE_URL=https://locateflow.com
SITE_URL=https://locateflow.com
NEXT_PUBLIC_APP_URL=https://locateflow.com
```

4. If using the Dockerfile build method, also set the matching build args when overriding defaults:

```bash
APP_ENV=production
NEXT_PUBLIC_SITE_URL=https://locateflow.com
SITE_URL=https://locateflow.com
NEXT_PUBLIC_APP_URL=https://locateflow.com
```

5. Open **Deployments** and choose **Force rebuild and deploy**.

A restart alone is not enough after changing these values. `NEXT_PUBLIC_*`
variables are read during `next build` and may be embedded into generated
metadata, route handlers, static assets, and the standalone server output.
The sitemap, robots policy, canonical URLs, Open Graph tags, and `llms.txt`
must be rebuilt with the production values. Restarting an old build can keep
the stale staging/noindex behavior even if runtime env now looks correct.

Keep staging or preview values only on separate staging/preview components or
domains. Do not set `APP_ENV=staging`, `APP_ENV=preview`,
`NEXT_PUBLIC_SITE_URL` with `ondigitalocean.app`, or a Vercel preview URL on
the live `locateflow.com` component.

The standalone preparation step copies:

- `apps/web/.next/static` to `apps/web/.next/standalone/apps/web/.next/static`
- `apps/web/public` to `apps/web/.next/standalone/apps/web/public`

## Admin Component

DigitalOcean component name: `admin-staging`

Build command:

```bash
DATABASE_URL="${MYSQL_DATABASE_URL:-$DATABASE_URL}" pnpm db:generate && DATABASE_URL="${MYSQL_DATABASE_URL:-$DATABASE_URL}" pnpm --filter @locateflow/admin build && pnpm admin:prepare-standalone
```

Run command:

```bash
DATABASE_URL="${MYSQL_DATABASE_URL:-$DATABASE_URL}" HOSTNAME=0.0.0.0 PORT=$PORT node apps/admin/.next/standalone/apps/admin/server.js
```

Required public URL env:

```bash
NEXT_PUBLIC_APP_URL=https://locateflow.com
NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com
NEXT_PUBLIC_SITE_URL=https://locateflow.com
SITE_URL=https://locateflow.com
APP_ENV=production
```

The standalone preparation step copies:

- `apps/admin/.next/static` to `apps/admin/.next/standalone/apps/admin/.next/static`
- `apps/admin/public` to `apps/admin/.next/standalone/apps/admin/public` if it exists

## Routing Rules

Component routing rule:

- Domain: `locateflow.com`
- Path: `/`
- Preserve full path
- Target: `web-staging`

Component routing rule:

- Domain: `www.locateflow.com`
- Path: `/`
- Preserve full path
- Target: `web-staging`

Component routing rule:

- Domain: `admin.locateflow.com`
- Path: `/`
- Preserve full path
- Target: `admin-staging`

Do not route admin under `/move-main`; that path setup causes root `/_next/static` asset conflicts with the web component.

## DNS

At the DNS provider:

- Add `CNAME @` -> `locateflow-staging-owew7.ondigitalocean.app`.
- Add `CNAME www` -> `locateflow-staging-owew7.ondigitalocean.app`.
- Add `CNAME admin` -> `locateflow-staging-owew7.ondigitalocean.app`.

If using Cloudflare, start all three records as DNS only until DigitalOcean SSL provisioning and component routing are verified. Enable proxying only after browser smoke tests confirm the right component serves `/_next/static/...` assets with JavaScript/CSS MIME types.

## OAuth, Billing, IAP, Email URLs

Use these active URLs in upstream dashboards and env values:

```bash
NEXT_PUBLIC_APP_URL=https://locateflow.com
NEXT_PUBLIC_ADMIN_URL=https://admin.locateflow.com
EXPO_PUBLIC_API_URL=https://locateflow.com/api
GOOGLE_PLAY_RTDN_AUDIENCE=https://locateflow.com/api/webhooks/playstore
NEXT_PUBLIC_SITE_URL=https://locateflow.com
SITE_URL=https://locateflow.com
APP_ENV=production
```

- Google Authorized JavaScript origin: `https://locateflow.com`
- Google redirect URI: `https://locateflow.com/api/auth/oauth/google/callback`
- Apple return URL: `https://locateflow.com/api/auth/oauth/apple/callback`
- Stripe webhook endpoint: `https://locateflow.com/api/webhooks/stripe`
- Google Play RTDN audience: `https://locateflow.com/api/webhooks/playstore`
- Email and app links: `https://locateflow.com`

## Verification

After web build, confirm:

```bash
test -f apps/web/.next/standalone/apps/web/server.js
test -d apps/web/.next/standalone/apps/web/.next/static
test -d apps/web/.next/standalone/apps/web/public
```

After admin build, confirm:

```bash
test -f apps/admin/.next/standalone/apps/admin/server.js
test -d apps/admin/.next/standalone/apps/admin/.next/static
test -d apps/admin/.next/standalone/apps/admin/public
```

After deploy, smoke test:

- `https://locateflow.com/`
- `https://www.locateflow.com/`
- `https://locateflow.com/sign-in`
- `https://locateflow.com/onboarding`
- `https://locateflow.com/dashboard`
- `https://locateflow.com/api/auth/me`
- `https://admin.locateflow.com/login`
- `https://admin.locateflow.com/api/health`
- one `/_next/static/...` CSS or JS URL from each domain in browser dev tools
- `https://locateflow.com/robots.txt` allows public routes and references `https://locateflow.com/sitemap.xml`
- `https://locateflow.com/sitemap.xml` contains the public marketing/legal URLs
- `curl -I https://locateflow.com/` does not return `X-Robots-Tag: noindex`
- `https://locateflow.com/llms.txt` starts with `# LocateFlow`, not `# Not indexed`

Exact SEO verification commands:

```bash
curl -I https://locateflow.com/
curl https://locateflow.com/robots.txt
curl https://locateflow.com/sitemap.xml
curl https://locateflow.com/llms.txt

curl -A "Googlebot" -I https://locateflow.com/
curl -A "Bingbot" -I https://locateflow.com/
curl -A "OAI-SearchBot" -I https://locateflow.com/
curl -A "ChatGPT-User" -I https://locateflow.com/
curl -A "PerplexityBot" -I https://locateflow.com/
curl -A "ClaudeBot" -I https://locateflow.com/
curl -A "GPTBot" https://locateflow.com/robots.txt
```

Expected results:

- Public pages do not return `X-Robots-Tag: noindex`, `nofollow`, or `noarchive`.
- `robots.txt` does not contain a global `Disallow: /` for `User-agent: *`.
- `robots.txt` includes `Sitemap: https://locateflow.com/sitemap.xml`.
- `sitemap.xml` includes `https://locateflow.com`, `/pricing`, `/faq`, `/blog`, `/privacy`, `/terms`, and trust/legal pages.
- `llms.txt` contains the public page map and excludes admin, auth, account, app, and API routes.
- Raw homepage and pricing HTML include title, description, canonical, Open Graph, Twitter card, one visible `h1`, and primary content.

## First Admin Bootstrap

`packages/db/prisma/seed-admin.ts` uses:

- `ADMIN_SEED_EMAIL`
- `ADMIN_SEED_PASSWORD`
- `DATABASE_URL`

`ADMIN_SEED_PASSWORD` must be at least 16 characters and include uppercase, lowercase, digit, and special character.

One-time DigitalOcean Console command:

```bash
DATABASE_URL="$MYSQL_DATABASE_URL" ADMIN_SEED_EMAIL="$ADMIN_SEED_EMAIL" ADMIN_SEED_PASSWORD="$ADMIN_SEED_PASSWORD" pnpm --filter @locateflow/db seed:admin
```

Do not run this seed until the operator has supplied the env values and approved the bootstrap.
