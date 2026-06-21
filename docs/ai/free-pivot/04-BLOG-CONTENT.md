# 04 · Blog & Content

The blog is **DB-backed** (Prisma `BlogPost`), not MDX files. Good news: it is almost entirely pivot-safe.

## Status: mostly preserve

| Area | File | Status |
|---|---|---|
| 20 evergreen seed posts | [packages/db/prisma/seed-blog.ts:50](packages/db/prisma/seed-blog.ts) | **PRESERVE** — soft brand mentions only; no pricing/plan/trial/upgrade language anywhere |
| Blog list page | [blog/page.tsx:43](apps/web/src/app/blog/page.tsx) | PRESERVE — topical copy, no pricing |
| Category page | [blog/category/[slug]/page.tsx:67](apps/web/src/app/blog/category/[slug]/page.tsx) | PRESERVE |
| RSS / Atom feeds | [blog/feed.xml/route.ts:51](apps/web/src/app/blog/feed.xml/route.ts) | PRESERVE |
| Blog-publish cron | [api/cron/blog-publish/route.ts:35](apps/web/src/app/api/cron/blog-publish/route.ts) | PRESERVE — mechanical; revalidates `/llms.txt` (see below) |
| Mobile blog screens | [apps/mobile/app/blog/[slug].tsx](apps/mobile/app/blog/[slug].tsx) | PRESERVE — already free, unauthenticated |

## The one real edit

| Area | File | Line | Current | Change |
|---|---|---|---|---|
| Per-article CTA supporting copy | [blog/[slug]/page.tsx](apps/web/src/app/blog/[slug]/page.tsx) | 273 | "Create an account in a minute. Trial length, renewal date, price, and any payment requirement are shown before checkout." | "Create a free account in a minute — every feature is included, no payment required." Keep structure + `/sign-up` link |
| CTA button label | blog/[slug]/page.tsx | 278 | "Start free access" → `/sign-up` | **PRESERVE** — already correct; flagged so it isn't reverted |

## Cross-surface flag — llms.txt discovery notes
`/llms.txt` (AI answer-engine discovery, revalidated by blog cron) is built from [public-ai-discovery.ts](apps/web/src/lib/public-ai-discovery.ts):
- Line 10 — Pricing note: "Plans, trial details, billing, and refund context." → soften to "Free access today; Concierge and Business coming soon." (also covered in [05-SEO-GEO](05-SEO-GEO.md))
- Line 21 — Billing-policy / FAQ notes: lower priority; keep factual, re-verify after pricing/legal copy finalizes.
- Bump `LLMS_LAST_UPDATED`.

## Manual steps
- **Live DB content sweep** (not in repo): if production already has the 20 seed posts live/edited, future editorial wording changes go through the **admin blog editor** (seed skips edited posts). Current copy needs no change.
- After CTA + llms.txt edits ship, **re-fetch `/llms.txt`** in production to confirm it no longer advertises "trial details" (cached ≤1h / cron-revalidated).
- No store/console/DNS steps apply to blog.
