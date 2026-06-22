# Adversarial Verification: component-theme-system-02

**Finding under review:** Accent-on-white CTAs fail dark-mode contrast (EmptyState button, AppShell skip-link)
**Claimed severity:** High · Category: Accessibility
**Verdict: CONFIRMED** (severity unchanged: High)

## What the finding claims
- `EmptyState` primary button uses `bg-tone-orange-fg text-white` (`apps/web/src/components/shared/empty-state.tsx:36`).
- `AppShell` skip-link uses `bg-brand-orange text-white` (`apps/web/src/components/layout/app-shell.tsx:108`).
- In the default (dark) theme, `--tone-orange-fg` / `--brand-orange` resolve to Gold `#CBA45E`; white-on-Gold = 2.33:1 (fails WCAG AA).
- Light mode uses Sapphire `#2E5FB0` = 6.21:1 (passes).

## Evidence verified in source

### 1. Component class strings — confirmed
- `apps/web/src/components/shared/empty-state.tsx:36`:
  `const primaryBtn = "px-5 py-2.5 rounded-xl bg-tone-orange-fg text-white text-sm font-medium hover:opacity-90 transition";`
  Applied to the primary Link/button (lines 49, 54).
- `apps/web/src/components/layout/app-shell.tsx:108`: skip-link `<a href="#main-content">` with classes including `focus:bg-brand-orange ... focus:text-white`. Visible only on keyboard focus.

### 2. Tailwind utility → CSS var mapping — confirmed
`apps/web/tailwind.config.ts`:
- `tone["orange-fg"]: "var(--tone-orange-fg)"` (line 141) → `bg-tone-orange-fg` paints `--tone-orange-fg`.
- `brand.orange: "var(--brand-orange)"` (line 73) → `bg-brand-orange` paints `--brand-orange`.

### 3. Token values per theme — confirmed (and the dark block IS the default)
`apps/web/src/styles/globals.css`:
- The dark/default token block is selector `:root, .dark` (lines 21–22).
  - `--brand-orange: #CBA45E;` (line 42) — Gold.
  - `--tone-orange-fg: #CBA45E;` (line 127) — Gold.
- The `.light` override block (lines 214–314):
  - `--tone-orange-fg: #244C90;` (line 255) — Sapphire-dark.
  - `--brand-orange: #2E5FB0;` (line 296) — Sapphire.
- The file's own header comment (lines 17–19) states utilities "resolve to Gold in dark mode and Sapphire in light mode."

### 4. Dark is the actual default theme — confirmed
- `apps/web/src/components/theme-provider.tsx:8-16`: `next-themes` configured `attribute="class"`, `defaultTheme="dark"`. So in the absence of a stored/system preference the `.dark` class is applied → Gold tokens are live.
- `theme-provider.tsx:27`: `useTheme` resolves to `"dark"` when unmounted/unknown.
- `apps/web/src/app/layout.tsx:180`: `<meta name="theme-color" content="#0A0F18">` (navy) corroborates a dark-first canvas.

### 5. Contrast math — confirmed by computation (WCAG 2.x relative luminance)
- White (`#FFFFFF`) on Gold (`#CBA45E`) = **2.33:1** → fails AA normal text (needs 4.5:1) and even fails the 3:1 large-text bar.
- White on Sapphire (`#2E5FB0`) = **6.21:1** → passes AA.

Both buttons render `text-white` text whose size does not qualify as "large" for WCAG (EmptyState label is `text-sm` = 14px medium; skip-link is `text-sm` semibold = 14px bold, below the 18.66px bold large-text threshold), so the 4.5:1 normal-text requirement applies and 2.33:1 fails decisively.

## Impact
In the default (dark) theme, the primary empty-state CTA label and the keyboard skip-to-main link are very low contrast (2.33:1), making them hard to read — the skip-link in particular is the first stop for keyboard/screen-reader users and is the only accessibility affordance for bypassing nav.

## Recommendation
For accent-filled buttons, pair the Gold/Sapphire surface with a dark ink foreground (e.g. a near-`--bg` navy) instead of `text-white`, or introduce an on-accent foreground token that flips with the theme (dark ink on Gold, white on Sapphire). Verify the chosen pairing reaches >=4.5:1 in both themes.

## Severity assessment
Severity **High** retained. The defect is real, lives in shared/layout components used broadly, affects the default theme, and degrades a core keyboard-accessibility affordance (skip-link). Not Critical because both controls remain operable (the skip-link still functions; the CTA still navigates) and the issue is contrast/legibility rather than a total block.

## Related files
- apps/web/src/components/shared/empty-state.tsx:36
- apps/web/src/components/layout/app-shell.tsx:108
- apps/web/src/styles/globals.css:42, 127, 255, 296
- apps/web/tailwind.config.ts:73, 141
- apps/web/src/components/theme-provider.tsx:10
