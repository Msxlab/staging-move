# Module Audit: Providers, Recommendations, Affiliate

Status: mapped.

## Source Inspected

- Prisma provider/affiliate/recommendation models.
- sampled affiliate postback route.
- root provider audit scripts.

## Verified Facts

- Provider, saved provider, recommendation feedback, affiliate click/conversion, provider coverage, moving company, sponsored placement, lead, and partner models exist.
- Root provider audit scripts exist in `package.json:13-19`.

Evidence:

- `packages/db/prisma/schema.prisma:733`
- `packages/db/prisma/schema.prisma:806`
- `packages/db/prisma/schema.prisma:848`
- `packages/db/prisma/schema.prisma:864`
- `packages/db/prisma/schema.prisma:884`
- `packages/db/prisma/schema.prisma:1105`
- `packages/db/prisma/schema.prisma:2324`
- `packages/db/prisma/schema.prisma:2355`
- `packages/db/prisma/schema.prisma:2385`
- `packages/db/prisma/schema.prisma:2469`

## Findings

No recommendation correctness or affiliate disclosure bug was verified in this pass.

## Not Verified In Code

- Ranking algorithm fairness/completeness.
- Sponsored placement disclosure in UI.
- Affiliate attribution edge cases.
- Provider coverage freshness and audit script output.

## Next Steps

- Run provider audit scripts only after confirming expected duration.
- Review provider recommendation routes and UI disclosures.
