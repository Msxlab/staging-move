# UI/UX Baseline

This baseline is source-based. No browser, screenshot, or emulator visual QA was run in this pass.

## Product Surfaces

| Surface | Verified from code | UX risk to verify manually |
| --- | --- | --- |
| Web public/app | Next.js app with 74 page files, shared theme CSS, API-backed user flows. | Public funnel clarity, auth handoff, dashboard density, empty/error/loading states. |
| Admin | Next.js admin with 62 page files, admin CSS, role/MFA/session gates. | Table density, destructive action affordances, permission-denied states, backup/import safety copy. |
| Mobile | Expo app with 54 screen files and shared-token theme layer. | Live theme consistency, navigation hierarchy, keyboard/safe-area behavior, offline/error states. |

## Verified Theme Facts

- Shared design token source exists at `packages/shared/src/design-tokens.ts`.
- Token consumers are documented at `packages/shared/src/design-tokens.ts:17`.
- Manual token synchronization is documented at `packages/shared/src/design-tokens.ts:22`.
- Web CSS explicitly sets tight tracking variables to zero at `apps/web/src/styles/globals.css:201-202`.
- Web and admin Tailwind display typography still define negative letter spacing at `apps/web/tailwind.config.ts:181-184` and `apps/admin/tailwind.config.ts:170-173`.
- Mobile static theme migration limitation is documented at `apps/mobile/src/lib/theme.ts:35-48`.

## Initial UX Findings

### UX-MOB-001: Mobile live theme switching remains incomplete

Severity: Medium

Evidence:

- Static and context theme layers are both documented at `apps/mobile/src/lib/theme.ts:35-48`.
- Static dark `theme` export exists at `apps/mobile/src/lib/theme.ts:240`.
- Source search found 100 mobile files referencing static `theme.colors`, `theme.spacing`, `theme.radius`, or `theme.shadow`.

Impact:

- Users changing theme preference may see mixed or stale visual states across screens.

Recommendation:

- Prioritize migration of auth, dashboard, onboarding, workspace invite, reminders, billing, and settings screens to `useAppTheme` or `useThemedStyles`.
- Add a mobile visual QA checklist for dark, light, and system modes.

Priority:

- P1 for settings/theme consistency polish; P2 if theme switch is not a promised user-facing capability.

### UX-THEME-001: Token mirroring has drift risk

Severity: Low

Evidence:

- Shared token file says web/admin CSS keep manually synced copies at `packages/shared/src/design-tokens.ts:22`.
- Web/admin Tailwind display tracking differs from web CSS tracking variables in the inspected files.

Impact:

- Brand and accessibility updates can land in one surface but not others.

Recommendation:

- Generate CSS/Tailwind/mobile token outputs from `packages/shared/src/design-tokens.ts`, or add snapshot tests that compare exported values.

Priority:

- P2.

## Manual QA Matrix

| Area | Web | Admin | Mobile |
| --- | --- | --- | --- |
| Theme | dark/light, responsive, focus | dark/light, dense tables | dark/light/system, static import migration |
| Auth | login/signup/reset/OAuth | login/MFA/rotation/session timeout | login/signup/OAuth/mobile code |
| Core flow | move setup, address, services | user/provider/subscription ops | onboarding, dashboard, reminders |
| Errors | API failure, validation, empty states | permission denied, step-up required | offline, token expired, push denied |
| Accessibility | keyboard, focus, contrast | keyboard, focus, table semantics | screen reader labels, touch targets |

## Not Verified In Code

- Actual screenshots or rendered layout correctness.
- Responsiveness on real viewport sizes.
- Mobile emulator behavior.
- Accessibility test results.
