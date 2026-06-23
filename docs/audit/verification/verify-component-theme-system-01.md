# Adversarial Verification — component-theme-system-01

**Finding title:** Dark-mode solid semantic badges fail WCAG contrast (white on light fills)
**Claimed severity:** High · Category: Accessibility
**Verdict: CONFIRMED** (adjusted severity: Medium)

## Mandate
Refute unless code clearly proves the finding. I read every cited file and recomputed the contrast math myself.

## What the code shows

### 1. The badge variants use white text on raw semantic fills
`apps/web/src/components/ui/badge.tsx:14-16`:
```
success: "border-transparent bg-success text-white",
warning: "border-transparent bg-warning text-white",
info:    "border-transparent bg-info text-white",
```
`text-white` = `#FFFFFF`. There is no `dark:`/`light:` modifier — the same white text rides on the fill in every theme.

### 2. The fill tokens resolve to light hues in the default (dark) theme
`apps/web/tailwind.config.ts:53-67` maps `bg-success`→`var(--success)`, `bg-warning`→`var(--warning)`, `bg-info`→`var(--info)`.

`apps/web/src/styles/globals.css:89-96` (inside the `:root, .dark` block, lines 21-22):
```
--success: #54CB7E;
--warning: #E0A85A;
--info:    #37C2C9;
```

### 3. Dark is the actual default theme
`apps/web/src/components/theme-provider.tsx:8-16` — `next-themes` with `attribute="class"`, `defaultTheme="dark"`. With `attribute="class"` the `.dark` class is applied, so the lines 89-96 tokens are live by default. `<html>` (layout.tsx:173-177) carries no hardcoded `light`/`dark` class, so the provider default governs.

### 4. Contrast math reproduced (WCAG 2.x relative-luminance formula)
White (#FFFFFF) on each fill:
| variant | fill | ratio |
|---|---|---|
| success | #54CB7E | **2.05:1** |
| warning | #E0A85A | **2.12:1** |
| info    | #37C2C9 | **2.16:1** |

Exactly matches the claimed 2.05 / 2.12 / 2.16:1. AA needs 4.5:1 (normal text) or 3:1 (large text / UI graphics). All three fail even the 3:1 floor → WCAG 1.4.3 violation.

### 5. The variant is actually rendered (not dead code)
Web usages importing `@/components/ui/badge`:
- `apps/web/src/app/(app)/services/[id]/page.tsx:119` — `<Badge variant={service.isActive ? "success" : "secondary"}>` → service active-status badge.
- `apps/web/src/app/(app)/budget/[month]/page.tsx:79` — `<Badge variant={delta < 0 ? "destructive" : "success"}>` → budget delta (financial state signal).

So the `success` variant ships in real, authenticated app surfaces. (`warning`/`info` variants exist and are theme-affected, but I found no current web `<Badge variant="warning|info">` callsite — those two are latent until used.)

## Why CONFIRMED
Every load-bearing claim checks out against source: the className string, the token values, dark-as-default, the contrast numbers, and at least one live render path. No middleware/wrapper/light-mode override rescues it — the light-mode block (globals.css:730-767) only preserves white on filled backgrounds in `.light`, which is the non-default theme and not what the finding targets.

## Severity adjustment: High → Medium
- These are small `text-xs` status pills, not primary reading content. WCAG 1.4.3 still applies, but the impact is a status-pill legibility defect, not a broad content-contrast failure.
- Only the `success` variant has a confirmed live web callsite today; `warning`/`info` are not yet used on web (the mobile `UiBadge` matches are a separate React-Native component, out of scope for this finding).
- Status is also conveyed by adjacent text labels in both callsites, so the color contrast is not the sole information channel.
Medium reflects a real, shipped, easily-fixed AA defect of limited blast radius. (If `warning`/`info` get adopted on web, the surface grows.)

## Recommendation
Darken the on-fill text for solid semantic badges in dark mode (e.g. use a near-black ink token like the existing `proSolid` pattern `text-[#0A0F18]`, or switch these three variants to the tonal soft-fill treatment already used by `sage`/`honey`/`info`-tone, which pairs a light text token with a low-alpha fill and meets contrast).

## Related files
- apps/web/src/components/ui/badge.tsx:14-16
- apps/web/src/styles/globals.css:89-96 (and 730-767 light-mode block)
- apps/web/tailwind.config.ts:53-67
- apps/web/src/components/theme-provider.tsx:8-16
- apps/web/src/app/(app)/services/[id]/page.tsx:119
- apps/web/src/app/(app)/budget/[month]/page.tsx:79
