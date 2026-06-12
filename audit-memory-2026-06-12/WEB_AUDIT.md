# Web Audit

Status: source-reviewed and verified.

## Verification

- `pnpm --filter @locateflow/web exec tsc --noEmit`: passed after regenerating Prisma Client.
- `pnpm --filter @locateflow/web test`: 263 files / 2343 tests passed.
- `pnpm --filter @locateflow/web exec vitest run src/middleware.test.ts`: 33 tests passed after the mover middleware fix.

## Findings

1. Prisma Client can be stale after pulling GitHub.
   - Symptom before `pnpm --filter @locateflow/db generate`: TypeScript could not see `moverApplication`, `moverDocument`, `moverPortalToken`.
   - Impact: local/CI typecheck fails until Prisma Client is regenerated.
   - Recommendation: keep `postinstall` and ensure CI runs `pnpm --filter @locateflow/db generate` before typecheck.

2. Provider precision is the main product-risk area, not route breakage.
   - Recommendation route is scoped and tested, but data quality depends on coverage rows and optional external lookups.
   - See provider audit for FCC/OpenEI details.

3. Public-looking API routes mostly have expected auth variants.
   - Internal routes use `verifyInternalAuth`.
   - Webhooks verify signed payloads or provider signatures.
   - Workspace routes use session helpers even when static pattern search misses them.

4. Fixed: mover self-service public routes were blocked by global middleware.
   - Added public allowlist entries for `/movers/apply`, `/movers/portal`, `/api/movers/apply`, and `/api/movers/portal/*`.
   - Added a mover-specific multipart body limit so the route's 8 x 10MB document contract can actually pass middleware.
   - Regression tests now cover public pages, public portal APIs, and the special upload limit.

5. Open: mover proof-document storage needs hardening.
   - Uploads currently trust declared MIME type; admin review returns raw public R2 URLs.
   - See `SECURITY_AUDIT.md` LF-SEC-02.

## What Looks Good

- Web middleware has CSRF, body-size limits, security headers/CSP nonce, JWT pre-checks, route allowlists, and rate limiting.
- Stripe webhook has idempotency reservation/release, signature failure alerts, duplicate subscription handling, out-of-order event protection, and admin-manual-grant guards.
- App Store webhook verifies JWS, checks bundle, reserves events before side effects, and handles terminal skip cases.
- Dossier API gates entitlements and degrades each external data section independently.
