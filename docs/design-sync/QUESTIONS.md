# Design ↔ Implementation Sync — DECISIONS TO ASK THE USER

> **Read this first.** This is a **gap analysis** of the new "Move — Relocation Intelligence" design handoff vs. the current LocateFlow / staging-move repo. **No code has been or will be changed** from this analysis. The user has asked to be consulted **before any implementation begins**.
>
> Below are the decisions that must be made first, numbered **D1…D34** so they can be answered one at a time. Each has: the **question**, the **options**, a **recommended default**, and the **gap IDs** the decision unblocks. Answer in any order — but the Group A and Group B decisions gate almost everything else, so start there.
>
> **The single most important conflict to resolve up front (D5):** the written brief says the new primary color is **teal/green** (#168E9C / #1C8A63 / #2A8E66), but **every design source file actually defaults to Gold #CBA45E** — the teal/green values appear only as light-mode semantic colors and an *optional* Emerald accent ramp. These contradict each other and many downstream decisions depend on the answer.

---

## How to read the recommendations
- **"Re-skin, don't rebuild"** is the default posture: the handoff is largely a *marketing site + phone-framed mobile demo*. It deliberately omits big chunks of the real product (web app shell, settings hub, admin RBAC, recommendation engine). Treat those omissions as **out of handoff scope**, not as "delete it."
- **"Source over brief"** where they conflict: the `.dc.html` files are the literal handoff; the prose brief is a summary that drifted (esp. on color). Flag the conflict, recommend matching the source, let the user override.

---

# GROUP A — Brand & scope
*Gates the whole rename pass. Answer first.*

### D1. Full "Move" rebrand vs. theme-only re-skin?
Is this a coordinated product **rename** (LocateFlow → "Move — Relocation Intelligence"), or only a **visual re-theme** that keeps the LocateFlow name internally?
- **Options:** (a) Full rebrand — wordmark, app identity, package names, storage keys, emails, manifest, support email, legal copy. (b) Theme-only — swap palette/typography, keep "LocateFlow" name. (c) Hybrid — user-facing "Move", internal package/identifier names stay `locateflow`.
- **Recommended:** (c) Hybrid. User-facing surfaces become "Move"; defer the high-risk internal renames (bundle id `com.locateflow.mobile`, `@locateflow/*` packages) unless there's a concrete reason. Treat it as a coordinated rename pass, not a token edit.
- **Unblocks:** DS-01, move-app-01/02, web-app-shell-02, admin-01, onboarding-01, auth-1, marketing-01/10, providers-R1, app-surfaces-1/24, brand-raccoon-2.

### D2. Keep "by LocateFlow" endorsement, or drop "LocateFlow" entirely?
The design footer still reads **"Move by LocateFlow"** (Move Web.dc.html:265), and admin team emails use **@move.app** while support copy mixes in **hello@locateflow.com**.
- **Options:** (a) "Move" standalone. (b) "Move by LocateFlow" endorsement lockup. (c) "Move" with "LocateFlow" only in legal/corporate footers.
- **Recommended:** (b) for now (matches the handoff source), revisit at launch. Pick **one** canonical support email and one footer lockup; fix the stale © year and OG "M" glyph during the same pass.
- **Unblocks:** web-app-shell-17, marketing-13, app-surfaces-1/24, auth-1.

### D3. Is Move actually "100% free"? (positioning + PRO surfaces)
The design positions Move as **"100% free, no subscription."** The current product has **PRO gating, IAP, a $47.88/yr PRO Annual plan, checkout copy, and a subscription settings screen.**
- **Options:** (a) Truly free — strip PRO gating, IAP, checkout/subscription copy everywhere. (b) Free base tier — "100% free" is marketing for a base tier; PRO stays as an upsell. (c) Keep current paid model — treat "100% free" as design-mockup copy only.
- **Recommended:** (b) Free base tier — adopt the "100% free" marketing voice **but** confirm before deleting revenue surfaces; deleting IAP/PRO is a product+revenue decision, not a design one. **High impact — confirm explicitly.**
- **Unblocks:** move-app-03/22/23, auth-3/4/11, marketing-09/15.

### D4. Does the raccoon mascot survive the rebrand, and is the wordmark strictly "Move" in Playfair 900?
The design makes the **raccoon the official logo mark** (gold-bordered tile in nav, hero, footer, OG) and the wordmark **"Move" in Playfair 900**. The current logo is a raster mark + LocateFlow wordmark.
- **Options:** (a) Yes — raccoon is the official mark, "Move" Playfair-900 wordmark everywhere (web shell, marketing, PWA/app icons, OG). (b) Keep raccoon decorative only, text wordmark only. (c) Drop raccoon.
- **Recommended:** (a). Promote the parametric raccoon to the official mark; regenerate static icons/favicons/OG with it. Note this requires hand-regenerating raster assets (they won't follow tokens).
- **Unblocks:** DS-01, marketing-02, web-app-shell-09, admin-18, brand-raccoon-4/5, move-app-24.

---

# GROUP B — Theme / design system
*Gates every color/token decision. Answer right after Group A.*

### D5. ⚠ PRIMARY COLOR CONFLICT — Gold vs. teal/green. Which is authoritative?
The **brief** says primary = teal/green (#168E9C / #1C8A63 / #2A8E66). **Every design source file** defaults to **Gold #CBA45E**; the teal/green values appear only as light-mode *semantic* colors (success/info) and an *optional* Emerald accent ramp.
- **Options:** (a) **Gold stays the default** (matches all `.dc.html` source); Emerald/teal merely available as an alternate accent. (b) **Emerald/teal becomes the new default** (matches the prose brief) — recolors every CTA, focus ring, active state, mascot eye globally. (c) Gold default for app surfaces, teal/green for marketing.
- **Recommended:** (a) **Gold-default**, because the literal handoff source is unanimous on Gold and the current dark primary is already Gold #CBA45E — lowest-risk, highest-fidelity-to-source. **But this directly contradicts the written brief — the user must explicitly confirm which wins.**
- **Unblocks:** DS-02, move-app-04, web-app-shell-13, admin-03, auth-12, providers-T1/D4, dossier-11, brand-raccoon-1/3, marketing-03.

### D6. Adopt the navy/teal-or-gold tokens as the single source of truth across mobile + web + admin?
- **Options:** (a) Single unified token system for all three surfaces. (b) Per-surface palettes (preserve some surface identity, e.g. admin). (c) Web+mobile unified, admin separate.
- **Recommended:** (a) Single unified token source — that's the design intent and the cleanest. Pair with D11 (build-time emitter) so it doesn't recreate the current 5-copy drift.
- **Unblocks:** DS-08, app-surfaces-2, and informs D7.

### D7. Admin: unify onto navy #070B14, or preserve the deliberate graphite #171E2B "Linear" identity?
The admin mockup uses the **same navy** as web (#070B14 / panel #0E1626). The current admin uses a **deliberately separate graphite** "Linear-style" dark track.
- **Options:** (a) Unify onto navy (matches mockup). (b) Keep graphite admin identity. (c) Navy base, but a subtly distinct admin accent.
- **Recommended:** (a) Unify onto navy — the mockup is explicit and unification reduces token sprawl. Re-skin `.adm-aurora` dark block + `themeColor`.
- **Unblocks:** DS-05, admin-02.

### D8. Ship the runtime 3-way accent picker (Gold / Sapphire / Emerald), or pick one and drop the rest?
The design exposes a runtime accent selector with dark+light ramps. Current theme only flips a single primary by light/dark **mode**, not by user-chosen accent.
- **Options:** (a) Ship the user-facing accent picker (model accent as a separate token dimension). (b) Pick one accent (per D5) and drop the others. (c) Ship picker mobile-only.
- **Recommended:** (b) for v1 — pick one accent, ship faster; revisit the picker as a follow-up. A 3-accent × 2-mode matrix multiplies QA/contrast work.
- **Unblocks:** DS-03, move-app-05, web-app-shell-13.

### D9. Ship the lightBg canvas selector (Greige/Pearl/Taupe/Sapphire), or just adopt the warm-greige #EFEADF default?
Current light bg is a cool #F2F4F8 everywhere with no selector; design defaults to warm greige #EFEADF.
- **Options:** (a) Ship the 4-way lightBg selector. (b) Adopt greige default only, no selector. (c) Keep current cool light bg.
- **Recommended:** (b) Adopt greige default only. **Re-run AA contrast checks** — warm canvas + lighter semantic greens change contrast more in light mode than dark.
- **Unblocks:** DS-04, move-app-06/07.

### D10. Global radius bump (cards 18–26px, pills 99px, device frame 42–46px) — adopt?
Current radii are ~8–10px (web 10px / admin 8px).
- **Options:** (a) Adopt the new rounder scale as a token. (b) Keep current radii. (c) Partial (cards yes, frames no).
- **Recommended:** (a) Adopt — mostly mechanical once the scale is a token; audit hardcoded `rounded-[..]` values. `decisionNeeded=false` in the gaps, listed for visibility.
- **Unblocks:** DS-06, move-app-08, onboarding-10, web-app-shell-16.

### D11. Establish a single build-time token emitter BEFORE any value swap?
Today there are **5 hand-synced token copies** (tokens.ts + web/admin globals + web/admin aurora). The design provides **no canonical source** (each page inlines its own vars).
- **Options:** (a) Build `packages/shared/src/design-tokens.ts` as the build-time emitter (web CSS vars + admin vars + mobile JS) *first*, then swap values. (b) Hand-edit the 5 copies as today.
- **Recommended:** (a) Strongly — do this first or the rebrand multiplies the drift. Also decide **who owns deriving the shadcn HSL channel values** from the new flat hex palette (the component layer depends on HSL `--primary`/`--background`, which the handoff doesn't provide). Keep the shadcn HSL layer; derive it.
- **Unblocks:** DS-08/10.

### D12. Retire the aurora `--au-*` layer (.lf-aurora/.adm-aurora), or keep and re-skin it?
The mockups use **simple radial-glow meshes**, not the aurora wrapper/blob/ritual system. There's an aurora-theme regression test.
- **Options:** (a) Retire aurora.css (web+admin), replace with simple radial glows. (b) Keep aurora and re-theme it to navy/gold. (c) Keep web aurora, drop admin's.
- **Recommended:** (b) Keep and re-theme for v1 (lower risk — retiring touches tests and many surfaces); schedule retirement as a follow-up if the simpler meshes are preferred.
- **Unblocks:** DS-09.

### D13. Include the legacy alias-rename codemod + storage-key migration in the rebrand?
Legacy aliases (orange/rose/foil/violet/amber/sky/cyan/emerald) re-point to Gold/Sapphire; some "lie" (mobile `bg-rose` is coral but TS `rose` is Gold). Storage keys are `locateflow-theme` / `locateflow.theme.preference` / `locateflow.moveBriefingDismissed`.
- **Options:** (a) Full codemod — rename aliases to honest `--gold/--teal/--green`, rename storage keys `locateflow-* → move-*` **with a migration shim** so existing users don't lose prefs. (b) Keep lying aliases + old keys (no user-facing change). (c) Honest names only, leave storage keys (lower risk).
- **Recommended:** (c) for v1 (rename color aliases, leave storage keys until D1 rebrand scope is settled), then (a) if full rebrand is chosen — and **always include a migration shim** for any key rename.
- **Unblocks:** DS-12, move-app-02.

---

# GROUP C — New features / elements (build or skip?)

### D14. Dossier ambient: adopt the raccoon-character scene system, or keep the abstract scenes with only a color re-theme?
Every design dossier scene centers the **raccoon mascot** (~22 scenes, mood-driven expressions). Current dossier-ambient is **abstract** (waves/streaks/particles), data-derived, no character.
- **Options:** (a) Adopt the full raccoon character scene system (big art + illustration effort). (b) Keep abstract scenes, re-theme colors only. (c) Hybrid — character on hero scenes, abstract elsewhere.
- **Recommended:** (b) for v1 (re-theme only), schedule the character system as a dedicated design+build epic. If adopting characters, **preserve the data-derived `ambientForSection()` mapping** on top — don't regress to the design's manual `level` enum.
- **Unblocks:** dossier-1/6/7/8/9/13/14, brand-raccoon-1.

### D15. Reconcile the dossier scene taxonomy — which scenes are real product features with data?
Design `type` set = weather/air/water/area/transit/cost/housing. Code `kind` set = flood/school/hazard/radon/water/air/housing/evCharging/neighborhood/weather. **Design-only:** transit, cost, area/crime. **Code-only:** flood, school, radon, evCharging, neighborhood.
- **Options:** (a) Add the design-only scenes (transit/cost/area) as real, data-backed features and identify data sources. (b) Treat design-only scenes as illustrative; keep current data-honest scenes. (c) Full reconcile to a single agreed scene list.
- **Recommended:** (b)+(c): keep the existing data-backed scenes, add design-only scenes **only where a real data source exists** (don't ship ambience that implies data you don't have). Decide per-scene.
- **Unblocks:** dossier-2/3/4/5/10/15.

### D16. Moving screen: build the per-move **Risk gauge** panel and the **raccoon-as-truck** travel marker?
Design shows a risk gauge panel and an animated raccoon-truck route marker; current `moving.tsx` shows neither clearly.
- **Options:** (a) Build both. (b) Build risk gauge (data-backed), skip raccoon-truck (decorative). (c) Skip both for v1.
- **Recommended:** (b) — risk gauge is a real feature if the data exists; raccoon-truck is a delight item for a later pass.
- **Unblocks:** move-app-11/15/10.

### D17. Onboarding: add the in-flow **Welcome hero (step 0)** and **Done/celebration** step (countdown + service + dossier chips)?
Current flow routes straight to the dashboard on completion; no welcome or success step.
- **Options:** (a) Add both. (b) Add Done/celebration only. (c) Keep current (no extra steps).
- **Recommended:** (b) Add the Done/celebration step (high payoff, self-contained); reuse the Welcome hero as a splash rather than a wizard step, since the flow starts post-auth.
- **Unblocks:** onboarding-02/04/16.

### D18. Admin: build the **"Data sources"** health section (FEMA/EPA/NWS/Census/WalkScore status/last-sync/coverage)?
No admin route surfaces external data-source health today; closest is `/connectors` (different model).
- **Options:** (a) Build a new Data-sources section. (b) Re-skin `/connectors` into this model. (c) Skip — treat as mock filler.
- **Recommended:** (b) Re-skin `/connectors` toward the design's status/last-sync/coverage cards rather than building net-new.
- **Unblocks:** admin-06.

### D19. Admin: build the **"AI briefings"** daily-summary feature (settings toggle)?
- **Options:** (a) Build it. (b) Mock-only filler — skip.
- **Recommended:** (b) Skip for v1 unless product wants it — it's a single toggle in the mock with no current equivalent.
- **Unblocks:** admin-11.

### D20. Build **"Share this move"** as a dedicated consumer screen + a **copyable invite link**?
Design shows a focused "Share this move" surface with a full-width "Share invite link" button. Current invites are **email-only**, folded into `/settings/workspace`; no copy-link affordance.
- **Options:** (a) Build the dedicated screen **and** a tokenized shareable link (needs backend: token exposure + revocation). (b) Re-skin `/settings/workspace` + add a "Share" entry, keep email-only. (c) Add copy-link only, no new screen.
- **Recommended:** (b) for v1 (re-skin + Share entry); treat the shareable-link token work as a separate scoped feature (security review required).
- **Unblocks:** app-surfaces-3/4.

### D21. Make reminders **completable** (tappable checkbox / done state), or keep them read/navigate-only?
Design reminders have a checkbox that completes (strike-through, opacity, accent→green). Current mobile reminders are navigational only — no per-reminder done state.
- **Options:** (a) Add completion (needs a per-reminder done model + persistence). (b) Keep read-only. 
- **Recommended:** (a) if reminders are meant to be actionable (likely yes) — but it's a data-model change, so confirm before building. Also aligns the header copy ("{open} open · {done} done") and the done-state visual.
- **Unblocks:** app-surfaces-7/8/23.

### D22. Build the **per-move risk model** surfacing in admin (risk pills, "High risk 312" stat, live-ops board)?
Partial today: `/moving/at-risk` exists, but the admin moves list lacks a per-row risk column.
- **Options:** (a) Add risk column + risk stat to the moves list. (b) Skip — keep at-risk board only.
- **Recommended:** (a) — small addition, matches the mock, leverages existing risk data.
- **Unblocks:** admin-13.

---

# GROUP D — Per-surface IA / layout decisions & rollout

### D23. Authenticated **web app shell**: keep & re-skin, or replace with the design's marketing-site + phone-embed model?
The handoff ships **no authenticated web app shell** — the "web app" is the **mobile app rendered in a 390×844 phone bezel** behind a marketing nav. The current product has a full shell (Sidebar + Header + MobileNav + banners) wrapping ~28 routes.
- **Options:** (a) Keep the existing Next.js App-Router shell (SSR auth gate, sidebar, topbar, 13-widget dashboard) and **re-skin** it with Move branding. (b) Replace the desktop web app with the phone-embed model. (c) Marketing site adopts the design; the authenticated app keeps its shell, re-skinned.
- **Recommended:** (c)/(a) — **keep and re-skin the shell.** The phone-embed is almost certainly a **marketing showcase**, not the intended desktop product. Confirm explicitly. Keep SSR auth gate, sidebar, topbar utilities (search/notifications/theme/lang/user-menu), settings hub, impersonation/invite/install banners — all **out of handoff scope, not deletions.**
- **Unblocks:** web-app-shell-01/03/04/05/06/11/14/15, move-app-21.

### D24. Web dashboard: keep the **13-widget drag-reorder** dashboard, or move to the design's mobile fixed-section IA?
- **Options:** (a) Keep & re-theme the widget dashboard. (b) Replace with fixed-section IA matching mobile. 
- **Recommended:** (a) Keep & re-theme — confirm it's not meant to be replaced by the phone embed. Tied to D23.
- **Unblocks:** web-app-shell-06, move-app-21.

### D25. If the shell is kept (D23a/c): do the **left sidebar + bottom tab bar** survive, or collapse to the design's single top-nav + burger?
- **Options:** (a) Keep sidebar (desktop) + bottom tab bar (mobile-web), re-skinned. (b) Collapse to single top-nav + burger dropdown like the marketing design. 
- **Recommended:** (a) Keep — the design's single-top-nav is a *marketing* nav; the app needs its richer nav. Only adopt the top-nav model if the whole product moves to it.
- **Unblocks:** web-app-shell-03/04/05.

### D26. Admin nav: flatten to the mock's **9-item flat sidebar**, or keep the grouped, RBAC-gated rail+panel (~33 items)?
Mock = single 250px aside, 9 flat buttons. Current = 76px rail + 250px panel, grouped, RBAC-gated.
- **Options:** (a) Flatten to 9 items (drop/fold Subscriptions, Workspaces, Movers, Connectors, Feature-Flags, Security, Audit-Logs…). (b) Keep grouped rail+panel; treat the mock as an illustrative subset. (c) Adopt the mock's visual style on the existing grouped structure.
- **Recommended:** (b)/(c) — keep the grouped RBAC nav (the mock is almost certainly an illustrative subset), but adopt the mock's labels/active-bar styling. **Do not drop RBAC-gated sections** without an explicit decision.
- **Unblocks:** admin-04/05.

### D27. Admin: keep **light mode**, or go **dark-only** to match the dark-only mock?
The mock has no light scope; current admin authors light+dark for every token.
- **Options:** (a) Keep light+dark parity. (b) Dark-only.
- **Recommended:** (a) Keep light mode — the mock being dark-only is likely just the handoff scope, not a directive to delete light mode. Confirm.
- **Unblocks:** admin-20.

### D28. Admin Settings: consolidate /settings + /team + billing into **one page** (per mock), or keep split routes?
- **Options:** (a) Consolidate. (b) Keep split routes, port the visual layout.
- **Recommended:** (b) Keep split routes (deep-linking/RBAC), adopt the mock's card layout within them.
- **Unblocks:** admin-10.

### D29. Onboarding: fold **account creation** (email/password + Apple/Google + Terms) INTO the wizard, or keep auth as separate pre-onboarding routes?
Design shows an Account step inside onboarding; current architecture requires an existing session before onboarding (`/sign-up` and `(auth)/sign-up.tsx` are separate).
- **Options:** (a) Merge sign-up into the onboarding wizard. (b) Keep auth as distinct pre-onboarding routes.
- **Recommended:** (b) Keep separate — matches existing architecture; the merge is a large auth-flow change for little gain. Reuse existing OAuth marks if ever merged.
- **Unblocks:** onboarding-03/14.

### D30. Onboarding Profile: reduce to the design's **4 move-type cards**, or keep the rich profile capture?
Design Profile = 4 icon radio cards (rent/buy/work/student). Current Profile captures names, age, family, children/pets/cars/senior/storage/motorcycle/boat, sensitive opt-in, move type + legal consent — which the checklist & recommendation engines depend on.
- **Options:** (a) Reduce to 4 cards. (b) Keep rich capture; treat the 4 cards as just the move-type sub-control. (c) Keep capture but relocate it later in the flow.
- **Recommended:** (b) Keep the rich capture (engines depend on it); use the 4 cards as the move-type control. **Do not remove fields** without confirming engine impact.
- **Unblocks:** onboarding-05/06/07.

### D31. Is the minimal **4-step web onboarding** mock the target (implying removal of legal panel / coach / provider ritual / Pro showcase / free teaser), or just an abbreviated mock?
- **Options:** (a) Minimal 4-step is the target — remove the extra surfaces. (b) Abbreviated mock — keep legal/coach/teaser, just re-skin.
- **Recommended:** (b) Abbreviated mock — **keep legal consent, coach, teaser** (legal especially is non-negotiable). Confirm with owner. Also reconcile the step counter denominator to the final step count; note the team already deliberately dropped the prototype's plan-picker step.
- **Unblocks:** onboarding-08/09/12.

### D32. Providers: does the lean **single-category comparison** layout REPLACE the full directory + recommendation engine, or only restyle the card/compare components?
Design = one ZIP, "Internet providers," Speed/Price/Rating stat trio, checkbox compare. Current = all-categories directory + Smart-setup plan, sponsored slot, recommended grid, trust/coverage lines, affiliate CTAs, state rules.
- **Options:** (a) Replace with the lean single-category screen. (b) Restyle the existing directory/engine to match the card+compare visuals; keep recommendation/sponsored/affiliate surfaces. (c) Add a per-category compare drilldown *alongside* the directory.
- **Recommended:** (b)/(c) — keep the recommendation/sponsored/affiliate surfaces (revenue + value), restyle to match, optionally add a per-category drilldown. Also decide: surface **Speed/Price/Rating only for connectivity categories** where that data exists (don't fabricate it elsewhere). Keep real logos over emoji placeholders. Compare cap: keep 4 (superset) or match design's 3.
- **Unblocks:** providers-D1/D2/D3/M1/M2/N1/X1, cprov-N1/M1.

### D33. Marketing home: prune to the design's ~11 sections (drop chip-storm/stats/risk-grid/social-proof/pricing/early-access/mobile-mockup), add the **Always-free checklist band**, and decide **dark-only vs. light**?
- **Options:** (a) Prune to match the design's section set + add the Always-free band; render dark-only. (b) Keep the richer current home, re-skin, keep light mode. (c) Selective prune.
- **Recommended:** (c) Selective — adopt the Always-free band (from the real free-feature registry, not hardcoded), drop clearly redundant sections, but keep what converts. Tie dark-only vs. light to D9/D27 — recommend keeping light mode unless product wants dark-only. Verify the HeroPhoneShowcase / DossierShowcase "rough/dream" toggle exists or build it.
- **Unblocks:** marketing-04/05/06/11/15/16/17/18/19.

### D34. Rollout order — which surface ships the re-skin first?
Once the above are decided, in what order do we implement?
- **Options / Recommended sequence:**
  1. **Tokens & brand foundation** (D5/D6/D11) — emitter + palette + wordmark/mascot. Nothing else is safe to start first.
  2. **Mobile app** — it's the design's primary, most-complete surface (the whole "web app" is the mobile app embedded).
  3. **Marketing site** — highest external visibility, mostly covered by the handoff.
  4. **Web app shell re-skin** — re-theme, no IA change (D23).
  5. **Admin** — lowest external visibility; resolve D7/D26/D27 first.
- **Recommended:** Approve this order, or re-prioritize per business need.
- **Unblocks:** sequencing for all areas.

---

## Quick-reference: which gaps each decision resolves
| D | Theme | Gaps it gates |
|---|---|---|
| D1 | Rebrand scope | DS-01, move-app-01/02, web-app-shell-02, admin-01, onboarding-01, auth-1, marketing-01/10, providers-R1, app-surfaces-1, brand-raccoon-2 |
| D2 | "by LocateFlow" lockup | web-app-shell-17, marketing-13, app-surfaces-24, auth-1 |
| D3 | 100% free vs PRO | move-app-03/22/23, auth-3/4/11, marketing-09/15 |
| D4 | Raccoon mark + wordmark | DS-01, marketing-02, web-app-shell-09, admin-18, brand-raccoon-4/5, move-app-24 |
| D5 | ⚠ Gold vs teal/green | DS-02, move-app-04, web-app-shell-13, admin-03, auth-12, providers-T1/D4, dossier-11, brand-raccoon-1/3, marketing-03 |
| D6 | Single token source | DS-08, app-surfaces-2 |
| D7 | Admin navy vs graphite | DS-05, admin-02 |
| D8 | Accent picker | DS-03, move-app-05, web-app-shell-13 |
| D9 | lightBg / greige | DS-04, move-app-06/07 |
| D10 | Radius bump | DS-06, move-app-08, onboarding-10, web-app-shell-16 |
| D11 | Token emitter + HSL | DS-08/10 |
| D12 | Aurora layer | DS-09 |
| D13 | Alias/key rename | DS-12, move-app-02 |
| D14 | Raccoon dossier scenes | dossier-1/6/7/8/9/13/14, brand-raccoon-1 |
| D15 | Dossier taxonomy | dossier-2/3/4/5/10/15 |
| D16 | Risk gauge + truck | move-app-10/11/15 |
| D17 | Onboarding welcome/done | onboarding-02/04/16 |
| D18 | Admin Data sources | admin-06 |
| D19 | Admin AI briefings | admin-11 |
| D20 | Share this move / link | app-surfaces-3/4 |
| D21 | Completable reminders | app-surfaces-7/8/23 |
| D22 | Admin per-move risk | admin-13 |
| D23 | Web app shell | web-app-shell-01/03/04/05/06/11/14/15, move-app-21 |
| D24 | Widget dashboard | web-app-shell-06, move-app-21 |
| D25 | Sidebar/tab bar | web-app-shell-03/04/05 |
| D26 | Admin nav flatten | admin-04/05 |
| D27 | Admin light mode | admin-20 |
| D28 | Admin settings consolidate | admin-10 |
| D29 | Auth in onboarding | onboarding-03/14 |
| D30 | Onboarding profile depth | onboarding-05/06/07 |
| D31 | Minimal web onboarding | onboarding-08/09/12 |
| D32 | Providers layout | providers-D1/D2/D3/M1/M2/N1/X1, cprov-N1/M1 |
| D33 | Marketing home sections | marketing-04/05/06/11/15/16/17/18/19 |
| D34 | Rollout order | (all) |

---

*Lower-severity, non-blocking items (e.g. exact alpha values, OAuth button order, emoji-vs-lucide icon choice, copy-string tweaks, font cleanup) are intentionally NOT promoted to decisions here — they fold into the per-surface implementation under the relevant decision above and don't need a standalone answer. They're tracked in the per-area gap docs under `docs/design-sync/`.*
