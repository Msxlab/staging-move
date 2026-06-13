# Premium UI Rollout Todo - 2026-06-12

Source preview:
- `previews/mobile-premium/index.html` is a standalone mock/preview artifact.
- Product code lives under `apps/mobile`, `apps/web`, and `apps/admin`; preview changes are not visible in the live apps until ported into those packages.

Definition of done:
- Mobile, web, and admin use the same Aurora/premium visual language, plan accents, interaction motion, icon rules, and raccoon mascot system.
- No visible old mascot/icon/emoji fallback remains where a lucide/system icon is available.
- Every dossier row that renders real data has a data-driven ambient effect inside its own row/modal area.
- Web app screens visually align with the mobile app instead of reading as a separate product.
- Admin remains dense and operational, but uses the same refined tokens, spacing, states, badges, tables, and empty/error surfaces.
- Typecheck and relevant tests pass for changed packages.

Done in this pass:
- Mobile dossier ambient mapper expanded for water, housing, EV charging, category-only air quality, and weather variants: storm, snow, fog, heat, cold, wind, rain, cloud, sun.
- Mobile `HomeDossierCard` now attaches ambient effects to water, housing, EV charging, air category-only rows, and temp-aware weather.
- Web dossier ambient mapper/component/CSS expanded with the same water, housing, EV, air, and weather variants.
- Web `HomeDossierCard` now attaches ambient effects to water, housing, EV charging, temp-aware weather, and category-only air quality.
- Mobile Services visible category filter emojis were replaced with system icon rendering.
- Web Services visible filter and section-heading emojis were replaced with lucide icon rendering.
- Mobile address detail, address map, onboarding provider accordion, and new-service coverage/category surfaces now use system icons instead of visible emoji text.
- Mobile dashboard workspace/household card was folded into the header plan/workspace metadata so Pro/Family status is no longer a separate empty-feeling card.
- Web AppShell background moved from decorative blob layers to a calmer linear/pattern premium surface.
- Web added a shared category icon component and applied it to service logo fallbacks, provider logo fallbacks, provider filters, provider detail/compare, onboarding provider category chips, and service-new category chips.
- Web dashboard premium badge no longer uses a pulsing inline SVG; it now uses a stable lucide badge with the actual plan label when available.
- Web household activation prompt was reduced from a large promo card to a compact operational prompt.
- Web moving plan detail now mirrors mobile's compact focus-list behavior: only the nearest open tasks render first, with an explicit "show more" control and progress summary.
- Web budget now mirrors the mobile premium hierarchy: header, month/address filters, limit action, projected spend, budget progress, and key money stats are consolidated into one command surface.
- Admin shell now has a shared workspace surface/inner max width so all admin pages inherit a cleaner operational canvas.
- Admin dashboard quick actions were converted from three large cards into a compact command-shortcuts panel.
- Admin shared panel/chart/sidebar title tracking was normalized on common chrome surfaces.
- Admin shared `DataTablePage` search/filter/table chrome now uses a compact operational command strip with row count, active query chips, clearer filter expansion, and spinner-backed loading state.
- Mobile moving detail generated-task wall was compacted into expandable task cards with quick-complete, due pills, and hidden detail blocks.
- Mobile shared service/provider logo fallback now renders system category icons instead of visible emoji fallback text.
- Mobile service detail, workspace settings, widget copy, and shared UI typography were cleaned so visible glyph fallbacks and negative letter spacing do not leak into real app screens.
- Mobile service edit was moved from a flat form into the premium service surface: service hero, category badge, system-logo fallback, grouped provider/billing/contact/notes sections, icon-backed fields, and a compact save action.
- Mobile search now uses a premium search-command hero, domain count chips, icon-backed result rows, and chevrons instead of plain text rows.
- Mobile reminders now uses a reminder-command hero, overdue/soon/renewal/reminder count chips, and stronger timeline row affordances.
- Mobile notifications now keeps a premium inbox summary visible for both unread and all-clear states, with total/reminder/linked counts.
- Mobile address new/edit now use the same address-command hero, required-field stats, ownership/primary chips, and grouped form panels as the premium preview direction.
- Mobile providers list now has a provider-command hero with destination, catalog, matched, gap, and compare stats.
- Mobile provider compare now has a compare-command hero and cleaner top context instead of repeating small address notes.
- Mobile custom providers now has a local-provider command hero and glass search surface.
- Mobile sign-in and sign-up now use a premium glass auth panel with brand hero/kicker while keeping existing OAuth, MFA, legal, and password flows intact.
- Mobile budget create now has a budget-command hero with live income/expense/balance stats and grouped budget form panels.
- Mobile budget detail now has a budget-command hero with spend/planned/balance stats, progress meter, and glass summary/breakdown surfaces.
- Mobile help and support tickets now use support-command/support-desk heroes, stats, glass search/action surfaces, and premium ticket rows.
- Mobile support ticket detail now uses a support-thread hero, message counts, glass message bubbles, and a calmer reply/closed state.
- Mobile custom provider detail/edit now use local-provider command heroes, system category icons, status/contact/location stats, and grouped form panels.
- Mobile moving plan create now uses a move-command hero with route readiness, address/date/status stats, and grouped route/schedule sections.
- Mobile blog list/detail, reset/setup password, invitation acceptance, OAuth callback, and workspace invite screens now use the same glass command/auth surface family.
- Mobile settings notifications, connections, privacy, two-factor, and address-change screens now use command heroes with relevant readiness/status stats.
- Web support now mirrors the mobile support-command pattern with status summary tiles, calmer contact cards, a premium create-ticket panel, and denser ticket rows.
- Web settings hub now mirrors the mobile account command pattern with a premium command hero, status summary tiles, icon-backed rows, and cleaner account/feature sections.
- Web addresses list/new/edit and moving-new now use mobile-aligned command heroes, route/address stats, and calmer glass form/card surfaces.
- Web sign-in and sign-up now use premium glass auth panels with shield marks while preserving OAuth/MFA/legal flow behavior.
- Admin page headers now render as shared command-style glass panels across admin pages.
- Admin login now uses the same premium command/auth treatment with a lucide shield mark, glass card, and cleaner primary action.
- Admin quick-look drawer styling now has refined drawer background, profile card, stat tiles, row hover, and footer treatment for shared list-page detail panels.
- Admin provider quality now highlights HUD housing and NLR EV charging as new dossier sections inside Dossier Source Readiness.
- Admin runtime config now has a runtime-control command panel, glass key cards, cleaned deployment-only labels, and clearer configured/conflict/required stats.
- Admin topbar/sidebar shortcut hints now use `Cmd K`/`Ctrl K` text, shared logo assets, and cleaner ASCII labels; shared empty states now use the premium glass panel treatment.
- Web address detail, onboarding profile controls, and service custom-provider coverage controls now use lucide/category icons instead of inline emoji labels.
- Admin provider governance coverage badges and help-center helpful counts now use lucide icons instead of glyph/emoji labels.
- Mobile, web app, and admin operational surfaces have negative tracking/letter-spacing removed in the touched screens and shared UI components.
- Mobile launcher/adaptive/splash/favicon/notification assets, web PWA icons/favicon/logo/OG assets, and admin logo/OG assets now use the shared raccoon mark instead of the old flow-line mark.
- Mobile `LogoBrand`, web marketing `LogoMark`, and admin sidebar rail/flat logo now consume the shared raccoon asset instead of inline flow-line SVG geometry.
- Admin public design prototype logo references, web/admin support system avatars, admin digest fallback copy, and public blog SVG letter spacing were cleaned so old glyph/logo/negative-tracking artifacts do not leak from public surfaces.
- Tests updated and passed:
  - Full workspace test pass:
    - `@locateflow/web`: 270 files, 2428 tests passed
    - `@locateflow/admin`: 118 files, 742 tests passed
    - `@locateflow/mobile`: 27 files, 280 tests passed
    - `@locateflow/connectors`: 15 files, 105 tests passed
  - `@locateflow/mobile` `src/lib/home-dossier.test.ts`: 102/102
  - `@locateflow/web` `dossier-ambient.test.tsx` + `home-dossier.test.tsx`: 94/94
  - `@locateflow/web` `services-client.test.tsx` + `providers-client.test.tsx`: 15/15
  - `@locateflow/admin` `admin-step-up-ui.test.ts` + `admin-plan-options.test.ts`: 6/6
  - `@locateflow/admin` `runtime-config-client.test.ts`: 8/8
- Typecheck passed:
  - `@locateflow/mobile`
  - `@locateflow/web`
  - `@locateflow/admin`
  - `@locateflow/db`
  - `@locateflow/connectors`
- Expo dependency check passed:
  - `pnpm --filter @locateflow/mobile exec expo install --check`

Mobile route coverage:
- Tabs: dashboard, addresses, moving, services, more.
- Auth: sign-in, sign-up, forgot-password.
- Core flows: onboarding, search, notifications, reminders.
- Addresses: list, detail, new, edit.
- Moving: list, new, detail.
- Services: list, new, detail, edit.
- Providers: list, detail, compare, custom providers.
- Budget: list, new, detail.
- Settings: profile, subscription, workspace, privacy, notifications, connections, address changes, export, two-factor, delete account.
- Support/content: help, tickets, ticket detail, blog list/detail, invitation/reset/setup/password/oauth/workspace invite.

Mobile remaining priority:
- [x] Dashboard: replace decorative/non-functional Pro household block with compact tier/workspace metadata in the header.
- [ ] Dashboard: continue reducing remaining clutter around secondary prompts and module order; keep only active move, dossier, up-next, service insight, invite/offline/push prompts.
- [x] Moving detail: compact long generated moving plan into expandable task cards, quick actions, due pills, and shorter default rows; phase tabs/sticky next action remain optional polish.
- [x] Services new/list visible category and coverage icon cleanup.
- [x] Services edit: replace flat edit form with premium service hero, category badge, icon-backed fields, and grouped billing/contact sections.
- [ ] Services detail: continue tightening renewal/cost hierarchy after system-icon fallback cleanup.
- [x] Addresses detail/map visible tied-service/category icon cleanup.
- [x] Addresses list/new/edit: premium map/address cards, consistent route/transit panels, compact tied-services summaries.
- [x] Providers/custom providers/compare: premium cards, comparison table density, cleaner provider logo/icon fallback.
- [x] Reminders/notifications/search: convert to command-hero, icon/state, and premium row systems.
- [x] Budget: create/list/detail command surfaces are tightened; continue only if budget history needs deeper analytics polish.
- [ ] Settings/more/subscription/workspace/privacy/export/security: notification/connection/privacy/two-factor/address-change screens are aligned; continue profile/subscription/export/delete-account destructive states.
- [x] Auth/onboarding/help/blog/invitation/reset/setup/oauth: auth/help/blog/invitation/reset/setup/oauth first screens are aligned.
- [x] App icons/splash/notification/favicon: mobile launcher/adaptive/splash/favicon/notification, web PWA/favicon/logo/OG, and admin logo/OG assets now use the shared raccoon mark.

Web app route coverage:
- App shell/dashboard, moving, addresses, services, providers, budget, notifications, support, settings.
- Public/auth/onboarding/pricing/help/blog/legal/movers pages.
- API-rendered dossier/PDF surfaces where visual output matters.

Web remaining priority:
- [x] App shell background: remove decorative blob layer and align the base surface with the mobile premium direction.
- [ ] App shell/header/sidebar/mobile nav: continue aligning nav density, header hierarchy, and responsive behavior with mobile premium tokens.
- [x] Dashboard: remove pulsing premium badge and emoji task/phase glyphs.
- [ ] Dashboard: continue mirroring mobile module hierarchy and reduce secondary widget clutter for authenticated users.
- [x] Moving plan detail: add compact focus-list behavior for generated tasks.
- [x] Services/providers/onboarding: shared category icon discipline for visible category and fallback surfaces.
- [x] Addresses/moving/support: support, addresses list/new/edit, and moving-new now mirror mobile command language.
- [ ] Public pages: ensure brand/product is first-viewport signal, real visual assets, no stale mascot/emoji fallback.
- [ ] Mobile embed mode: verify web pages opened from mobile visually match native surfaces.

Admin route coverage:
- Main dashboard, analytics/intelligence, users/workspaces/team/subscriptions/billing/plans.
- Providers/provider quality/coverage/governance/connectors/connector metrics/fallbacks/runtime config/settings/health.
- Moving/movers/sponsored/acquisition/affiliate/reports/logs/security/notifications/support/tickets/blog/help center/backups/state rules/feature flags.

Admin remaining priority:
- [x] Admin shared workspace surface: central max width, calmer patterned content background, inherited by admin pages.
- [x] Admin dashboard: compact command shortcuts and normalized common title tracking.
- [x] Admin shell/navigation/header: shared page header command surface, sidebar logo asset, topbar/search shortcut cleanup, and shared empty state treatment are done.
- [ ] Tables/data pages: unified toolbar/search/filter chrome is now started in shared `DataTablePage`; continue export buttons, status pills, and bulk-action affordances.
- [x] Provider quality/integration readiness/settings/runtime config: HUD/NLR readiness and runtime config command surfaces are now highlighted consistently.
- [ ] User/workspace/subscription/billing/security/logs/support pages: standardize risk/status tones and detail panels; shared quick-look drawer polish is started.
- [ ] Analytics/reports: consistent chart cards and KPI hierarchy without nested-card clutter.

Verification queue:
- [x] Run `pnpm --filter @locateflow/mobile exec tsc --noEmit`.
- [x] Run `pnpm --filter @locateflow/web exec tsc --noEmit`.
- [x] Run `pnpm --filter @locateflow/admin exec tsc --noEmit` after admin edits.
- [x] Run targeted tests for touched features.
- [x] Browser sanity check unauthenticated web/admin entry screens on local dev servers; no console errors and no visible Next error overlay.
- [ ] Run authenticated visual screenshots for dashboard/moving/admin pages.
- [ ] Android Studio/manual mobile QA with `mobile.qa@locateflow.com` after a working dev build is available.
