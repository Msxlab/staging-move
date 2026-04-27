# Web Nonce CSP Hardening Follow-Up

Status: deferred from the broad remediation pass.

Why deferred:
- `apps/web/next.config.js` currently documents that App Router bootstrap/RSC scripts still require `script-src 'unsafe-inline'`.
- The admin app has a nonce middleware pattern, but applying it to web safely requires route-level QA across public pages, authenticated layouts, Stripe checkout redirects, OAuth callbacks, next-intl, Sentry, and service-worker shutoff headers.
- A partial CSP change can make production pages render blank or break hydration, which is higher risk than leaving the known policy in place for this pass.

Focused implementation plan:
1. Port the admin nonce middleware pattern into `apps/web/src/middleware.ts`, preserving existing auth, rate-limit, CSRF, locale, staging noindex, `/sw.js`, and `/register-sw.js` behavior.
2. Remove the static `Content-Security-Policy` from `apps/web/next.config.js` only after the middleware emits a nonce CSP on every HTML/API response that needs one.
3. Keep production `script-src` as `'self' 'nonce-{nonce}' 'strict-dynamic'` with no `'unsafe-inline'`; keep dev `'unsafe-eval'`.
4. Verify Next.js generated scripts receive the nonce via `x-nonce`.
5. Run `pnpm --filter @locateflow/web build`.
6. Use Playwright to manually QA: homepage, sign-in, sign-up, OAuth callback error page, dashboard, onboarding, address autocomplete, Stripe checkout start, settings, export, logout, and service-worker disabled behavior.
7. Roll out behind staging first and watch CSP violation reports before production.
