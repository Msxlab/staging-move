# 20 — Renewal Playbook · LocateFlow Theme + UI/UX Renewal

Synthesized from the inventories in this folder (`01`–`03`, `10`–`13`) and the aggregated inconsistency findings. This is the **how-to-migrate** document: current-state debt, the target unified design-system shape, a migration approach, per-app checklists, and regression safety. It does **not** define the new visual language — it defines the structure that makes a reskin safe and one-touch.

Repo root: `C:/Users/Windows/Desktop/Staging/staging-move`. Companion docs cited inline.
Brand era in code: **Edition VIII · Gold/Sapphire** — dark primary Gold `#CBA45E`, light primary Sapphire `#2E5FB0`.

---

## 1. Current-state summary (the debt a renewal must absorb)

### 1.1 Token drift — 5+ palette copies, no shared build pipeline

The canonical module `packages/shared/src/design-tokens.ts` is **runtime-consumed ONLY by mobile**. Web and admin keep **hand-synced copies**. Its own docstring admits this and says "sync manually." Result: **4 independent token surfaces drift** from canonical and each other.

| Palette copy | File | Consumed by | Status |
|---|---|---|---|
| Canonical (declared SoT) | `packages/shared/src/design-tokens.ts` | mobile runtime only | The only true runtime consumer. |
| Web globals | `apps/web/src/styles/globals.css` (~2178 lines) | web CSS | Manual mirror; drifts. |
| Web aurora | `apps/web/src/styles/aurora.css` (`.lf-aurora`) | web `<body>` | "Ported from admin" but **diverged**. |
| Admin globals | `apps/admin/src/app/globals.css` | admin CSS | Manual mirror; dark surfaces differ from web. |
| Admin aurora | `apps/admin/src/app/aurora.css` (`.adm-aurora`) | admin shell | Different class + richer token set than web aurora. |
| Mobile NativeWind | `apps/mobile/tailwind.config.ts` | mobile build | Hardcoded hex, **dark-only**, does not theme-switch. |

**Concrete value disagreements** (full tables in `01_THEME_SYSTEM.md` §1):

| Concept | Web | Admin | Note |
|---|---|---|---|
| Dark base bg | `#070B14` (navy) | `#171E2B` (graphite) | Biggest drift. |
| `theme-color` meta | `#0A0F18` (matches neither; never switches for light) | `#171E2B` | 4 unshared "navy" values total: web `#0A0F18`, admin `#171E2B`, mobile `#070B14`, OG `#070B14→#18233A`. |
| `--radius` | `0.625rem` (10px) | `0.5rem` (8px, not re-set in `.dark`) | Admin cards 2px tighter. |
| Tone alphas | 0.10 bg / 0.22–0.28 border | 0.16 bg / 0.32 border | Plus admin tone fg hex differ (`--tone-sage-fg #A0EAD2` vs web `#54CB7E`). |
| Family tier hue | Gold | teal `#34D8A6`/`#1FB98A` | `tier-family`/`tier-bar` diverge. |
| `--destructive` (dark) | `359 75% 75%` | `359 68% 70%` | Also light: `358 47% 43%` vs `359 51% 49%`; admin `--muted-foreground` dark lighter (78% vs 65%). |
| Aurora wrapper | `.lf-aurora` (keyed on `.light`, `--au-cool` tokens, row 44px) | `.adm-aurora` (keyed on `html:not(.dark)`, Phase-3 `--au-accent/--au-surface`, row 48px, halved glass alphas) | Two **non-interchangeable** wrappers. |
| Default-theme asymmetry | CSS defaults dark (`:root,.dark`) | aurora defaults light (`html:not(.dark)`) | All three apps default *preference* to dark. |

### 1.2 Aliases that lie (the rebrand was a re-point, not a rename)

- `bg-orange-500` / `--brand-orange` / `tone-orange-*` → **Gold `#CBA45E`**, not orange (`globals.css:42`).
- `--au-violet`, `roseScale`, `foilScale`, `brand.orange` → **Gold / Sapphire**.
- `emerald/sky/cyan/amber` tone aliases → re-pointed to semantic colors.
- **Mobile `rose` is ambiguous:** `tokens.ts brandColors.rose = #CBA45E` (Gold) but `apps/mobile/tailwind.config.ts rose.DEFAULT = #E25C5C` (coral). `bg-rose` class = coral; TS token = Gold.
- `--primary` **hue flips between modes** (gold in dark, blue in light); apps are dark-first.
- **Plan-tier theming dormant:** `plan-pro/plan-family/plan-free` classes all map to the same Sapphire `--primary` (web). Mobile `applyPlanPalette` is a retired pass-through, so `settings/subscription` plan accents are effectively disabled.

### 1.3 Hardcoded values outside the var system (edits to CSS vars will NOT reach these)

| Where | Hardcoded |
|---|---|
| Web `badge.tsx` | `#0A0F18` |
| Web premium reveal modal | `#131C2C` / `#0E1521` / `#ECF1F8` |
| Web | impersonation-banner, app-store-cta, premium-sticker, install-prompt, RaccoonMark, language-selector, health-pill, tier-stamp, tier-bar |
| Web `LoadingSpinner` | hardcodes `text-tone-orange-fg` |
| Admin | tier-medallion (SVG hex), chart/SVG primitive coords + gradient stops |
| Mobile | **entire NativeWind palette**; pervasive `rgba()`/hex across Button, Input, Badge and ~15 home/brand cards; brand coral `#E25C5C` hardcoded as `rgba(226,92,92,*)` instead of `theme.colors.error` |
| Mobile `CATEGORY_COLORS` | hex map (`#E25C5C/#CBA45E/#54CB7E/#F0A0B8/#B0852F/#6E7C92`) **duplicated in 3 files** (`(tabs)/services.tsx` 84-86, `services/[id].tsx` 56-58, `services/[id]/edit.tsx` 45-54) — ~32 of all hex hits |
| Mobile `#fff`/`#000` on filled accents/checkmarks | `services.tsx` 953-954, `moving/[id].tsx` 947/1351/1658, `onboarding.tsx` 1609/2312/2366 (should be `colors.onAccent`) |
| Mobile pre-splash bg | `#0A0F18` hardcoded `app/_layout.tsx:525` (won't follow token changes) |
| Web/admin/mobile inline-style leaks | web `(app)` pages use raw `hsl(var(--border))`, `var(--sage)`, `linear-gradient(...)`, `bg-[linear-gradient(135deg,...)]` — token-derived but bypass utility classes |

**Brand-mandated, do NOT retheme:** Google "G" 4-color SVG + Google/Apple SSO buttons (web `sign-in`/`sign-up`); mobile OAuth `#fff`/`#000`/`#14202F` (`(auth)/sign-up.tsx` 486-499, `sign-in.tsx`).

### 1.4 Duplicated primitives (re-themed N times today)

Triplicated per platform: **Button, Input, Card, Badge, Skeleton, EmptyState, ThemeToggle, CategoryIcon, ServiceLogoMark, Logo, Raccoon mascot, dashboard viz.** Each must be re-themed once per app.

- **Admin has NO Button component** — button class strings (`bg-destructive`/`bg-primary`…) are copy-pasted across `confirm-dialog`, `password-confirm-modal`, etc.
- **Three web modal stacks:** web `ui/dialog.tsx` (hand-rolled focus trap, not Radix) vs web `shared/confirm-dialog` vs admin `confirm-dialog`/`password-confirm-modal` (self-contained markup).
- **Mobile** has the richest Button (loading + locked + gradient + shimmer); web Button has no `loading` prop.

### 1.5 Missing shared primitives (system-wide gaps)

No **Table** (admin `DataTablePage` is a page shell, not a Table), no **Tabs**, no generic **DropdownMenu**, no standalone **Spinner**, no shared **Tooltip** (only admin `InfoHint`), no shared **Toast** (admin=sonner, mobile=`SuccessToast`, web=inline), no web/admin **ErrorState** (mobile has one). Web `Input/Textarea/Select` lack the `error/label/hint` props mobile `Input` has — web error styling is **caller-managed**. `StatusBadge` (WCAG-safe, color-not-alone) exists **only on web**.

### 1.6 Theme / contrast / live-switch gaps

- **Mobile static-theme bug:** components importing the static `theme` export render the **dark palette permanently until reload**; only `useAppTheme`/`useThemedStyles` consumers live-switch.
- **No automated contrast/a11y test located** despite comments claiming light semantic hues were darkened "for AA contrast" `[needs verification]`.
- Letter-spacing scale in `tokens.ts` (`tightest -0.035em`, `tight -0.02em`) is **overridden to 0** in web `globals.css` — TS tracking scale is dead on web.
- `font-variation-settings` opsz/SOFT axes are inert under Playfair; `LogoMark.animated` prop accepted but unused (dead prop).

### 1.7 Brand / layout fragmentation

- **Raccoon mascot** is the identity (inline SVG, near-identical across apps). **Only divergence:** eye color — admin Sapphire `#2E5FB0` vs web/mobile Gold `#CBA45E`.
- **OG dynamic route renders a leftover "M" glyph** (legacy "Move") instead of the raccoon/LocateFlow — `opengraph-image.tsx:46`.
- **Four divergent wordmark treatments** (marketing Playfair-900 "LocateFlow"; app sidebar "Locate"+italic-foil "flow"; footer font-display-bold; admin + mono "OPERATIONS" kicker). No shared wordmark component. Mobile has **no text wordmark** (PNG raccoon icon only).
- **Two font systems shipped simultaneously** (legacy Geist/Fraunces + canonical Playfair/DM Sans/DM Mono) on every web+mobile boot.
- **Three+ unshared nav idioms** (web sidebar+tabbar, admin rail+dock, mobile tabbar, marketing hardcoded-English list). **Movers/Partners portals have no shared shell** (bare per-page `<header>`). Web app nav active = Gold (tone-orange); admin nav active = Sapphire (primary).
- Dead/leftover assets: `--au-rose #F0A0B8` unused; landing-theme-toggle glow `rgba(127,182,232,0.5)` non-token blue; `--au-violet` holds Gold.

### 1.8 Scattered semantic color + copy

Semantic color lives in JS maps (`categoryColors`, `statTone`, `statusBadge`, `MODE_BADGE`, `statusClasses`, `presentationFor`) rather than a central token doc. **Two card idioms** coexist on web (glass `bg-foreground/5 backdrop-blur-xl` vs shadcn `Card`). **i18n fragmentation:** next-intl vs inline `{en,es}` vs hardcoded English; some failure toasts hardcoded English even on translated pages (notifications, support). Mobile `theme.ts` carries a large back-compat alias set (`bg2`, `surface2/3`, `dim`, `faint`, `onAccent`, `green/red/teal`, `heroGrad`, `raccoon{}`) signalling an unfinished migration to collapse.

---

## 2. Target unified design-system shape

> Goal: **one token source feeds web + admin + mobile**; a thin shared primitive layer; a single light/dark contract. Reskinning becomes "edit tokens once, build, ship."

### 2.1 Single token source → codegen

```
packages/shared/src/design-tokens.ts        (authored SoT — extend, do not fork)
        │  build step (codegen)
        ├─► tokens.web.css        → @layer base :root/.dark CSS vars (replaces hand-synced web globals + aurora var blocks)
        ├─► tokens.admin.css      → same vars, admin surface overrides expressed AS tokens (graphite vs navy = a documented theme variant, not drift)
        └─► tokens.mobile.ts      → JS palette objects consumed by theme.ts (replaces hardcoded NativeWind hex; NativeWind palette generated, not hand-written)
```

- **One canonical value per concept.** Where web (navy `#070B14`) and admin (graphite `#171E2B`) legitimately differ, model it as **named theme variants of the same token graph** (`surface.canvas` resolved per brand variant), not as four files that happen to disagree.
- **Kill the alias lies:** either rename `orange/rose/foil/violet` → `gold/sapphire/...` via codemod, or freeze them as explicit, documented back-compat aliases in one place. No new code may use the misleading names.
- **Tokenize the escaped hex:** badge `#0A0F18`, reveal modal, tier-medallion, mobile CATEGORY_COLORS, pre-splash bg, `theme-color` meta — every value in §1.3 (except brand-mandated OAuth marks) must resolve from a token.

### 2.2 Light/dark contract (single, explicit)

- Every semantic token has a **light value and a dark value**, authored once. No mode-only tokens; no "dark until reload."
- **One default-theme decision** documented and consistent across CSS keying (web `.light` vs admin `html:not(.dark)` unified).
- `theme-color` meta **switches per resolved mode** on all web surfaces.
- AA contrast is a **build-checked contract**, not a comment (see §5).

### 2.3 Shared primitive layer

- **Cross-platform primitive contract** (props parity): `Button` (with `loading`, `disabled`, locked, variants), `Input/Textarea/Select` (with `label/error/hint` everywhere — close the web gap), `Card`, `Badge` + `StatusBadge` (WCAG color-not-alone everywhere), `Skeleton`, `EmptyState`, `ErrorState`, `ThemeToggle`, `Logo`/`Wordmark`, raccoon mascot.
- **Build the missing primitives once:** `Table`, `Tabs`, `DropdownMenu`, `Spinner`, `Tooltip`, `Toast`. Pick **one** modal foundation (recommend Radix Dialog) and retire the three hand-rolled stacks.
- **Admin gets a real `Button`**; delete the copy-pasted class strings.
- One **shared wordmark/Logo component** with variants for the four current treatments; single mascot SVG with **eye color as a token** (resolves Gold/Sapphire per app variant).

---

## 3. Migration approach (lowest-risk first)

### Phase 0 — Freeze & baseline (no visual change)
1. Snapshot current rendered output of every surface (see §5). Land the existing admin `aurora-theme-regression.test.ts` pattern across web + mobile.
2. Add a contrast test harness (none exists today, §1.6).
3. Inventory lock: files 10–13 are the per-surface checklist.

### Phase 1 — Token codegen (the keystone; still no visual change)
4. Extend `design-tokens.ts` to cover **every** concept currently in the 4 CSS copies + mobile NativeWind (surfaces, tones, destructive, radius, tracking, family-tier hue).
5. Build codegen → `tokens.web.css` / `tokens.admin.css` / `tokens.mobile.ts`. **Reproduce current values exactly first** (drift preserved as named variants) so snapshots stay green. Drift is now *visible and intentional*, edited in one place.
6. Replace hand-synced var blocks; delete the "sync manually" docstring contract.
7. Codemod or freeze the lying aliases (§2.1).

### Phase 2 — Primitive consolidation (low visual risk, big leverage)
8. Build/adopt shared primitives (§2.3). Add `loading` to web Button; add `error/label/hint` to web Input/Textarea/Select; create admin Button; unify modal foundation; ship `StatusBadge`/`ErrorState` to admin+mobile.
9. Tokenize escaped hex (§1.3); extract mobile `CATEGORY_COLORS` to shared tokens (kills ~32 hex hits across 3 files); replace `#fff`/`#000` on-accent with `colors.onAccent`.
10. Fix the mobile static-`theme` live-switch bug (route all consumers through `useAppTheme`/`useThemedStyles`).

### Phase 3 — Per-surface reskin rollout (lowest-risk → highest-risk)
| Order | Surface | Why this order |
|---|---|---|
| 1 | **Web legal/info pages** (`10`) | Data-driven via `LEGAL_*_DOCUMENT` + 2 shell components; reskinning `PublicPageShell`/`PublicSection` reskins ~15 pages at once. Token-only, low logic. |
| 2 | **Web marketing/home/pricing/blog** (`10`) | `MarketingHeader`/`MarketingFooter` shared; token-only; recurring CTA card is a single target. |
| 3 | **Web auth pages** (`10`) | Centered-card + split-brand patterns; preserve OAuth brand marks. |
| 4 | **Admin** (`12`) | Uniform `.adm-aurora` token-driven shell; near-zero page hardcoded color; RSC-wrapper pattern isolates UI in `*-client.tsx`. Reskin the reusable shells (`AdminPageHeader`/`AdminPanel`/`DataTablePage`) → most pages follow. |
| 5 | **Web authenticated app** (`11`) | Higher logic density, two card idioms to reconcile, i18n fragmentation; reskin `AppShell` + the two card idioms first. |
| 6 | **Mobile** (`13`) | Highest risk: hardcoded palette, static-theme bug, runtime theming, CATEGORY_COLORS dup, OAuth marks. Do last, after Phase-1/2 land the token + primitive fixes it depends on. |

### Phase 4 — Brand cleanup
11. Fix OG "M" glyph (`opengraph-image.tsx:46`). 12. Remove legacy Geist/Fraunces fonts from web + mobile boot. 13. Ship single Logo/Wordmark component; unify mascot eye color via token. 14. Remove dead assets (`--au-rose`, non-token toggle glow, dead `animated` prop).

---

## 4. Per-app renewal checklist

### Web (consumer + marketing)
- [ ] Replace `globals.css` + `aurora.css` var blocks with codegen output; reconcile `.light` keying with admin.
- [ ] Tokenize: badge `#0A0F18`, reveal modal hex, LoadingSpinner `text-tone-orange-fg`, install-prompt, impersonation-banner, language-selector.
- [ ] `theme-color` meta switches per mode (currently `#0A0F18`, never switches).
- [ ] Add Button `loading`; add Input/Textarea/Select `error/label/hint`.
- [ ] Pick one modal foundation; retire `ui/dialog.tsx` hand-rolled trap.
- [ ] Reconcile the two card idioms (glass vs shadcn `Card`).
- [ ] Reconcile i18n (next-intl vs `{en,es}` vs hardcoded English); fix hardcoded-English failure toasts.
- [ ] Fix OG "M" glyph; remove Geist/Fraunces; restore or delete dead tracking scale.
- [ ] Give Movers/Partners portals a shared shell.

### Admin
- [ ] Codegen `tokens.admin.css`; model graphite canvas + 8px radius + tone alphas + teal family-tier as **named variants**, not drift.
- [ ] Create a real admin `Button`; delete copy-pasted button class strings.
- [ ] Ship `StatusBadge` + `ErrorState` to admin.
- [ ] Tokenize tier-medallion SVG hex + chart gradient stops where feasible.
- [ ] Reconcile destructive/muted-foreground hues with web.
- [ ] Keep MFA/step-up flows + `DataTablePage` behavior intact through reskin.

### Mobile
- [ ] Generate NativeWind palette + `theme.ts` from codegen; make it **theme-switch** (currently dark-only).
- [ ] Fix static-`theme` live-switch bug (all consumers → `useAppTheme`/`useThemedStyles`).
- [ ] Extract `CATEGORY_COLORS` to shared tokens (de-dup 3 files).
- [ ] Replace `#fff`/`#000` on-accent with `colors.onAccent`; tokenize pre-splash `#0A0F18`.
- [ ] Resolve `rose` ambiguity (coral vs Gold) in tailwind.config vs tokens.
- [ ] Collapse back-compat alias set; remove `applyPlanPalette` dead path or re-wire plan accents.
- [ ] **Preserve** OAuth brand marks + raccoon mascot palette.
- [ ] Remove legacy Fraunces/Geist from `_layout.tsx`.

### Shared (`packages/shared`)
- [ ] `design-tokens.ts` becomes the only authored source; add codegen build step.
- [ ] Build missing primitives: Table, Tabs, DropdownMenu, Spinner, Tooltip, Toast.
- [ ] One Logo/Wordmark component (4 variants); one mascot SVG (eye color tokenized).
- [ ] Document the light/dark contract + named brand variants.

---

## 5. Risks & regression safety

| Risk | Mitigation |
|---|---|
| **Hidden hex doesn't follow token edits** (§1.3) | Phase-1 codegen reproduces current values exactly; lint rule banning raw hex / `rgba()` in app code (allowlist OAuth marks + mascot SVG). |
| **Mobile dark-until-reload** regressions on theme flip | Fix static-`theme` consumers (§3 step 10) *before* mobile reskin; snapshot both light + dark per screen. |
| **Drift re-introduced** after consolidation | Single SoT + codegen; keep/extend `aurora-theme-regression.test.ts` to web + mobile; CI fails if generated CSS ≠ committed. |
| **Contrast regressions** (no test exists today, §1.6) | Add automated WCAG AA contrast checks on token pairs (fg/bg per mode) as a build gate; verify the "darkened for AA" claim `[needs verification]`. |
| **Visual regressions across 190 surfaces** | Snapshot/visual-diff tests per surface in **both** modes, using files 10–13 as the surface list; gate the per-surface rollout (Phase 3) on green snapshots. |
| **Breaking brand-mandated marks** | Explicit do-not-retheme allowlist (Google "G" 4-color, Google/Apple SSO buttons web + mobile `#14202F`); covered by snapshots. |
| **Alias codemod breaks call sites** | Do the rename in Phase 1 with a codemod + freeze; keep a single documented alias shim until call sites migrate. |
| **i18n reconciliation changes copy unexpectedly** | Treat copy reconciliation as a separate, reviewed pass; do not bundle into the visual reskin commit. |

---

## 6. Known audit findings → where they live here

| Audit finding | Covered in |
|---|---|
| `component-theme-system-01..10` (token drift, triplicated/missing primitives, admin-no-Button, modal stacks, web Input gaps) | §1.1, §1.4, §1.5; `01`, `02` |
| `ui-ux-*` (card idioms, i18n fragmentation, scattered semantic maps, inline-style leaks, nav idioms) | §1.7, §1.8; `11`, `03` |
| Marketing OG glyph ("M" instead of raccoon) | §1.7, §3 Phase-4; `03`, `10` (`opengraph-image.tsx:46`) |
| Mobile CATEGORY_COLORS triplication / on-accent hex | §1.3, §4 Mobile; `13` |
| Mobile static-theme live-switch + `applyPlanPalette` retired | §1.6, §1.8; `13` |
| Two font systems / dead props / dead tracking scale | §1.6, §1.7; `03`, `01` |

> All file-path citations and per-surface detail live in `01`–`03` and `10`–`13`. This playbook is the index into the work, not a substitute for those rows.
