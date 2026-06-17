# CTA AsChild Link Conversion Handoff

## Task

Owner-approved Batch B CTA accessibility finish: convert remaining invalid `<Link><Button>` nesting to `<Button asChild><Link>...</Link></Button>` across `apps/web`, excluding files already completed on `claude/ux-polish`.

## Branch

- `codex/cta-aschild-links`
- Base: `move-main/main` at `e2b5b94d`

## Changed Files

- `apps/web/src/app/(app)/addresses/new/page.tsx`
- `apps/web/src/app/(app)/budget/[month]/page.tsx`
- `apps/web/src/app/(app)/moving/new/page.tsx`
- `apps/web/src/app/(app)/not-found.tsx`
- `apps/web/src/app/(app)/services/[id]/page.tsx`
- `apps/web/src/app/about/page.tsx`
- `apps/web/src/app/blog/[slug]/page.tsx`
- `apps/web/src/app/contact/page.tsx`
- `apps/web/src/app/faq/page.tsx`
- `apps/web/src/app/how-it-works/page.tsx`
- `apps/web/src/app/moving/[state]/[city]/page.tsx`
- `apps/web/src/app/moving/[state]/page.tsx`
- `apps/web/src/app/not-found.tsx`
- `docs/ai/handoffs/2026-06-17-181628-cta-aschild-links.md`

## What Changed

- Converted 30 remaining CTA instances from `<Link><Button>` to `<Button asChild><Link>`.
- Preserved Button `variant`, `size`, `type`, and `className` props on the Button.
- Kept text and icons inside the Link child.
- Moved the `key` prop from Link to Button for the mapped policy-link CTA in `contact/page.tsx`.
- Did not touch the already-completed files named in the request.

## Verification

- Nested CTA scan: `rg -nUP --glob '*.tsx' '<Link\s(?:(?!</Link>)[\s\S])*<Button\b' apps/web/src` returned no matches.
- `pnpm verify:typecheck` passed.
- `pnpm --filter @locateflow/web exec playwright test tests/e2e/public-pages.spec.ts tests/e2e/accessibility.spec.ts --project=chromium --workers=1` passed: 17 tests.
- `pnpm --filter @locateflow/web test` ran 2,567 tests with 2,566 passing and 1 unrelated failure in `src/lib/subscription-copy-regression.test.ts`. The failure is pre-existing on current main: `pricing-section.tsx` now uses `role="group"` from PR #287 while the test still expects `role="tablist"`. This branch did not touch either file.

## Edge Cases

- No skipped runtime CTA instances.
- The only broad grep false positive before the stricter scan was a comment in `components/premium/foil-empty-state.tsx` mentioning `<Link>` and `<Button>` as documentation text; no code nesting remained.

## Guardrails

- No deploy.
- No secrets or production data access.
- No changes to the excluded `claude/ux-polish` files.
