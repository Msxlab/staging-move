# DigitalOcean App Platform Web Deploy

Current staging target:

`https://locateflow-staging-owew7.ondigitalocean.app`

Use this runbook for the current DigitalOcean App Platform staging deployment. The older Vercel runbook is historical unless staging is intentionally moved back to Vercel.

## Build Command

```bash
pnpm db:generate && pnpm --filter @locateflow/web build && pnpm web:prepare-standalone
```

The standalone preparation step copies:

- `apps/web/.next/static` to `apps/web/.next/standalone/apps/web/.next/static`
- `apps/web/public` to `apps/web/.next/standalone/apps/web/public`

Without those copies, the standalone server can boot while CSS, chunks, icons, and public assets 404.

## Run Command

```bash
node apps/web/.next/standalone/apps/web/server.js
```

For staging only, it is acceptable to prefix the run command with `pnpm db:migrate:deploy &&` while App Platform is being stabilized. Production should use a deploy-time migration job instead of running migrations on every web container start.

## Verification

After build, confirm:

```bash
test -f apps/web/.next/standalone/apps/web/server.js
test -d apps/web/.next/standalone/apps/web/.next/static
test -d apps/web/.next/standalone/apps/web/public
```

After deploy, smoke test:

- `/`
- `/sign-in`
- `/onboarding`
- `/dashboard`
- `/api/auth/me`
- `/favicon.ico`
- one `_next/static/...` CSS or JS URL from browser dev tools
