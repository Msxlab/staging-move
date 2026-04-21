# LocateFlow — Mobile UI kit

Expo / React Native / NativeWind. Dark-first. Tab bar with five tabs: Home, Addresses, Services, Moving, More.

`index.html` is a static pixel-match recreation of the two most-loaded screens — Dashboard and Services — built from `apps/mobile/app/(tabs)/index.tsx`, `apps/mobile/app/(tabs)/services.tsx` and `apps/mobile/src/lib/theme.ts` (in `reference/codebase/`). All colors, radii, and shadow behavior come from the real theme object — don't substitute.

Patterns:
- **Stat grid** is 2×2 with six tonal pairs (orange, emerald, amber, rose, sky, cyan) — never grayscale.
- **Active plan card** gets the orange `shadow-glow`; normal cards do not.
- **Service rows** lead with a 40×40 rounded-12 tinted icon tile; category tint picked from the same six tones.
- **Premium affordance** is `✦` + "Premium" in an amber pill — the only exception to the "no emoji/glyph" rule.
