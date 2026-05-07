# LocateFlow EN-ES i18n Fix Plan

This plan follows the read-only audit findings. It proposes fixes only; no application code was changed during the audit.

## Phase 0: Spanish-Blocking Bugs

1. Fix mobile plural rendering before Spanish release.
   - Affected keys: `services.summaryLine`, `services.missingCostHint`, `providers.daysUntilMove`, `moving.overdueSummary`.
   - Current mobile setup uses plain i18next without ICU support, so these strings can render raw plural syntax.
   - Choose one approach: convert to i18next plural key variants, or add and configure ICU support consistently.

2. Localize the web onboarding route.
   - Primary file: `apps/web/src/app/onboarding/page.tsx`.
   - Move step labels, form labels, validation messages, toasts, CTA labels, provider category copy, sensitive-copy disclaimer, loading states, and empty states into web EN/ES dictionaries.

3. Localize web services creation and service detail/edit flows.
   - Primary files:
     - `apps/web/src/app/(app)/services/new/page.tsx`
     - `apps/web/src/app/(app)/services/[id]/page.tsx`
     - `apps/web/src/app/(app)/services/[id]/edit/page.tsx`
     - `apps/web/src/app/(app)/services/services-client.tsx`
   - Include validation, action buttons, helper copy, category labels, recurring-cost text, removal/edit confirmations, and shared checklist copy.

4. Localize web provider recommendation list and provider detail pages.
   - Primary files:
     - `apps/web/src/app/(app)/providers/providers-client.tsx`
     - `apps/web/src/app/(app)/providers/[id]/detail-client.tsx`
   - Move category/tier/match/explanation/action/status copy into keys or localized shared mappers.

5. Localize web settings/account/billing/privacy flows.
   - Primary files:
     - `apps/web/src/app/(app)/settings/page.tsx`
     - `apps/web/src/components/account/*`
     - `apps/web/src/components/settings/*`
     - `apps/web/src/components/billing/*`
   - Include delete account, export account, subscription management, notifications, appearance/theme controls, and privacy copy.

6. Stop shared engines from returning ready-made English UI copy.
   - Primary files:
     - `packages/shared/src/constants.ts`
     - `packages/shared/src/recommendation-engine.ts`
     - `packages/shared/src/provider-move-domain.ts`
     - `packages/shared/src/relocation-checklist.ts`
     - `packages/shared/src/migration-engine.ts`
     - `packages/shared/src/acquisition.ts`
     - `packages/shared/src/billing.ts`
   - Prefer returning stable IDs, reason codes, template IDs, and interpolation variables. Localize in web/mobile display layers.

## Phase 1: High-Risk User Flow Translations

1. Finish web auth and account recovery localization.
   - Localize hardcoded copy in sign-in, sign-up, verify-email, resend verification, logout, and reset/recovery paths.

2. Finish mobile auth and reset-password localization.
   - Primary files:
     - `apps/mobile/app/_layout.tsx`
     - `apps/mobile/app/auth/callback.tsx`
     - `apps/mobile/app/reset-password/[token].tsx`
   - Replace hardcoded alerts, labels, loading copy, and validation copy with mobile dictionary keys.

3. Localize web moving-plan detail and task flows.
   - Primary file: `apps/web/src/app/(app)/moving/[id]/page.tsx`.
   - Cover task status/actions, deletion, migration guidance, timelines, and generated-task display.

4. Localize mobile budget/blog/provider recommendation edge states.
   - Primary files:
     - `apps/mobile/app/budget/[id].tsx`
     - `apps/mobile/app/blog/index.tsx`
     - `apps/mobile/app/blog/[slug].tsx`
     - `apps/mobile/src/components/dashboard/RecommendedRow.tsx`

5. Replace raw API error rendering in clients.
   - Web/mobile should not display `res.error`, thrown `Error.message`, or backend English strings directly.
   - Map backend error codes to localized client-side keys.

## Phase 2: Validation, Toasts, Modals, Empty/Error States

1. Add shared UI keys for common states.
   - Loading, retry, offline, empty, unavailable, not found, forbidden, validation required, and generic error states.

2. Localize web shell and shared components.
   - Priority files:
     - `apps/web/src/components/layout/app-shell.tsx`
     - `apps/web/src/components/layout/global-search.tsx`
     - `apps/web/src/components/layout/notification-center.tsx`
     - `apps/web/src/app/not-found.tsx`
     - `apps/web/src/app/error.tsx`
     - `apps/web/src/app/(app)/error.tsx`

3. Localize mobile shared UI components.
   - Priority files:
     - `apps/mobile/src/components/ui/ErrorBoundary.tsx`
     - `apps/mobile/src/components/ui/ErrorState.tsx`
     - `apps/mobile/src/components/ui/LoadingScreen.tsx`
     - `apps/mobile/src/components/ui/Input.tsx`

4. Audit and localize accessibility labels.
   - Include `aria-label`, `aria-describedby`, `accessibilityLabel`, `accessibilityHint`, `title`, `alt`, button icon labels, and drawer/tab labels.

## Phase 3: Terminology Consistency

Establish a shared EN/ES terminology table and apply it across web, mobile, and shared-generated copy.

Priority terms:
- Move
- Moving plan
- Task
- Provider
- Service
- Utility
- Address
- Start service
- Stop service
- Transfer service
- Account
- Settings
- Billing
- Delete account
- Export data
- Dark mode / Light mode / System
- Verification resource
- Address check required

Specific review points:
- Decide whether `Provider` is `proveedor`, `empresa`, or context-dependent.
- Decide whether `Service` is `servicio` everywhere, including utilities and subscriptions.
- Decide whether `Fitness`, `Legal`, `Health`, `Federal`, `HOA`, `VIP`, and `Push` are intentionally untranslated.
- Confirm whether Spain flag iconography is acceptable for Spanish in a US-focused product.

## Phase 4: Cleanup Unused/Stale Keys

1. Add an intentional equality allowlist.
   - Include product names, URLs, provider names, legal names, acronyms, currency-only values, numbers, and proper nouns.
   - Keep exact EN/ES equality failures meaningful by excluding intentional matches.

2. Build a smarter stale-key scanner.
   - Current static scan found many candidates, but dynamic category/status keys create false positives.
   - The scanner should understand namespaces, `t("key")`, `useTranslations("namespace")`, mobile `t(...)`, and approved dynamic key patterns.

3. Remove stale keys only after runtime coverage exists.
   - Do not delete keys solely because a static scan did not find them.

## Phase 5: Regression Tests

1. Translation key coverage tests.
   - Assert EN and ES key parity for web and mobile.
   - Assert interpolation variable parity.
   - Assert no unsupported ICU plural syntax in mobile unless ICU support is configured.

2. Web locale rendering tests.
   - Render `/es` or Spanish-cookie variants for auth, onboarding, dashboard, moving plan, providers, services, settings, billing, error pages, and shared shell.
   - Assert no high-confidence English UI phrases remain.

3. Mobile locale rendering tests.
   - Initialize i18next with `es`.
   - Render splash/auth/onboarding/tabs/dashboard/tasks/providers/services/settings/profile/delete/export/error/offline states.
   - Assert Spanish labels and no raw plural syntax.

4. Validation and toast tests.
   - Trigger required-field errors, invalid-email errors, failed API responses, delete/export flows, and OAuth failure states in Spanish.

5. Language persistence tests.
   - Web: assert `NEXT_LOCALE` behavior across navigation, refresh, and sign-in state.
   - Mobile: assert `locateflow.locale` AsyncStorage behavior and device-locale fallback.

6. API error mapping tests.
   - Backend responses should expose stable codes for user-visible failures.
   - Clients should map codes to localized strings.

## Suggested Implementation Sequence

1. Add i18n coverage tests and mobile plural guard.
2. Fix mobile plural rendering and localize mobile shared UI/auth reset errors.
3. Localize web onboarding.
4. Localize web services and providers.
5. Refactor shared packages to return keys/codes instead of English copy.
6. Localize web/mobile settings, account, billing, delete, export, and privacy flows.
7. Localize search, notification center, error pages, metadata, and accessibility labels.
8. Run a Spanish copy review pass against the terminology matrix.
9. Clean stale keys with allowlists and coverage tests in place.

## Verification Notes From Audit

- `pnpm verify:typecheck` passed.
- `pnpm verify:tests` ran and failed one existing web test: `src/app/auth-social-buttons.test.ts` expected `bg-zinc-950`, while current source uses `bg-muted`.
- The test failure is unrelated to this read-only localization audit but should be resolved before relying on a green regression suite.
