# 12 · Admin Pages — Theme-Renewal Inventory

Surface: `apps/admin` (Next.js 16 App Router). Authoritative list: `docs/audit/_inventory/admin-pages.txt` (62 entries, all covered below).

This is an inventory of **what exists today** for a theme/UI renewal. No new visuals proposed.

---

## 0. Shared theme + shell facts (read this first — applies to every row)

| Concern | Fact | File |
|---|---|---|
| **Theme name** | "Aurora" — Edition VIII LocateFlow Gold/Sapphire. Dark = graphite navy + **Gold `#CBA45E`** accent; Light = slate-enterprise paper `#F4F6F9` + **Sapphire `#2E5FB0`** accent. Honey/amber demoted to WARN only. | `apps/admin/src/app/aurora.css`, `globals.css` |
| **Token system** | Two layers: (1) shadcn HSL tokens (`--background`, `--card`, `--primary`, `--border`, `--ring`, `--radius` …) re-declared inside `.adm-aurora` for light+dark; (2) `--au-*` Aurora palette (`--au-accent`, `--au-ink`, `--au-surface`, `--au-mint/amber/coral`, `--au-shadow-card` …). Legacy `--rose/--foil-*/--brand-orange/--tone-*-bg/br/fg` are **redirected** to `--au-*` so old utility classes inherit Aurora colors with no source edits. | `aurora.css` lines 12-637 |
| **Theme switching** | `next-themes`, `attribute="class"`, `defaultTheme="dark"`, `enableSystem`, light/dark/system, storageKey `locateflow-admin-theme`. Theme follows `.dark` / `html:not(.dark)` on `<html>`. | `components/theme-provider.tsx`, `theme-toggle.tsx` |
| **Light + dark parity** | Built-in for **every** token; light variants explicitly authored in both `globals.css` (`.light` + `@layer base :root`) and `aurora.css` (`html:not(.dark) .adm-aurora`). Aurora drift animation + topbar blur are intentionally killed in light (corporate "printed document" look). | `aurora.css` 247-254 |
| **Fonts** | DM Sans (`--font-sans`, body/headings), Playfair Display (`--font-display`, display/`.h1`/`<em>` foil), DM Mono (`--font-mono`, numerals/eyebrows/labels). Loaded via `next/font/google`. | `app/layout.tsx` 15-38 |
| **Brand/logo** | `/logo-mark.svg` ("raccoon" mark) in sidebar rail + panel header; wordmark "**LocateFlow**" (Playfair black) + mono eyebrow "**Operations**"; foil-gradient `<em>` in page titles; manifest/icon `/icon.svg`, theme-color `#171E2B`. | `components/sidebar.tsx` 46-51, 322-337; `layout.tsx` 57-68 |
| **App shell** | `(admin)/layout.tsx` wraps all `(admin)/**` in `.adm-aurora`: `<AuroraBackground>` (fixed animated blobs + grain, honors `prefers-reduced-motion` + `data-mode="lite"`), `<Sidebar>` (250px / 76px rail, `lg:pl-64`), `<Topbar>` (`.adp-topbar` sticky, breadcrumb + ⌘K + bell/help/avatar), `<SubNav>` (section tabs), `<CommandPalette>` (⌘K), skip-link. Content centered at `max-w-1680px` on `.admin-workspace` (blueprint-grid gradient bg). | `app/(admin)/layout.tsx` |
| **Hardcoded colors** | **Near-zero in pages.** 0 hex in any `*-client.tsx`; 0 hex in `(admin)/**/page.tsx` except dashboard's `#8A94A6` (Free-plan dot). Hex that exists lives in CSS token defs (correct) and chart/SVG primitives (sparkline, donut, ring, tier-medallion, revenue/signups-trend — coords + gradient stops). Dynamic `style={{}}` widths/colors pull from CSS vars. | (grep verified) |
| **Responsive** | Mobile-first guards baked into shell: `overflow-x: clip` floor, sidebar→mobile dock + section sheet below `lg`, topbar collapses search→icon at `≤1023px`, `DataTablePage` wraps wide tables in own `overflow-x-auto` scroller (`min-w-[640px]`). Pages add `sm:/md:/lg:/xl:` grid breakpoints. | `aurora.css` 999-1058; `data-table-page.tsx` |
| **Reusable shells** | `<AdminPageHeader>` (eyebrow + foil `<em>` title + subtitle + actions, glass bar), `<AdminPanel>` (`.admin-panel` card, `flagship`/`dense` variants), `<DataTablePage>` (full list shell: search/sort/filter/paginate/column-settings/saved-views/bulk-select/empty/loading), `<EmptyState>`, `<QuickDrawer>`, `<PasswordConfirmModal>` (step-up), `<MinistatStrip>`, premium `<TierStamp>/<HealthPill>/<TierMedallion>`, aurora `<AuroraStatCard>/<Sparkline>/<PlanDonut>/<Ring>/<AuditFeed>/<RevenueTrend>`. | `components/**` |
| **States (shell-level)** | `DataTablePage` provides loading (spinner row), empty (`EmptyState`), error (sonner toast) uniformly. Pages NOT using it hand-roll states in their `*-client.tsx`. | — |

**Architecture pattern (drives every row below):** Most `(admin)/**/page.tsx` are **thin RSC wrappers** that run `requirePagePermission(...)` (auth/RBAC gate) and render a `*-client.tsx` (the actual UI + data fetching + states). A minority render UI inline (server-rendered dashboards/lists). "Theme handling" is **uniform = token-driven via `.adm-aurora`** for every `(admin)` surface unless noted; the columns below flag deviations and per-page section/state specifics.

Legend: Tok = uses Aurora/shadcn tokens (no hardcoded color) · L+D = light & dark both work · `[nv-rt]` = needs verification at runtime.

---

## 1. Auth surfaces (outside `(admin)` shell — own centered-card layout)

| Route | File | Layout/shell | Key sections/blocks | Components | Theme (tokens / hardcoded / L+D) | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `/login` | `app/login/page.tsx` | Standalone: `.adm-aurora` + `<AuroraBackground>`, centered glass card `max-w-md` (NOT the sidebar shell) | ShieldCheck badge, eyebrow "Admin command", email+password form, **MFA step** (6-digit code / backup-code toggle, "trust device 30d" checkbox), submit | inline; `<AuroraBackground>`; sonner | Tok ✓ / none / L+D ✓ | single column, fits all widths | ShieldCheck icon + "Admin command" eyebrow (no logo mark) | loading (button), error (toast), MFA conditional | Preserve MFA/backup-code flow + aurora bg; no raccoon mark here — consider brand consistency |
| `/set-password` | `app/set-password/page.tsx` → `set-password-client.tsx` | Standalone aurora centered card | Token-validating state, password + confirm fields, **live password-rule checklist** (≥12, upper/lower/number), success state | inline; `<AuroraBackground>`; sonner | Tok ✓ / none / L+D ✓ | single column | KeyRound/ShieldCheck icons | validating / valid / invalid token + submitting + done | Token-gated public page; keep rule checklist UX |
| `/set-password/change` | `set-password/change/page.tsx` → `force-password-change-client.tsx` | Standalone aurora card | Forced password-change form (logged-in but must rotate) | inline client | Tok ✓ / none / L+D ✓ `[nv-rt]` | single column | per set-password | submitting/error `[nv-rt]` | Mirror of set-password; keep parity |

---

## 2. Dashboard + analytics

| Route | File | Layout/shell | Key sections/blocks | Components | Theme | Responsive | Brand/logo | States | Renewal notes |
|---|---|---|---|---|---|---|---|---|---|
| `/` (dashboard) | `app/(admin)/page.tsx` | Admin shell; RSC, `force-dynamic` | `AdminPageHeader` (foil "Today's snapshot" + New-this-week/Active-sessions pills), **6 KPI tiles** (`AuroraStatCard` w/ count-up + sparkline), Live-ops 3-card rail, **OverviewTrends** 2-tab chart (Revenue/Signups), HealthCard, **Plan distribution** (`PlanDonut` + `tier-bar` + `TierMedallion`s, flagship panel), Recent-users + Upcoming-moves 2-col, External-integrations grid, **AuditFeed** | `AdminPageHeader`, `AdminPanel`, `AuroraStatCard`, `OverviewTrendsCard`, `PlanDonut`, `TierMedallion`, `AuditFeed`, `HealthCard` | Tok ✓ (lone `#8A94A6` Free dot; plan badges via inline `color+"1f"` alpha) / L+D ✓ | `grid sm:2 lg:3 xl:6`, 2-col `lg:` panels | foil `<em>` title; "Overview" eyebrow | loading=RSC (no spinner), empty per-panel ("No users yet" / "No paying users"), gated feeds hidden | Densest page; RBAC-gated sub-panels (audit/integrations). Keep count-up + reflex hover; the `color+"1f"`/`+"47"` hex-concat badge is the one non-token spot to fix |
| `/analytics` | `analytics/page.tsx` | Admin shell; uses `AdminPageHeader`/`AdminPanel` | Analytics dashboard (sessions/usage) `[nv-rt]` | `AdminPageHeader`, `AdminPanel`, aurora charts `[nv-rt]` | Tok ✓ / L+D ✓ `[nv-rt]` | grid `[nv-rt]` | eyebrow/foil title | RSC/empty `[nv-rt]` | Verify chart color sourcing |
| `/analytics/intelligence` | `analytics/intelligence/page.tsx` → `activity-intelligence-client.tsx` | Admin shell; client | Activity-intelligence widgets/charts `[nv-rt]` | client + aurora charts | Tok ✓ `[nv-rt]` / L+D ✓ `[nv-rt]` | `[nv-rt]` | header | loading/empty/error in client `[nv-rt]` | Verify runtime states |
| `/insights` | `insights/page.tsx` → `insights-client.tsx` | Admin shell; client | Insights cards/charts `[nv-rt]` | client + aurora charts | Tok ✓ `[nv-rt]` / L+D ✓ | `[nv-rt]` | header | loading/empty/error `[nv-rt]` | — |
| `/reports` | `reports/page.tsx` | Admin shell; `AdminPageHeader`/`AdminPanel` | Report list / export builder `[nv-rt]` | `AdminPanel` | Tok ✓ / L+D ✓ | `[nv-rt]` | header | `[nv-rt]` | — |

---

## 3. List/table pages (`DataTablePage` shell — uniform chrome + states)

These get search/sort/filter/paginate/column-settings/saved-views/bulk-select/loading/empty **for free** from `DataTablePage`. Theme = Tok ✓ / L+D ✓ uniformly (shell uses `bg-background`, `border-border`, `bg-primary/10`, `tone-*` tokens). Responsive = table wrapped in own scroller (`min-w-[640px]`), header `xl:flex-row`, filter grid `sm:2 md:4 lg:6`. States = loading spinner row + `EmptyState` + toast errors, all from shell.

| Route | File | Confirmed shell | Key sections beyond table | Notable components | Brand | Renewal notes |
|---|---|---|---|---|---|---|
| `/users` | `users/page.tsx` | `DataTablePage` ✓ | KPI `MinistatStrip`, health column, `QuickDrawer` detail, `PasswordConfirmModal` step-up, bulk delete/export | `TierStamp`, `HealthPill`, `MinistatStrip`, `QuickDrawer` | header foil title | `PLAN_COLORS` map uses `tone-*` token classes (good). Keep health column (support's #1) |
| `/providers` | `providers/page.tsx` | uses `DataTablePage`/header `[confirm]` | provider list + filters | data-table | header | — |
| `/waitlist` | `waitlist/page.tsx` | header/table `[nv-rt]` | waitlist entries | data-table | header | — |
| `/state-rules` | `state-rules/page.tsx` | header/table | per-state rule rows | data-table | header | — |
| `/support` | `support/page.tsx` | header/table | support ticket list | data-table | header | pairs with `/support/[id]` detail |
| `/help-center` | `help-center/page.tsx` | header/table | help articles list | data-table | header | — |
| `/blog` | `blog/page.tsx` | header/table | post list | data-table | header | editor pages separate (§7) |
| `/moving` | `moving/page.tsx` | header/table | moving-plan list | data-table | header | detail at `/moving/[id]` |
| `/affiliate` | `affiliate/page.tsx` (+ `affiliate-conversions-client.tsx`) | header + client table | conversions table | client | header | — |
| `/leads` | `leads/page.tsx` | header/table `[nv-rt]` | lead list | data-table `[nv-rt]` | header | Verify shell |
| `/logs` | `logs/page.tsx` → `logs-client.tsx` | `DataTablePage` ✓ (confirmed) | audit-log table, masked actors | `DataTablePage` | header | only client besides users using shell directly |
| `/logs/activity` | `logs/activity/page.tsx` → `admin-activity-client.tsx` | client table | admin activity feed | client | header | — |

---

## 4. Operational client-component pages (custom UI in `*-client.tsx`)

Thin RSC wrapper (`requirePagePermission`) → client component owns layout + data fetch + states. Theme = Tok ✓ / L+D ✓ (no hex in any client file). States hand-rolled in client (verify exact loading/empty/error `[nv-rt]`).

| Route | File (client) | Key sections/blocks | Notable components | States | Renewal notes |
|---|---|---|---|---|---|
| `/subscriptions` | `subscriptions/subscriptions-client.tsx` | KPI tiles, subs table, tier breakdown | aurora KPI, `TierStamp`, `tier-bar` | loading/empty/error in client | Revenue-heavy; keep tier ramp |
| `/billing` | `billing/billing-client.tsx` | billing overview / invoices `[nv-rt]` | aurora cards | `[nv-rt]` | — |
| `/connectors` | `connectors/connectors-client.tsx` | connector grid + status pills | `au-pill` status | `[nv-rt]` | — |
| `/connectors/[connectorKey]` | `connectors/[connectorKey]/connector-detail-client.tsx` | connector detail, config, metrics | cards, charts | loading/empty/error `[nv-rt]` | dynamic route |
| `/connector-fallbacks` | `connector-fallbacks/connector-fallbacks-client.tsx` | fallback chains table/editor | tables | `[nv-rt]` | — |
| `/connector-metrics` | `connector-metrics/connector-metrics-client.tsx` | metrics charts/tables | aurora charts | `[nv-rt]` | verify chart colors |
| `/runtime-config` | `runtime-config/runtime-config-client.tsx` | config key/value editor, forms | form controls | save/loading/error `[nv-rt]` | step-up likely |
| `/feature-flags` | `feature-flags/feature-flags-client.tsx` | flag toggle list/cards | toggles, pills | `[nv-rt]` | — |
| `/provider-quality` | `provider-quality/provider-quality-client.tsx` | quality scores, charts | charts, pills | `[nv-rt]` | — |
| `/provider-governance` | `provider-governance/page.tsx` (uses header/panel) | governance rules/queue | `AdminPanel` | `[nv-rt]` | — |
| `/providers/coverage` | `providers/coverage/page.tsx` | coverage map/editor | `CoverageEditor` `[nv-rt]` | `[nv-rt]` | map component — verify color sourcing |
| `/providers/needs-logo` | `providers/needs-logo/page.tsx` | providers missing logos list | list/cards | empty likely | logo-upload workflow |
| `/movers` | `movers/movers-client.tsx` | movers list/table | client table | `[nv-rt]` | — |
| `/movers/applications` | `movers/applications/mover-applications-client.tsx` | applications review queue | cards, approve/reject | loading/empty `[nv-rt]` | — |
| `/moving/at-risk` | `moving/at-risk/at-risk-board-client.tsx` | **board/kanban** of at-risk moves | board columns/cards | loading/empty `[nv-rt]` | non-table layout — verify responsive cols |
| `/partners` | `partners/partner-applications-client.tsx` | partner application queue | cards | `[nv-rt]` | — |
| `/sponsored` | `sponsored/sponsored-client.tsx` | sponsored-placement manager | cards/forms | `[nv-rt]` | — |
| `/acquisition-campaigns` | `acquisition-campaigns/acquisition-campaigns-client.tsx` | campaign list/editor | tables/forms | `[nv-rt]` | — |
| `/notifications` | `notifications/notifications-client.tsx` | notification composer/list | forms, list | send/loading/error `[nv-rt]` | — |
| `/waitlist` (client part) | — | (see §3) | — | — | — |

---

## 5. Security, settings, team, backups

| Route | File | Layout | Key sections/blocks | Components | Theme | States | Renewal notes |
|---|---|---|---|---|---|---|---|
| `/security` | `security/security-client.tsx` | shell; client | security overview/list | cards, pills | Tok ✓ / L+D ✓ | `[nv-rt]` | — |
| `/security/dashboard` | `security/dashboard/security-dashboard-client.tsx` | shell; client | security KPIs, alerts, charts (17 loading/empty/error refs found — rich states) | aurora cards/charts | Tok ✓ / L+D ✓ | **loading + empty + error all present** ✓ | Strong state coverage; preserve |
| `/settings` | `settings/settings-client.tsx` | shell; client | settings form sections (integrations, config), `ThemeToggle`/system pref | form controls, `ThemeToggle` | Tok ✓ / L+D ✓ | save/loading/error `[nv-rt]` | **System-theme opt-in lives here**, not quick toggle |
| `/settings/health` | `settings/health/page.tsx` | shell; header/panel | system-health widgets | `AdminPanel`, `EmailHealthWidget` `[nv-rt]` | Tok ✓ / L+D ✓ | `[nv-rt]` | — |
| `/settings/two-factor` | `settings/two-factor/page.tsx` | shell; header/panel | 2FA enroll (QR, backup codes) | `AdminPanel`, inline | Tok ✓ / L+D ✓ | enroll/verify states `[nv-rt]` | QR/backup-code UX — verify contrast |
| `/team` | `team/team-client.tsx` | shell; client | admin team roster, role chips, invite | cards/table, role badges | Tok ✓ / L+D ✓ | `[nv-rt]` | role hierarchy colors |
| `/backups` | `backups/backups-client.tsx` | shell; client | backup control plane, snapshot list | `BackupControlPlane` | Tok ✓ / L+D ✓ | loading/empty/error `[nv-rt]` | — |

---

## 6. Catalog / plans

| Route | File | Layout | Key sections/blocks | Components | Theme | States | Renewal notes |
|---|---|---|---|---|---|---|---|
| `/plans` | `plans/page.tsx` | shell; RSC, `force-dynamic` | `AdminPageHeader`, **4 plan cards** (`.au-plancard`, Free/Individual/Family-featured/Pro) w/ feature checks + live adoption, MRR-by-plan bars (`.au-planbar`) | `AdminPageHeader`, `AdminPanel`, `.au-plancard*` CSS | Tok ✓ (per-card `--plan-accent` from `--au-*`, no raw hex in markup) / L+D ✓ | read-only, empty per-tier | Pure token-driven cards; `color-mix` tints re-resolve on theme switch. Model for clean theming |

---

## 7. Detail / editor / form pages (dynamic routes)

| Route | File | Layout | Key sections/blocks | Components | Theme | States | Renewal notes |
|---|---|---|---|---|---|---|---|
| `/users/[id]` | `users/[id]/user-detail-client.tsx` | shell; client | user profile, subscription, addresses/services, health, audit, step-up actions | `QuickDrawer`?, `HealthPill`, `TierStamp`, `PasswordConfirmModal` | Tok ✓ / L+D ✓ | loading/empty/error `[nv-rt]` | Dense detail; keep masked PII |
| `/providers/[id]` | `providers/[id]/page.tsx` | shell; RSC/header | provider detail panels | `AdminPanel` | Tok ✓ / L+D ✓ | `[nv-rt]` | — |
| `/providers/[id]/edit` | `providers/[id]/edit/page.tsx` | shell; header + form | provider edit form | form controls | Tok ✓ / L+D ✓ | save/error `[nv-rt]` | — |
| `/providers/new` | `providers/new/page.tsx` | shell; header + form | new-provider form | form controls | Tok ✓ / L+D ✓ | submit/error `[nv-rt]` | linked from dashboard Live-ops |
| `/moving/[id]` | `moving/[id]/moving-plan-detail-client.tsx` | shell; client | moving-plan detail, timeline, addresses | cards, `MapPin` | Tok ✓ / L+D ✓ | loading/empty/error `[nv-rt]` | — |
| `/workspaces` | `workspaces/workspaces-client.tsx` | shell; client | workspace list/table | client table | Tok ✓ / L+D ✓ | `[nv-rt]` | — |
| `/workspaces/[id]` | `workspaces/[id]/workspace-detail-client.tsx` | shell; client | workspace detail, members | cards | Tok ✓ / L+D ✓ | `[nv-rt]` | — |
| `/support/[id]` | `support/[id]/support-detail-client.tsx` | shell; client | ticket thread, reply composer | message list, form | Tok ✓ / L+D ✓ | loading/sending/error `[nv-rt]` | — |
| `/tickets` | `tickets/page.tsx` | shell; header/table `[nv-rt]` | ticket list | data-table `[nv-rt]` | Tok ✓ / L+D ✓ | `[nv-rt]` | overlaps `/support`? verify |
| `/tickets/[id]` | `tickets/[id]/page.tsx` | shell; client/detail `[nv-rt]` | ticket detail/thread | cards | Tok ✓ / L+D ✓ | `[nv-rt]` | — |
| `/blog/new` | `blog/new/page.tsx` | shell; editor shell | post editor (title, body, cover, SEO, tags) | `PostEditorShell`, `Editor`, `CoverImageUploader`, `SeoScore`, `TagPicker`, `CategoryPicker` | Tok ✓ / L+D ✓ | draft/save/error `[nv-rt]` | Rich text editor — verify editor surface theming + contrast |
| `/blog/[id]/edit` | `blog/[id]/edit/page.tsx` | shell; editor shell | same as new, populated | same blog/* components | Tok ✓ / L+D ✓ | load/save `[nv-rt]` | — |
| `/blog/analytics` | `blog/analytics/page.tsx` | shell; header/panel | blog metrics charts | aurora charts | Tok ✓ / L+D ✓ | `[nv-rt]` | verify chart colors |
| `/email-templates` | `email-templates/email-templates-client.tsx` | shell; client | template list + **HTML preview** (iframe/`dangerouslySetInnerHTML`, 15 refs) + variable editor | preview pane, forms | Tok ✓ for chrome / **preview renders external email HTML — NOT theme-controlled** | loading/empty/error `[nv-rt]` | **Renewal caveat:** the email-HTML preview is its own un-themed surface; theme only governs the surrounding console chrome |

---

## 8. Misc

| Route | File | Layout | Sections | Theme | States | Renewal notes |
|---|---|---|---|---|---|---|
| `/forbidden` | `(admin)/forbidden/page.tsx` | shell; static centered card | 403 badge (`ShieldAlert` on `bg-destructive/10`), eyebrow, "Access denied", back-to-dashboard CTA | Tok ✓ / L+D ✓ | static (error page itself) | Clean token-only error template; reuse pattern |

---

## 9. Cross-cutting renewal notes

1. **Theme hygiene is excellent.** Pages carry essentially zero hardcoded color; everything resolves through `.adm-aurora` token overrides. A renewal can re-skin the **entire admin** by editing `aurora.css` + `globals.css` token blocks (dark scope `:root,.dark` / light `.light` + `html:not(.dark) .adm-aurora`) without touching page source.
2. **Two parallel token namespaces** (`--au-*` Aurora + shadcn HSL + legacy `--rose/--foil/--tone-*` redirects) coexist. The legacy redirects are a maintenance smell — a renewal should decide whether to collapse them into one namespace.
3. **Accent flips by theme** (Gold dark ↔ Sapphire light) — not a single brand hue. Renewal must decide if this duality stays or unifies to one brand accent.
4. **Spots needing fixes:** dashboard plan/Moving badges build colors by string-concat (`plan.color + "1f"` / `"#8A94A6"`) instead of token classes — only non-token color in pages. Chart/SVG primitives (sparkline, donut, ring, tier-medallion, revenue/signups-trend) embed hex gradient stops — fine for now but not theme-reactive; flag for renewal if charts must follow theme.
5. **Un-themed surface:** `/email-templates` HTML preview renders arbitrary email markup — out of theme scope by design.
6. **Auth pages** (`/login`, `/set-password*`) live outside the sidebar shell with their own centered aurora card and **no raccoon logo mark** — consider brand consistency in renewal.
7. **Shell consistency:** ~12+ list pages share `DataTablePage`; ~20 operational pages share the RSC-guard→client pattern; header/panel/empty-state are universal. Renewal effort concentrates in ~6 shared components + 2 CSS files, not 62 pages.
8. **Runtime-only cells** (`[nv-rt]`): exact loading/empty/error markup for client-component pages and chart color sourcing should be confirmed by running the app; static read confirms token usage and structure but not every transient state.
