# LocateFlow SEO, Google, Analytics, and AI Discovery Setup

Last updated: 2026-05-01

This checklist covers manual setup steps that cannot be completed from the
repository without production Google account access.

## Environment Variables

- `DATABASE_URL`: required in production so blog pages, blog sitemap entries, and `llms.txt` can resolve published content.
- `NEXT_PUBLIC_SITE_URL`: canonical public origin, for example `https://locateflow.app`.
- `SITE_URL`: server-side canonical public origin fallback.
- `NEXT_PUBLIC_APP_URL`: existing app URL used by auth, billing, email, and legacy links.
- `APP_ENV`: `production`, `staging`, `preview`, or `development`. Only `production` should be indexable.
- `GOOGLE_SITE_VERIFICATION`: Google Search Console meta verification token.
- `NEXT_PUBLIC_GTM_ID`: Google Tag Manager container ID. Preferred for production.
- `NEXT_PUBLIC_GA_MEASUREMENT_ID`: GA4 Measurement ID. Used only when GTM is not configured.
- `SITE_LAST_MODIFIED`: static sitemap lastModified fallback for non-blog pages.

Production canonical URLs must be HTTPS public origins. Do not set
`NEXT_PUBLIC_SITE_URL` or `SITE_URL` to localhost, internal hosts, staging,
preview, or Vercel preview URLs. The code falls back to `https://locateflow.app`
for unsafe production canonical values, but deployment config should still be
fixed before indexing.

## Google Search Console

1. Create a Domain property for the canonical domain, or a URL-prefix property for the exact production origin.
2. Verify ownership with DNS TXT when possible. Use `GOOGLE_SITE_VERIFICATION` only for URL-prefix verification.
3. Deploy production with the canonical URL env vars set.
4. Confirm `https://<host>/robots.txt` references `https://<host>/sitemap.xml`.
5. Submit `https://<host>/sitemap.xml`.
6. Use URL Inspection for `/`, `/pricing`, `/faq`, `/blog`, one published `/blog/<slug>`, `/robots.txt`, `/sitemap.xml`, and `/llms.txt`.
7. Check Page Indexing, Enhancements, Manual Actions, and Security Issues.
8. Link the Search Console property to GA4 after GA4 is created.

## GA4 and GTM

1. Create a GA4 web stream for the canonical production origin.
2. Prefer GTM: create a web container and set `NEXT_PUBLIC_GTM_ID`.
3. If GTM is not used, set `NEXT_PUBLIC_GA_MEASUREMENT_ID`.
4. Do not configure tags to fire before consent. The app loads GTM/gtag only after the cookie banner is accepted.
5. In GTM, map dataLayer events to GA4 events. Avoid user identifiers and PII.
6. Verify in Tag Assistant, GA4 Realtime, and GA4 DebugView.

## AI Crawler Policy

- `OAI-SearchBot`, `ChatGPT-User`, `PerplexityBot`, and `ClaudeBot` may crawl public pages.
- `GPTBot`, `Google-Extended`, `CCBot`, and `Bytespider` are disallowed by explicit robots rules.
- Authenticated app pages, the current signed-in Help Center (`/help`), admin routes, token routes, previews, and APIs are not listed in `llms.txt`.
- `llms.txt` is a curated discovery file, not a security boundary.

## Public Help Center Follow-Up

`/help` currently lives under the authenticated app layout and remains noindex/private.
If LocateFlow needs public help SEO, build a separate SSR route outside `(app)`
with published public articles only, route metadata, sitemap inclusion for those
articles, and schema that matches visible content.

## Rich Results Validation

Validate representative pages with Google's Rich Results Test:

- `/`
- `/pricing`
- `/faq`
- `/blog`
- one published `/blog/<slug>`

Expected schema surfaces:

- Organization and WebSite sitewide.
- SoftwareApplication on home and pricing pages.
- FAQPage on `/faq`.
- Article and BreadcrumbList on published blog posts.
