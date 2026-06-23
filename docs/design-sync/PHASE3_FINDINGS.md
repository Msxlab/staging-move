# Phase 3 — Marketing Re-skin · Findings

> Rollout step 3 of 5 (D34). Verified on `feat/design-foundation`.
> **Headline:** the *pure re-skin* (theme + brand + typography) for the marketing site is **largely already done** — Phase 1's single-source token work + the pre-existing raccoon logo + Playfair display cover it. What remains is NOT re-skin work: it's the **truly-free pivot** (a separate, decision-heavy phase) and a few **redesign / marginal** items.

## What the decisions + Phase 1 already resolved
- **marketing-01/-10/-13 (rename to "Move") → MOOT.** D1 keeps the name **LocateFlow**. The design's "Move" wordmark stays "LocateFlow"; the marketing `Wordmark` already renders "LocateFlow" in Playfair-900. No rename.
- **marketing-02 (raccoon as the mark) → effectively SATISFIED.** `apps/web/public/logo-mark.svg` is **already a raccoon** (head `#8C9AB2` / mask `#0C1525` / ears `#C4A090` / **gold eye `#CBA45E`**), used by the marketing header, footer, sidebar, and all auth pages via `components/marketing/logo.tsx`. It is a *static* raccoon, not the new parametric `brand/RaccoonMark` component.
- **marketing-03/-18 (dark-only vs sapphire light) → RESOLVED.** D5 keeps light mode (Gold dark / Sapphire light). Tokens already emit this (Phase 1). No dark-only.
- **Typography / palette / radius** → applied site-wide via the Phase 1 token emitter (the marketing pages are token-driven). ✅

## What's left — and why it's NOT a blind re-skin
- **Truly-free pivot (separate phase, D3):** marketing-04/-05/-15/-09 — drop/disable the Pricing page + Concierge/Business tiers, swap to the "Always free — everything's included" band, rewrite Why-Free to the "100% free" voice, prune the extra home funnel sections. These are **product-positioning + copy + billing-surface** changes that belong to the `CONSUMER_FREE` truly-free phase, gated on its readiness traps — not a theme re-skin.
- **Redesign, not re-skin (keep richer content):** marketing-08/-11/-12 (Features = 9 grouped lucide cards vs design's 8 emoji cards), marketing-14/-16 (nav/how-it-works/pricing pages). Per the "restyle, keep the engine/content" decisions (cf. D30/D32), the code's richer Features/How-it-works content is retained, already re-themed by tokens. Converting to the design's leaner emoji layout would be a content redesign, not a re-skin.
- **Marginal / optional polish:**
  - **Light-mode logo eye:** the static `logo-mark.svg` eye is fixed gold; in light mode the D5 accent is Sapphire. Swapping `marketing/logo.tsx` to delegate to the parametric `brand/RaccoonMark` (accent-tracking eye + moods) would fix this — **but it changes the logo across ~10 surfaces** (header/footer/sidebar/6 auth pages), including the tile color in light mode (fixed-dark → theme `bg-card`). **Deferred: do this AFTER a human previews the brand RaccoonMark** — high blast-radius, visual-only, not worth a blind site-wide swap for a light-mode eye tint.
  - marketing-19 (extra "Web, iOS and Android" hero trust chip) — factually true + intentionally added; leaving as-is.
  - marketing-06/-17 (rough/dream demo toggle + reactive dossier band) — `HeroPhoneShowcase`/`DossierShowcase` exist; fidelity verification only, low severity.

## Recommendation
Phase 3 (pure re-skin) needs **no large blind effort** — the foundation already delivered it. The real remaining marketing substance is the **truly-free pivot** (decision-heavy, billing-adjacent, its own phase) and an optional **preview-gated logo-component upgrade**. Suggest: proceed to **Phase 4 (web app shell re-skin)** or the **truly-free phase**, and fold the logo-component upgrade + marketing copy changes into those once the brand foundation is previewed.

_Authored 2026-06-22 — Phase 3 verified largely complete via the Phase 1 foundation; remaining items reclassified (truly-free / redesign / preview-gated)._
