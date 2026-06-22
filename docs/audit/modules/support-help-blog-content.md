# Module Audit: Support, Help, Blog, Content

Status: mapped.

## Source Inspected

- Prisma content/support models.
- sampled admin blog image route classification.

## Verified Facts

- Help article, FAQ, support ticket, ticket message, blog post/category/tag/revision/view models exist.

Evidence:

- `packages/db/prisma/schema.prisma:1593`
- `packages/db/prisma/schema.prisma:1619`
- `packages/db/prisma/schema.prisma:1747`
- `packages/db/prisma/schema.prisma:1778`
- `packages/db/prisma/schema.prisma:1859`
- `packages/db/prisma/schema.prisma:1909`
- `packages/db/prisma/schema.prisma:1926`
- `packages/db/prisma/schema.prisma:1953`
- `packages/db/prisma/schema.prisma:1972`

## Findings

No XSS/content publishing issue was verified in this pass.

## Not Verified In Code

- HTML sanitization for rich text.
- Draft/publish permissions.
- Blog image proxy auth boundary in every deployment context.
- Support ticket PII minimization and retention.

## Next Steps

- Deep dive content editor, image upload/proxy, and public rendering paths.
