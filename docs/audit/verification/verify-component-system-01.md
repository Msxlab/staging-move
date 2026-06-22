# Adversarial Verification: component-system-01

**Finding:** No shared UI primitive package; three parallel component systems
**Original severity:** High · **Category:** Architecture
**Verdict: CONFIRMED** (adjusted severity: Medium)

## Task
Refute the prior auditor's claim. Default to refuted/uncertain unless code proves it.
Outcome: the code proves it. All four sub-claims hold against source.

## Evidence examined (source only)

### 1. Web primitives exist and are consumed
`apps/web/src/components/ui/` contains 13 primitive files: `badge.tsx`, `button.tsx`,
`card.tsx`, `dialog.tsx`, `input.tsx`, `label.tsx`, `password-input.tsx`, `select.tsx`,
`separator.tsx`, `skeleton.tsx`, `status-badge.tsx`, `textarea.tsx`, `category-icon.tsx`.
- `apps/web/src/components/ui/button.tsx:6` — Radix `Slot` + `class-variance-authority`
  `buttonVariants` cva with web-specific variants (`foil`), focus ring via
  `focus-visible:ring-2`.
- `apps/web/src/components/ui/input.tsx:5` — `React.forwardRef` over `<input>` with
  Tailwind class string.
- Consumed by 28 files under `apps/web/src/` (grep `components/ui/button` / `@/components/ui`).
  Not dead code.

### 2. Admin has no ui/ dir, no shared primitive, raw HTML elements
- `apps/admin/src/components/ui/` does NOT exist (directory listing returns nothing).
- No `Button*.tsx` or `Input*.tsx` primitive file anywhere under `apps/admin/src`
  (`find -iname` returns nothing).
- Zero imports of `components/ui` in admin (grep returns 0 import lines; the only
  `apps/web/...` hits are path references inside comments, e.g.
  `apps/admin/src/app/api/auth/login/route.ts:102`).
- Admin renders raw elements directly: **442** `<button>` and **216** `<input>`
  occurrences across **72** files. Example:
  `apps/admin/src/app/(admin)/billing/billing-client.tsx:116` —
  `<button ... className={\`px-4 py-2 text-xs font-semibold uppercase ...\`}>` —
  ad-hoc inline Tailwind, no shared variant/focus contract.

### 3. Mobile primitives are a third, independent system
`apps/mobile/src/components/ui/` holds React-Native primitives exported via
`index.ts` (`Button`, `Card`, `Input`, `Badge`, `Avatar`, `EmptyState`, ...).
- `apps/mobile/src/components/ui/Button.tsx:1` — `TouchableOpacity` / `Text` /
  `ActivityIndicator` + `react-native-reanimated` + `expo-linear-gradient`. Props
  (`title`, `onPress`, RN variants/sizes) share nothing with the web API
  (`React.ButtonHTMLAttributes`).
- `apps/mobile/src/components/ui/Input.tsx:1` — RN `TextInput` with its own
  `label`/`error`/`hint`/`isPassword` API.

### 4. Shared package exports logic/tokens only — no React components
- `packages/shared/src/index.ts` exports validators, types, design-tokens, billing,
  permissions, recommendation-engine, etc. — all logic.
- **0** `.tsx` files exist under `packages/shared/src` (`find -name "*.tsx"` = 0).
- `packages/shared/src/design-tokens.ts` header states explicitly: "Web and admin
  don't import at runtime; their globals.css mirrors these values manually" and the
  mobile app "is the only runtime consumer of this file." Confirms tokens are
  duplicated, not a shared component layer.
- Admin's 36 `@locateflow/shared` imports are all logic modules (none are components,
  since none exist).

## Conclusion
Three genuinely independent primitive implementations: web (Radix + CVA `<button>`),
mobile (RN `TouchableOpacity` + reanimated), admin (inline raw `<button>`/`<input>`
with ad-hoc Tailwind). No shared React component package. Every primitive named in the
finding (button, input, select, dialog, empty state, badge, card) is implemented 2–3x
with independent styling, focus, and a11y behavior. The finding is **CONFIRMED**.

## Severity adjustment
The factual claim is fully accurate. However the impact is maintainability /
consistency, not a runtime defect, security, or data risk. Cross-platform web vs.
React-Native primitives cannot in fact be unified into one component (different
renderers), so the realistically shareable surface is web↔admin only. Recommend
**Medium** rather than High: real and pervasive (72 admin files, 442 raw buttons),
but it degrades developer velocity and parity, not correctness or security.

## Recommendation
Introduce a web-shared primitive layer (e.g. a `packages/ui-web` or have admin import
`apps/web/src/components/ui` via a workspace alias) so web and admin share button,
input, dialog, badge, card, empty-state with one focus/a11y/variant contract. Mobile
remains a separate RN implementation but should at minimum keep prop/variant naming
parity with the web primitives. Keep `design-tokens.ts` as the single token source and
stop manually mirroring it in `globals.css`/`aurora.css` where feasible.

## Related files
- apps/web/src/components/ui/button.tsx, input.tsx, select.tsx, dialog.tsx, badge.tsx, card.tsx
- apps/admin/src/components/ (no ui/ subdir) — e.g. billing-client.tsx, data-table-page.tsx
- apps/mobile/src/components/ui/Button.tsx, Input.tsx, index.ts
- packages/shared/src/index.ts, design-tokens.ts
