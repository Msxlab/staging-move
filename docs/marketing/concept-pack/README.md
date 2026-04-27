# LocateFlow concept pack — "The New Generation"

A bilingual (EN/ES) pitch + design pack used to motivate the landing
recognition arc, the hero phone mock, and the marketing copy in
`apps/web/src/app/page.tsx`. **Reference material only — not deployed.**

## What's in here

| Path | What it is |
| --- | --- |
| `index.html` | Hub page that links the four artifacts together. Open this first. |
| `landing/index.html` | Single-page marketing site mock. Source for the chip storm, hard stats, moving-moment, bilingual showcase, and testimonial sections that landed in production via the marketing-landing-recognition-arc PR. |
| `video/` | 90-second animated product film (5 scenes, JSX, browser-rendered). Concept-only — the production app does not run this. |
| `prototype/` | Tarayıcıda iPhone-frame interactive walkthrough (React + Babel-in-browser). Design reference for the mobile app screens; not React Native. |
| `deck/` | 10-slide investor deck (HTML stage + PPTX export). |
| `assets/` | Logo SVGs and a `tokens.css` palette dump. Production tokens already cover everything here (`apps/web/src/styles/globals.css`, `apps/mobile/src/lib/theme.ts`). |
| `screenshots/` | Stills from the video scenes. |

## Why it's in `docs/marketing/`

This pack is investor- and design-facing material. Keeping it here:

- preserves it next to the code it influenced,
- avoids leaking it to `apps/web/public/` where it would deploy,
- and lets future marketing pulls open it locally without git-diving.

If you need to ship a private investor link, copy the artifact you want
into `apps/web/public/concept/<artifact>/` and disallow it in
`robots.txt` — do **not** symlink from here.

## What we already ported

The landing page recognition arc came directly from `landing/index.html`:

- chip storm → `apps/web/src/components/marketing/recognition-chip-storm.tsx`
- hard stats → `apps/web/src/components/marketing/hard-stats.tsx`
- moving moment → `apps/web/src/components/marketing/moving-moment-mock.tsx`
- bilingual showcase → `apps/web/src/components/marketing/bilingual-showcase.tsx`
- testimonial → `apps/web/src/components/marketing/testimonial-quote.tsx`
- hero phone mock → `apps/web/src/components/marketing/hero-phone-mock.tsx`

Brand identity (logo, type, tokens) was already on parity in production
before this pack, so the assets here are reference, not source-of-truth.
