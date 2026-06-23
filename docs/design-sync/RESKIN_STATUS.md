# UI/UX Re-skin — Status (Phases 1–5)

> Branch `feat/design-foundation` (NOT pushed/merged). The **visual re-skin** — tokens, brand mark, typography — is **COMPLETE** across web, admin, marketing, and mobile. New features (Increment C) and the truly-free pivot are explicitly OUT of the re-skin scope and tracked separately.

## ✅ Done — the re-skin

### Foundation (Phase 1)
- Single-source design-token emitter (`packages/shared` → web + admin + mobile); navy/greige palette, radius scale, Playfair/DM type. One source of truth, drift-tested.
- `brand/RaccoonMark` (parametric, accent-tracking eye: Gold dark / Sapphire light) + `brand/Wordmark` ("LocateFlow" Playfair-900) + OG card.

### Mobile (Phase 2)
- Increment A token cleanup (category colors, onAccent, fonts, pre-splash) + Increment B fidelity (already faithful) + **Phase 2B**: splash wordmark/tagline, AI-Briefing thinking-raccoon + typing dots + "Updated now", risk-gauge "RISK LEVEL · {band}". Mobile suite 326/326.

### Marketing (Phase 3)
- Re-skin delivered by the Phase 1 tokens (colors/Playfair/radius are CSS-var-driven across all ~30 public pages) + the pre-existing raccoon logo. Rename MOOT (LocateFlow, D1); light mode kept (D5). See `PHASE3_FINDINGS.md`.

### Brand mark rollout (Phases 3–5, D4)
- **Web:** `marketing/logo.tsx` `LogoMark` now renders the parametric `brand/RaccoonMark` (was the static `/logo-mark.svg`), so the eye tracks the theme accent and the mark is single-source. Propagates to header, footer, sidebar, 6 auth pages, blog, launcher (~15 importers). Web build green.
- **Admin:** local `components/brand/RaccoonMark` copy + sidebar `RailMark` swapped to it (rail + contextual panel); admin tokens already navy/gold (D7, graphite dropped). Admin build green.
- Safari `mask-icon` keeps the static single-color SVG (platform requirement).

## ❌ Explicitly OUT of the re-skin (tracked elsewhere)
- **New features — Increment C / D14·D16·D17·D20·D21·D22:** raccoon-truck travel marker, animated route map, full dossier 7-metric swipe matrix, completable reminders, share-this-move, onboarding Done step, admin per-move risk column.
- **Truly-free pivot (D3):** drop/disable Pricing + Concierge/Business, "Always free" band, "100% free" Why-Free copy, home funnel pruning — billing-adjacent, gated on `CONSUMER_FREE` readiness traps. (`FREE_PIVOT_READINESS.md`.)
- **Redesigns (keep richer content):** Features 9-grouped-lucide vs design's 8-emoji; standalone how-it-works/pricing pages. Re-themed by tokens; content intentionally retained.
- **Architecture follow-up:** consolidate the 3 raccoon components (web `brand`, admin `brand`, mobile `move/MoveRaccoon`) into the shared package (roadmap 5.6).

## ⚠️ Human preview checklist (user is verifying)
Confirm in dark + light, web + mobile:
1. **Logo/raccoon** in header, footer, sidebar, auth pages, admin rail — sizing, the brand-navy tile, eye = Gold (dark) / Sapphire (light).
2. **Mobile** splash (wordmark + tagline), AI Briefing (thinking raccoon + dots), risk gauge ("RISK LEVEL · …").
3. **OG card** (`/opengraph-image`).
4. Marketing/app/admin pages read correctly on the navy/greige tokens; light mode legible.

_Authored 2026-06-22 — visual re-skin (Phases 1–5) complete on `feat/design-foundation`; features + truly-free are separate phases._
