# 00 — Master Gap Report · NEW "Move" handoff ↔ CURRENT "LocateFlow" (staging-move)

**Type:** DESIGN ↔ IMPLEMENTATION GAP ANALYSIS ONLY — no code changes proposed here, only findings + a sequencing recommendation.
**Date:** 2026-06-22.

**Sources**
- NEW design (source of truth): `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/` — the Claude Design handoff (`Move.dc.html`, `Move Web.dc.html`, `Web.dc.html`, `Index.dc.html`, `Admin.dc.html`, `Onboarding.dc.html`, `Web Onboarding.dc.html`, `Auth.dc.html`, `Web Login.dc.html`, `Providers.dc.html`, `CustomProviders.dc.html`, `DossierScene.dc.html`, `Raccoon.dc.html`, `Reminders.dc.html`, `Search.dc.html`, `Help.dc.html`, `Invitations.dc.html`, `Web Features.dc.html`, `Web Why-Free.dc.html`, `manifest.json`, generic `support.js` dc-runtime).
- CURRENT system: repo at `C:/Users/Windows/Desktop/Staging/staging-move` (Next 16 web+admin, Expo mobile, Tailwind + CSS-vars + NativeWind). Prior inventory in `docs/ui-renewal/` (`01_THEME_SYSTEM.md`, `02_COMPONENT_CATALOG.md`, `03_BRAND_AND_LAYOUT.md`, `10`–`13`, `20_RENEWAL_PLAYBOOK.md`).
- Per-area detail: `docs/design-sync/01_DESIGN_SYSTEM_DELTA.md` and `docs/design-sync/pages/*.md`.

---

## 1. Executive summary

**What the new design IS.** A full **rebrand** of LocateFlow → **"Move — Relocation Intelligence"**, positioned as **"100% free"** (manifest `name`/`short_name`; wordmark "Move" in Playfair-900). The brand mark is the **raccoon mascot** (parametric `Raccoon.dc.html` with `head/mask/ear/eye/pupil` props). The palette is a **dark navy canvas `#070B14`** with very rounded surfaces (cards 18–26px, phone frame 42px, pills 99px) and Playfair / DM Sans / DM Mono typography (legacy Geist/Fraunces dropped).

**Critical correction to the brief.** The brief describes "teal/green accents (`#168E9C` / `#1C8A63` / `#2A8E66`)" as the new primary. **The design source does not support that.** Across every handoff page the **default accent stays Gold `#CBA45E`** — identical to current LocateFlow — on the navy canvas. `#168E9C`/`#1C8A63` are the **light-mode semantic teal/green**; `#2A8E66` is the **light-mode "Emerald" accent ramp**. Emerald is one of **three runtime-selectable accents** (Gold default / Sapphire / Emerald), not the brand primary. This single ambiguity (**DS-02**) is the highest-leverage decision in the whole rebrand and gates the size of the color swap. See §3.

**How big is the change.** Large in **surface area** (rebrand naming, "100% free" repositioning, mascot promotion, radius bump, admin canvas unification, new feature bands), but **small in raw dark-mode color values** *if* Gold stays the default — dark Gold, surfaces, text, and dark semantic colors are already identical between current and new. The expensive deltas are: the token architecture (the design ships **no canonical token source**, while the repo already suffers a **5-copy hand-synced drift problem** — see `docs/ui-renewal/20_RENEWAL_PLAYBOOK.md` §1.1), the rebrand rename pass (incl. storage keys + alias sprawl), the "100% free" vs paid-PRO contradiction, several **net-new feature surfaces** (raccoon-driven Dossier scenes, Reminders completion, Share-this-move, Data-sources admin, accent/lightBg pickers), and a **web↔design architecture mismatch** (the new "web app" is the mobile app embedded in a phone bezel — no sidebar/topbar/widget-dashboard in the handoff).

**Verdict on integration status: NOT integrated.** None of the new "Move" design is reflected in the current build. The repo is mid-way through a *prior* internal "Edition VIII LocateFlow" renewal (still Gold/Sapphire, still "LocateFlow", token drift unresolved). The Move handoff is a fresh, untracked layer on top. Integration is blocked on ~30 `decisionNeeded` gaps (rebrand scope, accent default, free vs paid, admin identity, aurora fate, web shell model, dossier mascot adoption).

---

## 2. Per-area status table

Gap counts are H/M/L by severity, taken from the aggregated findings.

| Area | Design file(s) | Current state | #gaps (H/M/L) | Biggest delta |
|---|---|---|---|---|
| **design-system-delta** | `Move.dc.html`, `Move Web.dc.html`, `Web.dc.html`, `Admin.dc.html`, `manifest.json` | 5 hand-synced token copies, Gold/Sapphire, aurora `--au-*`, shadcn HSL | 12 (4/6/2) | Rebrand + **no canonical token source** vs existing 5-copy drift (DS-01, DS-08) |
| **move-app** (mobile) | `Move.dc.html`, `Raccoon.dc.html`, `DossierScene.dc.html` | Expo app, "LocateFlow", PRO gating, accent=rose, dark-only NativeWind | 24 (3/12/9) | App identity + **"100% free" vs paid PRO** (move-app-01/03) |
| **web-app-shell** | `Web.dc.html`, `Move Web.dc.html` | Full AppShell (Sidebar+Header+MobileNav) over ~28 routes | 17 (7/5/5) | **Design ships no web app shell** — web app = mobile app in a phone bezel (web-app-shell-01) |
| **dossier** | `DossierScene.dc.html` (58KB), `Raccoon.dc.html` | Abstract `dossier-ambient` scenes, data-derived, no character | 15 (2/9/4) | **Raccoon mascot is the centre of every scene** + taxonomy mismatch (dossier-1/2) |
| **admin** | `Admin.dc.html` | Aurora graphite `#171E2B`, grouped rail+panel nav, light+dark | 22 (6/8/8) | Navy unification + **flat 9-item nav vs grouped RBAC rail** (admin-02/04/05) |
| **onboarding** | `Onboarding.dc.html`, `Web Onboarding.dc.html` | 4-step post-auth wizard (Profile→Address→Services→Moving) | 16 (4/7/5) | Step count/order + in-flow Account/Welcome/Done steps (onboarding-02/03/04/08) |
| **auth** | `Web Login.dc.html`, `Auth.dc.html` | Web wordmark "LocateFlow", "Secure access" footer, paid framing | 14 (2/5/7) | Wordmark + **"100% free" trust line vs checkout copy** (auth-1/3/11) |
| **providers** | `Providers.dc.html`, `CustomProviders.dc.html` | All-category directory, recommendation engine, sponsored/affiliate | 13 (2/8/3) | Navy/gold re-token + **Speed/Price/Rating stat trio** not sourced today (providers-T1/D1) |
| **marketing** | `Move Web.dc.html`, `Web Features.dc.html`, `Web Why-Free.dc.html` | ~16-section home, sapphire light mode, pricing tiers | 20 (3/9/8) | Rebrand + raccoon mark + **dark-only navy vs light sapphire** (marketing-01/02/03) |
| **app-surfaces** (reminders/search/help/invites) | `Reminders.dc.html`, `Search.dc.html`, `Help.dc.html`, `Invitations.dc.html` | Help/footers say "LocateFlow"; no Share screen; reminders read-only | 24 (4/9/11) | **Share-this-move screen + invite link**, completable reminders (app-surfaces-3/4/7) |
| **brand-raccoon** | `Raccoon.dc.html` | Eye=Gold (web/mobile) / Sapphire (admin); static SVG assets; OG "M" glyph | 8 (1/4/3) | Eye accent token + **admin eye divergence** + OG glyph bug (brand-raccoon-1/3/4) |

**Totals:** ~185 gaps across 11 areas (≈38 High / ≈82 Medium / ≈65 Low). ~30 carry `decisionNeeded=true`.

---

## 3. Cross-cutting themes

These threads recur across every area and should be decided **once, centrally**, not per-page.

1. **Rebrand: LocateFlow → Move (decision needed — DS-01, move-app-01/02, web-app-shell-02/17, admin-01, onboarding-01, auth-1, marketing-01/10, app-surfaces-1/24, brand-raccoon-2).** A coordinated rename pass, **not** a token edit: wordmark/titles/meta, support email (`hello@locateflow.com` → ?), `package.json` scope `@locateflow/*`, storage keys (`locateflow-theme`, `locateflow-admin-theme`, `locateflow.moveBriefingDismissed`, AsyncStorage `locateflow.theme.preference`) **with migration**, app bundle id `com.locateflow.mobile`, and the unresolved footer lockup "Move **by LocateFlow**" (web-app-shell-17, marketing-13). Whether the raccoon mascot stays is part of this decision (it is promoted to the official mark in the design — marketing-02, brand-raccoon-1).

2. **Theme/accent: Gold stays default, teal/green is optional (decision needed — DS-02/03/04, move-app-04, admin-03, auth-12, providers-T1, brand-raccoon-1).** The brief's "teal/green primary" is **not in the source**. Decide: (a) Gold-default with Emerald merely available (what the source says), or (b) Emerald/teal-green as the new default (a real codemod given the legacy `gold/foil/orange/rose` alias sprawl — DS-12). The whole color-swap cost hinges on this. New runtime dimensions appear in the design that the current single-mode-flip system does not model: a **3-way accent picker** (DS-03/move-app-05) and a **lightBg canvas selector** (Greige/Pearl/Taupe/Sapphire — DS-04/move-app-06).

3. **Theme swap mechanics: navy unification, warm light, radius bump.** Admin loses its deliberate graphite `#171E2B` and unifies onto navy `#070B14` (DS-05, admin-02 — decision needed). Light mode moves from cool `#F2F4F8` to warm greige `#EFEADF` with lighter semantic greens (DS-04/07, move-app-07). Global radius bump 8–10px → 18–26px cards / 99px pills / 42px frame (DS-06, move-app-08, web-app-shell-16). The `--au-*` aurora wrapper layer is **absent from the design** — retire or re-skin (DS-09 — decision needed).

4. **Token architecture vs existing drift (DS-08/10).** The design provides **no canonical token source** (inline `--var` per page); the repo already has **5 hand-synced copies that drift** (`docs/ui-renewal/20_RENEWAL_PLAYBOOK.md` §1.1). Adopting the design naively multiplies the drift. The shadcn HSL layer has no design representation and must be **derived** from the new hex, not dropped (DS-10).

5. **"100% free" vs retained paid PRO (decision needed — move-app-03, auth-11).** The design markets "100% free, no subscription"; the code still has PRO gating, `settings/subscription.tsx` IAP, "PRO Annual $47.88/yr" pills, and sign-up checkout copy. Either strip PRO or treat free as a base-tier marketing frame — this contradiction surfaces in mobile, auth, and marketing.

6. **New feature bands / surfaces (mostly "new"/"missing").** Raccoon-as-truck travel marker (move-app-11); raccoon-centred **Dossier scenes** with a weather/area/water/transit/cost/air condition matrix + live OSM map (DS-11, dossier-1..15); admin **Data-sources** health section (admin-06) and AI-briefings toggle (admin-11); **Share-this-move** screen + copyable invite link (app-surfaces-3/4); **completable Reminders** (app-surfaces-7/23); onboarding **Welcome/Account/Done** steps (onboarding-02/03/04); marketing **Always-free checklist** + **Rough/Dream demo toggle** (marketing-05/06).

7. **Mobile vs web architecture mismatch (decision needed — web-app-shell-01/03/04/06/15, move-app-21).** The design's "web app" is literally the **mobile Move app embedded in a 390×844 phone bezel** behind a `#/app` hash route — there is **no** sidebar, topbar, or 13-widget drag dashboard anywhere in the handoff. The current web is a full Next.js App-Router shell with SSR auth gate. Recommended reading: treat the missing web shell as **out-of-handoff-scope** (re-skin existing AppShell with Move branding) rather than as a deletion mandate — but confirm with product whether the phone-embed is the intended desktop experience or only a marketing device.

8. **Emoji/glyph storytelling vs icon components.** The mockups lean on emoji (provider logos, search rows, admin live-ops, dossier props 💀/RENT/$/↑). The repo uses real logos + lucide icons. Treat emoji as mock shorthand pending an a11y/i18n review (providers-M2, app-surfaces-15, admin-19, dossier-15).

---

## 4. Gap inventory grouped by TYPE

### rebrand (Move vs LocateFlow naming/brand)
DS-01, DS-12, move-app-01, move-app-02, web-app-shell-02, web-app-shell-08, admin-01, admin-18, onboarding-01, auth-1, marketing-01, marketing-02, marketing-10, marketing-13, app-surfaces-1, app-surfaces-24, brand-raccoon-2, providers-R1.
**Core:** one coordinated rename pass (wordmark, meta, package scope, storage keys + migration, support email, bundle id, alias codemod, "by LocateFlow" lockup decision).

### theme (palette / typography / token delta)
DS-02, DS-06, DS-07, move-app-04, move-app-07, move-app-08, move-app-19, move-app-24, web-app-shell-07, web-app-shell-12, web-app-shell-13, web-app-shell-16, admin-02, admin-03, admin-20, auth-12, providers-T1, marketing-03, marketing-12, marketing-18, app-surfaces-2, brand-raccoon-1, brand-raccoon-6.
**Core:** accent default (Gold vs Emerald), navy admin unification, warm greige light, lighter semantic greens, radius bump, eye-accent token, pre-splash `#0A0F18`→`#0A0F1C` fix.

### new (new component/feature/section)
DS-03, DS-04, DS-11, move-app-05, move-app-06, move-app-11, move-app-23, web-app-shell-09, web-app-shell-10, admin-11, admin-13, dossier-1, dossier-15, onboarding-02, onboarding-03, onboarding-04, onboarding-13, onboarding-16, auth-11, providers-N1, cprov-N1, marketing-05, marketing-06, marketing-07, marketing-16, marketing-17, marketing-20, app-surfaces-9, app-surfaces-13, app-surfaces-23.
**Core:** accent/lightBg pickers, raccoon-as-truck, raccoon Dossier scene system, Data-sources & AI-briefings admin, Share-this-move + invite link, onboarding Welcome/Account/Done, Always-free band, Rough/Dream toggle, completable reminders, search suggestion chips.

### missing (in design, absent in code)
DS-10, web-app-shell-01, web-app-shell-06, web-app-shell-14, dossier-3, dossier-4, dossier-5, dossier-10, admin-06, admin-17, onboarding-15, providers-M1, providers-M2, cprov-M1, marketing-05, marketing-06, marketing-07, app-surfaces-3, app-surfaces-4, app-surfaces-12, app-surfaces-17, app-surfaces-19, auth-3, auth-6.
*(Note: several here are missing **in design** vs present in code — e.g. web shell, settings hub, current flood/school/radon scenes, FAQ accordion — i.e. out-of-handoff-scope, retain don't delete: web-app-shell-01/06/14, dossier-10, app-surfaces-21.)*

### different (design vs current layout/style/copy differ)
DS-05, DS-08, DS-09, move-app-09/10/12/13/14/15/16/20/21/22, web-app-shell-03/04/05/08/11/15, dossier-2/6/7/8/9/13/14, admin-04/05/07/08/09/10/12/14/15/16/19/21/22, onboarding-05/06/07/08/09/11/12/14, auth-2/4/7/8/9/10/13/14, providers-D1/D2/D3/D4/X1, cprov-D1/D2/D3/D4, marketing-04/08/09/11/13/14/15/19, app-surfaces-5/6/8/10/11/14/16/18/20/22, brand-raccoon-3/5/7.
**Core:** layout/IA reconciliations (nav models, step counts, card vs row treatments, compare affordances, KPI sets, scene illustration style).

### wrong (current looks like a defect vs design intent)
move-app-17, move-app-18, web-app-shell-17, auth-5, marketing-19, brand-raccoon-4.
**Core:** hardcoded `CATEGORY_COLORS` ×3 files, `#fff`/`#000` on accents, "by LocateFlow" unresolved, mobile sign-in title/subtitle swapped, extra hero trust chip, OG "M" glyph instead of raccoon mark.

---

## 5. Recommended execution strategy

**Principle:** foundation/theme first → shared components → page-by-page rollout, lowest-risk first. This deliberately mirrors `docs/ui-renewal/20_RENEWAL_PLAYBOOK.md` (Phases 0–4) because the Move rebrand **cannot land safely until the playbook's existing token-drift problem (§1.1 — 5 hand-synced copies, "sync manually" contract) is resolved.** Adopting the design's inline-per-page tokens on top of the current 5-copy drift would multiply the problem (DS-08).

**Step 0 — Decisions gate (blocks everything).** Resolve the `decisionNeeded` cross-cutters in §3 before code: rebrand scope (DS-01), **accent default Gold vs Emerald (DS-02)** — this sizes the entire color swap, free vs paid (move-app-03), admin navy unification (admin-02/DS-05), aurora fate (DS-09), and web-shell model (web-app-shell-01/15). Recommend confirming these with the product owner in one pass.

**Step 1 — Token foundation (the keystone, no visual change).** Execute Playbook Phase 1: designate `packages/shared/src/design-tokens.ts` as the build-time emitter for web CSS vars / admin vars / mobile JS, reproducing current values exactly first, then apply the Move deltas in **one place**: surface3 `#16203A→#1F2C47`, admin `--panel/--panel2`, faint/border alphas, warm greige light + lighter semantic greens (DS-04/07), the radius scale bump (DS-06), and — per the Step 0 accent decision — model **accent and lightBg as new token dimensions** (DS-03/04). Keep the shadcn HSL layer but **derive** it from the new hex (DS-10). Decide aurora `--au-*` retire-vs-reskin here (DS-09). Run the rename/alias codemod (DS-01/DS-12) in this phase with a frozen shim.

**Step 2 — Shared components / brand primitives (low visual risk, high leverage).** Single Logo/Wordmark "Move" Playfair-900 component; parametric raccoon mascot with **eye + head/mask/ear/pupil as tokens** (brand-raccoon-1/6), unifying the admin eye onto the brand accent (brand-raccoon-3) and regenerating static SVG/favicon/icon assets (brand-raccoon-5); fix the OG "M" glyph (brand-raccoon-4, marketing-19/wrong). Tokenize the escaped hex from Playbook §1.3 — mobile `CATEGORY_COLORS` ×3 (move-app-17), `#fff`/`#000` on-accent → `colors.onAccent` (move-app-18), pre-splash bg (move-app-19). Build the still-missing shared primitives (Table/Tabs/Spinner/Toast) the playbook §1.5 already calls out, so feature pages below have them.

**Step 3 — Page-by-page rollout (lowest-risk first), matching Playbook Phase 3 order:**

| Order | Surface | Lead gaps | Risk |
|---|---|---|---|
| 1 | **Auth** (web + mobile) | auth-1/2/3/5/11/12, onboarding-01 | Low — token-only re-skin + copy; fix title/subtitle swap (auth-5). |
| 2 | **Marketing / home / why-free** | marketing-01..20 | Low–med — shared header/footer; decide dark-only, prune code-only sections, Always-free band. |
| 3 | **Onboarding** | onboarding-01..16 | Med — step-count reconciliation + optional Welcome/Account/Done; keep richer legal/coach/teaser. |
| 4 | **Admin** | admin-01..22 | Med — navy unification + nav-model decision; Data-sources/AI-briefings as feature deltas. |
| 5 | **Web authenticated app shell + app-surfaces** | web-app-shell-01..17, app-surfaces-1..24 | Med–high — confirm shell stays (re-skin, not delete); Share screen + invite link; completable reminders. |
| 6 | **Providers** | providers-T1..X1, cprov-* | Med — re-token to navy/gold; decide Speed/Price/Rating sourcing; keep recommendation/affiliate chrome. |
| 7 | **Mobile Move app** | move-app-01..24 | High — depends on Steps 1–2 (token codegen, static-theme live-switch fix, CATEGORY_COLORS de-dup); also app identity + free/PRO. |
| 8 | **Dossier scenes** | dossier-1..15 | High — biggest feature delta; gate on Step 0 raccoon-adoption decision; keep `ambientForSection()` data-derivation layer (dossier-14) over any new character scenes. |

**Step 4 — Brand cleanup (Playbook Phase 4).** Remove legacy Geist/Fraunces (move-app-20), finalize footer lockup (marketing-13, web-app-shell-17), document mascot mood-to-surface mapping (brand-raccoon-8), retire dropped mascot family shims (brand-raccoon-7).

**Why this order is safe.** Token + brand foundations (Steps 1–2) make every later page a token-only re-skin; auth/marketing (lowest logic density) validate the foundation cheaply; mobile and dossier (highest risk, most hardcoded color, most new features) come last, after the token codegen + static-theme fix they depend on have landed — exactly the dependency ordering the existing playbook already established for the LocateFlow renewal.

---

*All gap IDs reference the aggregated findings JSON. Per-area evidence (design file + locator AND current repo file) lives in `docs/design-sync/01_DESIGN_SYSTEM_DELTA.md` and `docs/design-sync/pages/*.md`. This report is the index into the work, not a substitute for those rows.*
