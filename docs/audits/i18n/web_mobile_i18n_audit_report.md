# LocateFlow Web/Mobile EN-ES Localization Audit

## 1. Executive Summary
- Overall EN/ES completeness: dictionary parity is good, but runtime Spanish completeness is not. Web has 910 EN keys and 910 ES keys with no missing ES keys. Mobile has 773 EN keys and 773 ES keys with no missing ES keys. The blocker is wiring: many user-facing routes, components, shared engines, and API errors bypass the dictionaries.
- Biggest Spanish gaps: web onboarding, web providers, web service add/detail/edit, web settings/account/billing/export/notifications, web search/notification shell, web error pages, and shared move/provider recommendation copy.
- Web status: not Spanish-ready. Several primary app routes render mostly or entirely English in Spanish mode.
- Mobile status: closer, but not ready. Main navigation and many screens use `react-i18next`, but reset password, OAuth callback, error/loading components, profile/privacy/delete-account settings, budget detail, onboarding option labels, recommended provider badges, and backend error passthrough still leak English.
- Shared i18n architecture status: shared packages contain many English labels, explanations, task templates, coverage descriptions, migration notes, and acquisition/billing copy without a locale parameter. Web and mobile sometimes wrap these with local helpers, but coverage is inconsistent.
- Top 10 localization risks:
  1. Web onboarding is a critical Spanish blocker.
  2. Web service-add flow is hardcoded English.
  3. Web provider list/detail pages are hardcoded English.
  4. Web settings/account/billing/export/security pages are hardcoded English.
  5. Shared relocation checklist and migration engines generate English task titles/descriptions.
  6. API `error`/`message` strings are often displayed directly by web/mobile.
  7. Mobile plural strings use ICU syntax in plain i18next.
  8. Mobile settings privacy/profile/delete-account still contain English alerts and labels.
  9. Web metadata/OpenGraph defaults are English and `openGraph.locale` is hardcoded `en_US`.
  10. Web and mobile terminology is inconsistent for move/mudanza, task/tarea, service/servicio, provider/proveedor, and coverage/resource concepts.

## 2. Audit Coverage
Source/config files reviewed as source of truth:
- Web i18n/config: `apps/web/src/i18n/config.ts`, `apps/web/src/i18n/request.ts`, `apps/web/src/middleware.ts`, `apps/web/src/i18n/messages/en.json`, `apps/web/src/i18n/messages/es.json`.
- Web app shell/components: `apps/web/src/app/layout.tsx`, `apps/web/src/components/language-selector.tsx`, `apps/web/src/components/layout/app-shell.tsx`, `sidebar.tsx`, `mobile-nav.tsx`, `header.tsx`, `global-search.tsx`, `notification-center.tsx`, shared/marketing/settings components.
- Web routes reviewed: landing, pricing, auth, verify-email, onboarding, dashboard, addresses, services, moving, providers, notifications, settings/profile/privacy/subscription/export/notifications, error/not-found, public help/legal pages where route source is user-facing.
- Mobile i18n/config: `apps/mobile/src/i18n/config.ts`, `apps/mobile/src/i18n/messages/en.json`, `apps/mobile/src/i18n/messages/es.json`, `apps/mobile/app/_layout.tsx`, `apps/mobile/app/(tabs)/_layout.tsx`.
- Mobile screens/components reviewed: auth, onboarding, tabs/home/addresses/services/moving/more, providers, settings/profile/privacy/notifications/subscription/export/delete-account, budget, blog, help/tickets, reset-password, OAuth callback, app/error/loading/input/language/theme components.
- Shared packages reviewed: `packages/shared/src/constants.ts`, `recommendation-engine.ts`, `provider-move-domain.ts`, `relocation-checklist.ts`, `migration-engine.ts`, `move-task-*`, `provider-coverage.ts`, `intl-helpers.ts`, `acquisition.ts`, `billing.ts`, `validators.ts`, plus web/mobile wrappers around shared code.
- API/backend routes reviewed where responses can reach web/mobile: auth, user locale, profile, addresses, services, moving, providers, notifications, subscription/billing, export/PDF, account delete, middleware, cron notification producers.

Excluded as source of truth per instruction: README files, existing markdown docs, generated docs, prior audit reports, and memory/prior context.

## 3. Web Findings
### Auth
- `/sign-in` mostly uses `next-intl`, but the OAuth readiness note is hardcoded English at `apps/web/src/app/sign-in/page.tsx:191`. The divider also slices a translated string with `.replace(/.*\s/, "")`, which is fragile in Spanish.
- `/sign-up` mostly uses translations, but the legal acceptance reminder is hardcoded English at `apps/web/src/app/sign-up/page.tsx:231`.
- `/verify-email` is not wired to translations. The route and resend button use hardcoded title, body, buttons, alerts, and network errors in `apps/web/src/app/verify-email/page.tsx` and `resend-verification-button.tsx`.
- Auth APIs return English errors directly, including invalid login/MFA, password reset, OAuth configuration, resend verification, account already exists, and legal acceptance required.

### Onboarding
- `apps/web/src/app/onboarding/page.tsx` is the largest web blocker. Step labels, validations, provider browsing, legal/sensitive profile copy, address form, service selection, move plan creation, buttons, loading states, empty states, errors, and success messages are hardcoded English.
- Examples include `First name and last name are required.` at line 324, sensitive profile copy around line 806, and category browse controls around line 1051.
- Severity is Critical because onboarding is a primary first-run flow and remains English in Spanish mode.

### Dashboard
- Dashboard is partially translated, but it still shows fallback English such as `Origin`, `Destination`, raw category replacements, `/mo`, and shared relocation phase/checklist copy.
- The page consumes shared `generateChecklist` output whose titles/descriptions/state notes are English.

### Moving Plan/Tasks
- `/moving` list and `/moving/new` are mostly localized.
- `/moving/[id]` contains many hardcoded task alerts, state guide labels, transition plan labels, statuses, button labels, delete flow copy, and local-only guidance. It also renders English shared migration/checklist task copy.
- Generated task titles/descriptions from `packages/shared/src/relocation-checklist.ts` and `migration-engine.ts` are English.

### Providers
- `/providers` is hardcoded English in `apps/web/src/app/(app)/providers/providers-client.tsx`: headers, filters, empty/loading states, badges, search placeholder, coverage labels, recommendation sections, and state deadline copy.
- `/providers/[id]` detail is hardcoded English in `detail-client.tsx`, including `Track manually as my service` at line 179 and all trust/coverage/manual tracking details.
- Provider descriptions and recommendation reasons from the database/API are English unless client-side helper rewrites them; web provider pages do not consistently do that.

### Services
- `/services` is partly translated but uses hardcoded subtitle text, `/mo`, raw category labels, and shared checklist text.
- `/services/new` is hardcoded English and is a High/Critical key-flow gap. It includes address selection, category browsing, custom provider flow, validation, limit/subscription/email-verification errors, and CTA labels.
- `/services/[id]` and `/services/[id]/edit` are hardcoded English for detail, billing, contact, documents, notes, delete/edit forms, status badges, dates, and toasts.

### Settings/Account
- `apps/web/src/app/(app)/settings/page.tsx` is hardcoded English (`Settings`, account sections, danger zone, descriptions).
- `settings/profile`, `settings/privacy`, `settings/notifications`, and `settings/export` are largely hardcoded English.
- `components/settings/delete-account-dialog.tsx`, `appearance-card.tsx`, and `subscription-management.tsx` are hardcoded English. This affects theme controls, delete account, subscription/billing portal, and trial/legal copy.

### Billing
- Billing/subscription UI uses English plan/status/error copy and fixed `en-US` date formatting in `components/settings/subscription-management.tsx`.
- Subscription APIs return English errors that the UI surfaces directly.

### Error/Loading/Empty States
- Global and app error boundaries are hardcoded English (`Something went wrong`, `Try Again`).
- App not-found page is hardcoded English.
- Several loading/empty states in search, notification center, export, settings, providers, and services are hardcoded English.

### Shared Components
- `GlobalSearch` is hardcoded English for static pages, placeholder, no-results, type labels, keyboard hints, and aria labels.
- `NotificationCenter` is hardcoded English for aria label, header, `new`, `Mark all read`, loading/empty states, footer links, and relative time formatting/date locale.
- `AppShell` skip link and mobile overlay aria label are hardcoded English.
- Sidebar/mobile nav/header labels are mostly translated.

## 4. Mobile Findings
### Splash/Auth
- Mobile i18n initializes before first render and tabs use translated labels.
- `_layout.tsx` OAuth failure alert is hardcoded English at line 107.
- `OAuthCallbackScreen` shows `Completing sign-in...` in English.
- `reset-password/[token].tsx` is entirely hardcoded English for validation, title, copy, inputs, alert, and buttons.

### Onboarding
- Onboarding uses translations for many headings, errors, and field labels.
- Static option arrays are English and rendered directly: family, address type, ownership, household flags, move type, immigration status at lines 67-126 and usage at lines 614, 735, 767, 818, 829.
- Example placeholders like `John`, `Doe`, `Austin`, `TX`, `78701` are not flagged as translation blockers.

### Tabs/Navigation
- Tab labels are translated from `tabs.*`.
- More/settings links are mostly translated, except `Blog` is hardcoded in `app/(tabs)/more.tsx`.

### Dashboard/Budget
- Dashboard/home is partially translated but error title `Dashboard unavailable` is hardcoded.
- Budget detail uses hardcoded English for title/unavailable/not found, over/under status, planned labels, savings, spending by category, total, and notes.

### Moving Plan/Tasks
- Main moving screens use translations for most labels.
- Several alerts pass raw API `res.error`; if the backend returns English, Spanish mode leaks English.
- Mobile message keys for `services.summaryLine`, `services.missingCostHint`, `providers.daysUntilMove`, and `moving.overdueSummary` use ICU plural syntax but mobile i18next is not configured with an ICU plugin. These strings can render malformed text.

### Providers/Services
- Provider screens use local helpers to rewrite descriptions/reasons/coverage in Spanish, which is good.
- `RecommendedRow` still has hardcoded English default title and tier badges (`Critical`, `Important`, `Recommended`).
- Service add/edit screens are mostly translated, but many API errors are passed through and success/failure count alerts are awkwardly assembled from translated fragments.

### Settings/Account
- Settings index uses translated labels and language/theme selector components.
- `LanguageSelector` heading is hardcoded bilingual `Language / Idioma`. Names are correct as endonyms, but this bypasses `settings.language_title`.
- Profile settings still contain extensive hardcoded English labels, alerts, and derived labels. The family-status label mapping is also incorrect (`SINGLE` becomes `Unknown`, `COUPLE` becomes `Yes`, `FAMILY` takes the first word of a goal sentence).
- Privacy settings still contain hardcoded English for account security, sessions, password setup, analytics, loading/error text, badges, and alerts.
- Delete account has translated core title/body but hardcoded password-required flow, accessibility labels/hints, setup link labels, and delete button a11y copy.

### Alerts/Modals/Loading/Empty
- Shared `ErrorState`, `LoadingScreen`, `LoadingOverlay`, `Input` password visibility labels, and `ErrorBoundary` are hardcoded English.
- Many screens use `Alert.alert(t(...), res.error)`, so backend English errors surface in Spanish mode.

## 5. Shared i18n Key Coverage
- Web EN keys: 910.
- Web ES keys: 910.
- Web missing ES keys: 0.
- Web ES equals EN keys: 24. Most are acceptable product names, prices, acronyms, placeholders, or short terms, but `Fitness`, `Premium`, `No`, and `legal.consent_marketing` need manual Spanish review.
- Web interpolation mismatches: 0.
- Web plural syntax: present in 5 keys and acceptable because `next-intl` supports ICU messages.
- Mobile EN keys: 773.
- Mobile ES keys: 773.
- Mobile missing ES keys: 0.
- Mobile ES equals EN keys: 19. Some are acceptable acronyms/provider/legal terms (`DMV`, `FAQ`, `Push`, `Legal`); some need copy review (`Fitness`, `Ticket`, `Error`, `General`).
- Mobile interpolation mismatches by regex: 2, both caused by ICU plural syntax differences. These are real mobile issues because i18next has no ICU plugin in `apps/mobile/src/i18n/config.ts`.
- Unused/stale key analysis: static scan found 529 web unused candidates and 176 mobile unused candidates. Many mobile category/coverage keys are used dynamically, so treat this as cleanup input, not deletion authority.

## 6. Hardcoded English Inventory
Every probable hardcoded-English surface found is represented in the CSVs. High-volume files are grouped here:
- Web auth: sign-in readiness note, signup legal reminder, verify-email route/resend button.
- Web onboarding: nearly all user-facing copy in `apps/web/src/app/onboarding/page.tsx`.
- Web app shell: global search, notification center, app shell skip/overlay labels.
- Web dashboard/services/moving: shared checklist/migration copy, raw categories, `/mo`, route-specific hardcoded labels.
- Web providers: provider list/detail pages, coverage/trust/manual tracking copy.
- Web settings/account/billing/export/notifications: whole-route hardcoded pages and settings components.
- Web public/metadata/help/legal pages: static route metadata and copy are English-only.
- Web API/backend: auth/profile/services/moving/providers/notifications/subscription/export/account-delete/middleware English error strings.
- Mobile shared components: OAuth callback, error boundary, error/loading/input components, language selector heading.
- Mobile onboarding: static option labels.
- Mobile settings: profile/privacy/delete-account hardcoded labels, alerts, accessibility labels/hints.
- Mobile budget/reset/blog: hardcoded detail/reset/blog empty/retry/open-web texts.
- Shared packages: constants, recommendation engine, provider move domain, relocation checklist, migration engine, acquisition/billing copy.

## 7. Web vs Mobile Terminology Matrix
| Concept | Web ES observed/intended | Mobile ES observed/intended | Risk |
|---|---|---|---|
| Move | Mudanza | Mudanza | Mostly consistent |
| Moving plan | Plan de mudanza | Plan de mudanza | Consistent where translated; web detail leaks English |
| Task | Tarea | Tarea | Web task detail leaks English |
| Provider | Proveedor | Proveedor | Consistent where translated |
| Service | Servicio | Servicio | Consistent where translated |
| Utility | Servicios publicos / utility categories | Servicios publicos | Needs accent/copy review in some keys |
| Address | Direccion | Direccion | Consistent where translated |
| Start service | Iniciar/activar servicio needed | Start destination service in shared EN | Shared gap |
| Stop service | Detener/cancelar service needed | Stop old service in shared EN | Shared gap |
| Transfer service | Transferir servicio | Transfer service shared EN | Shared gap |
| Account | Cuenta | Cuenta | Mostly consistent |
| Settings | Configuracion/Ajustes mixed | Configuracion/Ajustes mixed | Terminology mismatch |
| Billing | Facturacion | Facturacion | Web billing hardcoded EN |
| Delete account | Eliminar cuenta | Eliminar cuenta | Core term consistent; flows leak EN |
| Export data | Exportar datos | Exportar datos | Web export hardcoded EN |
| Dark mode / Light mode / System | Dark/Light/System hardcoded in web appearance | Claro/Oscuro/Sistema in mobile | Web gap |
| Verification resource | Recurso/verificacion unclear | Verificacion unclear | Needs manual terminology decision |
| Address check required | Requiere revisar/verificar direccion | Requiere revisar la direccion | Web/shared EN; align wording |

## 8. Language Switching & Persistence Review
- Web locale source of truth: `apps/web/src/i18n/config.ts` with `locales = ["en", "es"]`, `defaultLocale = "en"`, cookie `NEXT_LOCALE`, and `resolveLocale(cookie, accept-language)`.
- Web detection: cookie wins, then `Accept-Language`, then English. Middleware seeds `NEXT_LOCALE` on first visit.
- Web selector: `LanguageSelector` posts `/api/user/locale` and reloads. If the POST fails, it still reloads but does not set a client cookie itself; the user may remain in the prior locale if the endpoint failed. That is a persistence fragility.
- Web flags/names: names are correct endonyms (`English`, `Español`). Flags are US for English and Spain for Spanish. For US Spanish, the Spain flag may be culturally imprecise and should receive product/design review.
- Mobile locale source of truth: `apps/mobile/src/i18n/config.ts` with `LOCALES = ["en", "es"]`, stored `locateflow.locale`, device locale detection, fallback `en`.
- Mobile selector: calls `changeLocale`, persists to AsyncStorage, and best-effort syncs `/api/user/locale` for logged-in users. Local persistence works even if sync fails.
- Mobile flags: no flags, only endonym labels. This avoids country-locale ambiguity.
- Fallback behavior: both apps fall back to English for missing keys. Key parity is good, but hardcoded English and shared/API copy bypass the fallback system entirely.

## 9. API/User-Facing Error Review
API/backend strings that can reach UI should be normalized to error codes or localized server-side:
- Middleware: body too large, invalid content type/origin/referer, rate limit, access denied, unauthorized.
- Auth: login invalid, MFA required/invalid, OAuth not configured, invalid mobile OAuth, password reset, register legal/account errors.
- Locale: `/api/user/locale` returns `Unsupported locale`.
- Profile/onboarding: legal acceptance required, sensitive consent required, validation failed, failed save/fetch.
- Addresses/services/custom providers: not found, duplicate provider, email verification/subscription/limit gates, validation failed, failed CRUD.
- Moving/providers/recommendations/state rules: not found, invalid transitions, failed generation/analyze/fetch, state required.
- Billing/subscription/Stripe/IAP: offer unavailable, subscription active/trial errors, store errors, portal/checkout failures.
- Notifications/export: failed fetch/save/update/export/download/PDF generation plus cron-generated notification titles/bodies.

## 10. Recommended Fix Plan
### Phase 0: Spanish-blocking bugs
- Localize web onboarding, web service-add, web provider list/detail, web settings/account/billing/delete/export routes, and web error pages.
- Fix mobile ICU plural strings or add an ICU/pluralization plugin with tests.

### Phase 1: High-risk user flow translations
- Auth/verify-email/signup legal copy, service create/edit/detail, provider detail, moving detail/tasks, account deletion, profile/privacy/security, subscription/billing.

### Phase 2: Validation/toast/modal/empty/error states
- Replace hardcoded alerts/toasts, `res.error` pass-through, error/loading/empty components, global search, notification center, modals/dialogs, and accessibility labels.

### Phase 3: Terminology consistency
- Define a shared EN/ES terminology file for move/task/provider/service/address/billing/settings/coverage/action types.
- Align web and mobile on `Configuracion` vs `Ajustes`, `verificar direccion` vs `revisar direccion`, and manual tracking/legal disclaimers.

### Phase 4: Cleanup unused/stale keys
- Add static/dynamic-aware key coverage tests before deleting. Treat current unused counts as candidates only.

### Phase 5: Regression tests
- Add web and mobile Spanish rendering tests for every primary screen.
- Add no-hardcoded-English smoke tests with allowlists for brands, provider names, URLs, acronyms, product names, and intentional legal terms.

## 11. Test Plan
- Web locale rendering tests: render `/sign-in`, `/sign-up`, `/verify-email`, `/onboarding`, `/dashboard`, `/services/new`, `/providers`, `/settings`, `/settings/privacy`, `/settings/subscription`, `/moving/[id]` with `NEXT_LOCALE=es`.
- Mobile locale rendering tests: initialize i18next with `es`, render auth/onboarding/tabs/settings/profile/privacy/delete-account/providers/services/moving/reset-password/error/loading components.
- Translation key coverage test: assert EN and ES flattened key sets match, interpolations match, and mobile dictionaries contain no ICU plural syntax unless ICU support is installed.
- No hardcoded English smoke test: scan JSX/Text/Alert/toast/placeholder/aria/metadata with allowlists and route-based failures.
- Validation/toast Spanish tests: force API validation errors and assert localized keys or code mapping, not raw English.
- Language persistence tests: web cookie and DB sync; mobile AsyncStorage plus best-effort API sync.
- Fallback behavior tests: intentionally unknown locale falls back to English while supported Spanish never falls back on normal keys.

## 12. Final Recommendation
Spanish is not ready for users. Release should wait until web onboarding, services, providers, settings/account/billing, error states, shared generated copy, API error mapping, and mobile plural/settings/reset-password gaps are fixed.

Can wait: cleanup of unused/stale keys, public SEO refinements, minor accessibility labels, and manual copy review for equal EN/ES acronyms or product/legal names.

Needs manual Spanish copy review: legal disclaimers, subscription/billing disclosures, delete account confirmations, coverage confidence labels, manual tracking disclaimers, state-rule/checklist instructions, and web/mobile terminology decisions.

Verification run:
- `pnpm verify:typecheck`: passed, with Node engine warning (`wanted node 22.x`, current `v24.13.0`).
- `pnpm verify:tests`: failed in existing web test `src/app/auth-social-buttons.test.ts`; expected `bg-zinc-950`, current source contains `bg-muted`. 123 test files passed, 1 failed; 772 tests passed, 1 failed.
- Targeted `rg` scans were run for hardcoded strings, locale wiring, API errors, translation keys, and shared generated copy; findings were validated by reading source files, not grep alone.
