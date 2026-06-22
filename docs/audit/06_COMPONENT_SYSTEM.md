# Component System And Design Tokens

## Verified Source Of Truth

Shared design tokens live in `packages/shared/src/design-tokens.ts`.

Evidence:

- Shared token file identifies consumers at `packages/shared/src/design-tokens.ts:17`.
- It notes that web and admin CSS keep their own manually synchronized copies at `packages/shared/src/design-tokens.ts:22`.
- `letterSpacing` token export exists at `packages/shared/src/design-tokens.ts:470`.
- Web CSS sets `--tracking-tightest` and `--tracking-tight` to `0` at `apps/web/src/styles/globals.css:201-202`.
- Web Tailwind display sizes still define negative letter spacing at `apps/web/tailwind.config.ts:181-184`.
- Admin Tailwind display sizes still define negative letter spacing at `apps/admin/tailwind.config.ts:170-173`.

## Web

Verified:

- Web app has a global CSS theme file at `apps/web/src/styles/globals.css`.
- Dark theme and light theme variables are defined in CSS and consumed through Tailwind config.

Needs verification:

- Rendered desktop/mobile screenshots for public pages, dashboard pages, form states, empty states, error states, and loading states.
- Text overflow, focus states, keyboard navigation, and reduced-motion behavior.

## Admin

Verified:

- Admin app has its own global CSS/theme layer at `apps/admin/src/app/globals.css`.
- Admin Tailwind config mirrors brand typography and semantic color variables.

Needs verification:

- Dense admin table readability.
- Long-label fit in filters/actions.
- Permission-denied, MFA, password-confirm, backup/import, and error states.

## Mobile

Verified:

- Mobile theme file consumes shared tokens and exposes static `theme` plus `ThemeProvider`.
- Comments document that static imports render the dark palette until migrated. Evidence: `apps/mobile/src/lib/theme.ts:35`, `apps/mobile/src/lib/theme.ts:44`, `apps/mobile/src/lib/theme.ts:48`.
- Static `theme` export is at `apps/mobile/src/lib/theme.ts:240`.
- Source search found 100 mobile files referencing `theme.colors`, `theme.spacing`, `theme.radius`, or `theme.shadow`.

Finding:

- `UX-MOB-001`: live theme switching is incomplete for static mobile theme call sites.

## Component System Risks

| ID | Severity | Risk | Evidence | Recommendation |
| --- | --- | --- | --- | --- |
| UX-THEME-001 | Low | Manual token mirroring can drift across shared/web/admin/mobile. | `packages/shared/src/design-tokens.ts:22`; separate CSS/Tailwind files. | Add generated token outputs or snapshot tests that fail on drift. |
| UX-MOB-001 | Medium | User-selected mobile theme can be inconsistent across screens still using static dark theme. | `apps/mobile/src/lib/theme.ts:35-48`, `apps/mobile/src/lib/theme.ts:240`, 100 files with static theme usage. | Migrate screens to `useAppTheme`/`useThemedStyles` in priority order and add visual QA. |

## Not Verified In Code

- Accessibility contrast calculations across every token pair.
- Actual rendered web/admin/mobile visual parity.
- Asset loading and image proxy behavior in real browsers/devices.
