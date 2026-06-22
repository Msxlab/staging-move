# Module Audit: Web Public And Marketing Pages

Status: mapped.

## Source Inspected

- Route inventory under `apps/web/src/app`.
- Web global theme file `apps/web/src/styles/globals.css`.
- Web middleware `apps/web/src/middleware.ts`.

## Verified Facts

- Web app has 74 page files.
- Web middleware sets CSP and HSTS.
- Web global CSS includes theme variables and tracking variables.

Evidence:

- `apps/web/src/middleware.ts:752`
- `apps/web/src/middleware.ts:768`
- `apps/web/src/styles/globals.css:201-202`

## Findings

No source-backed critical/high finding verified for public pages in this pass.

## Not Verified In Code

- Actual rendered homepage/public page UI.
- Conversion funnel claims, SEO behavior, analytics accuracy, or performance.
- Accessibility and responsive behavior.

## Next Steps

- Run browser visual QA for top public routes.
- Check metadata, canonical URLs, noindex behavior, and structured data.
