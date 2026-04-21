# LocateFlow — Brand Voice & Visual Foundations

**Source:** `docs/design-system/README.md` (handoff bundle, 2026-04-21).
**Scope:** Web, Admin, Mobile — one voice, three surfaces. This file is the
canonical reference for copywriting, UI labels, and visual decisions.
Anything merged on `main` that affects user-facing text or brand surface
should pass the checks in this document.

---

## Positioning

LocateFlow is a **personal "address OS"** — one dashboard per home that
tracks every utility, bank, insurance, subscription, and service contract
attached to that address. When you move, it becomes a one-click relocation
checklist (transfer, cancel, reconnect) with state-specific rules for all
50 US states. We call ourselves a **moving companion** more than a
sub-tracker — the moving flow is the headline feature, the sub/bill
tracking is the substrate underneath.

---

## Voice & tone

**Practical and reassuring, never breathless.** Verbs over adjectives.
Short lines, no emoji. The tone assumes the reader is mid-move, stressed,
trying to cancel three things before a deadline — so every sentence gets
to the point.

### Headline formula — three beats

Three-beat phrases separated by periods, with the middle beat colored in
brand orange for emphasis:

> Every Address. **Every Service.** One Place.

### Perspective & possessives

- **Second-person.** Almost always "you"; never "we" except in FAQ
  replies ("Yes. You get...").
- **Possessives ground the product in the reader's life:** *your address,
  your home, your service list.*

### Concrete category words

**Name the things.** "Utility, bank, insurance, streaming, gym, HOA."
The copy never says "providers" in the abstract when it can list the real
categories instead.

### Casing

- **Sentence case** in body copy.
- **Title Case** on H1/H2/section headers ("How It Works", "Loved by
  Movers Everywhere").
- **Title Case** on button labels ("Start Free Trial", "Open Dashboard").

### Trust markers, not hype

Specific, verifiable, humble:

- "No credit card required"
- "Cancel anytime"
- "Your data stays available for 30 days after cancellation"
- "GDPR / CCPA compliant"

### Light playfulness, reserved

"Made with care for movers everywhere" in the footer. FAQ answers are
warm but not cute ("Yes. You get ${TRIAL_DURATION_DAYS} days free with no
credit card required.").

### Avoid

- **Emoji in UI copy.** Exclamation marks. Gen-Z phrasing.
- **"Magic", "AI-powered", "unlock", "game-changer".** The product is
  deliberately adult and boring-in-a-good-way.

### Examples to imitate

- *"Track every utility, bank, insurance, and subscription tied to each
  of your homes. Smart reminders, document OCR, and a one-click moving
  checklist when you relocate."*
- *"LocateFlow keeps a living list of every utility, bank, insurance,
  and subscription tied to each home you live in."*
- *"When you relocate, we turn your service list into a checklist:
  transfer, cancel, or reconnect with one click."*
- *"Stop paying for things you forgot about."*
- Empty-state lead-in on mobile: *"Welcome back"* / h1 *"Dashboard"*

---

## Visual foundations

### Palette — orange on near-black

The brand rests on **one accent** (LocateFlow Orange `#F97316`) against a
dark neutral canvas. Secondary amber (`#FBBF24`) appears only as a
gradient partner or for premium / streak affordances.

- **Primary** `#F97316` (orange-500)
- **Secondary / accent** `#FBBF24` (amber-400) — used in gradients
  (`[#F97316 → #FBBF24]`), premium badges, streaks, ratings.
- **Background (dark)** `#0a0a0f` (mobile) / `hsl(222 47% 6%)` (web)
- **Card** `#1a1a25` mobile, `hsl(222 47% 8%)` web. Subtle elevation,
  never pure white on dark.
- **Borders** are alpha, not opaque: `rgba(255,255,255,0.08)` default,
  `0.12` on hover/focus-adjacent.

**Light mode** inverts surfaces (`#ffffff` / `#f8fafc`) but **keeps the
brand orange** at the same hue (slightly deeper 50% lightness).
Sidebars stay dark in light mode for contrast. Treat light mode as a
courtesy; the product *ships* dark.

### Tonal category pairs

Every "tone" (orange, emerald, amber, rose, sky, cyan) ships as a
`{bg, border, text}` triplet that sits on the dark background at ~10%
alpha bg / 20% alpha border / bright text. This is the language of stat
cards, category chips, service-type indicators.

**Do not invent new tones — pick from the six.**

Canonical source: `packages/shared/src/design-tokens.ts` (`tonesDark`
/ `tonesLight`).

### Type

**Inter** for everything. **JetBrains Mono** on admin only (rarely shown
to users). Inter weights in use: 400, 500, 600, 700, 800. The `font-black`
(800) weight carries all hero numbers and stat values — they're always
tight (`tracking-tight`, `-0.02em`).

| Token | Size | Use |
|---|---|---|
| `display-lg` | 60px | Landing hero h1 |
| `display` | 40px | Section h2 on marketing |
| `3xl` | 28px | Dashboard h1, stat values |
| `2xl` | 22px | Card titles |
| `xl` | 18px | Section headings in-app |
| `lg` | 16px | Body lead |
| `md` | 15px | Quick-action labels |
| `base` | 14px | Default body, buttons |
| `sm` | 12px | Labels, stat labels, meta |
| `xs` | 11px | Captions, kbd hints |

Tailwind shortcuts: `text-brand-3xl`, `text-brand-display-lg`, etc.

### Backgrounds

Almost every hero or card sits on the dark canvas. LocateFlow's motif
is **large, soft radial blobs** of orange at 10–20% opacity behind
content (`.dark-only-blobs` class), covered by `glass` overlays
(blurred 20px). **No photographs, no illustrations in the repo** — the
brand is type + geometry + glow. Never full-bleed photos. Never
repeating textures.

### Cards

- Rounded `12px` (`--radius: 0.75rem`) on web shadcn; `16–20px` on
  mobile (`theme.radius.lg/xl`).
- Border `1px solid rgba(255,255,255,0.08)` on dark;
  `rgba(15,23,42,0.08)` on light.
- Background: `--card` (`hsl(222 47% 8%)` or `#1a1a25`). Never pure
  black.
- Shadow: subtle (`shadow-sm`) at rest; `shadow-lg` + slight translate
  on hover for marketing feature cards.
- Glass cards (landing, modals): `backdrop-blur-xl` +
  `rgba(255,255,255,0.05)` bg + `rgba(255,255,255,0.10)` border.

### Buttons

Five shadcn variants ship: `default` (orange solid), `secondary`
(amber), `outline`, `ghost`, `destructive`, `link`. Sizes
`sm / default / lg / icon` at heights `36 / 40 / 44 / 40px`. Rounded
`rounded-md` (8–10px). **Hover = 90% opacity of fill**
(`hover:bg-primary/90`), not a color shift.

Mobile `Button.tsx` has an additional `variant="gradient"` that fills
with the orange→amber gradient plus a soft `shadow-glow` — reserved for
premium / primary CTAs.

### Animations

- Easing is default/ease-out on everything.
- Durations: `200ms` transitions on cards, buttons, theme toggle.
  Accordions 200ms.
- Pulse (`animate-pulse`) on "coming soon" status dots.
- No bouncy springs. No parallax. Mobile screens rely on native
  `RefreshControl` and `activeOpacity={0.7}` for press feedback — no
  custom press animations.

### Hover & press

- **Web hover**: bg lightens 4–8% alpha (`hover:bg-white/5`), text
  → `text-foreground`, border stays.
- **Web press**: implicit focus ring — orange 2px outline at 50% alpha.
- **Mobile press**: `activeOpacity={0.7}` (native). Full-width gradient
  buttons get a shadow-glow.
- **Disabled**: `opacity-50 pointer-events-none`.

### Borders, radii, shadows

Radii: `sm 8 / md 12 / lg 16 / xl 20 / 2xl 24 / full 9999`. Pills and
avatars are `full`; cards are `md` or `lg`; large containers (pricing
cards, hero image) are `xl/2xl`.

Shadows (mobile): `sm / md / lg / glow`. The orange glow
(`shadowColor: "#F97316"`, radius 12, opacity 0.3) is reserved for
premium / active affordances — don't spray it on normal cards.

### Transparency & blur

**Glass** appears on the landing page (sticky header uses
`bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60`),
modals, and overlays. Blur values are always `blur-xl` (`20px`) or
`blur-2xl` (`40px`), never less. Use sparingly — the dashboard is
mostly solid surfaces for scannability.

### Protection gradients

The landing hero uses a
`bg-gradient-to-br from-primary/10 via-background to-primary/5` inside
a `3:4` aspect placeholder for mobile app screenshots. The pricing
page uses `from-primary/10 to-primary/5` as subtle lift. These
gradients are **always at ≤10% alpha** and always anchored to the
primary token.

### Layout rules

- Web container: `container`, centered, `2rem` padding, max `1400px`
  at 2xl.
- Landing sections alternate plain container + `bg-muted/50` bands for
  rhythm.
- Dashboard sidebar: fixed, dark (`#1e293b`-ish) even in light mode.
- Mobile tabs: bottom bar, 5 tabs (Home, Addresses, Services, Moving,
  More), each 44–48px hit target with lucide icon + label.

### Imagery vibe

**None, currently.** The repo ships zero product screenshots or stock
photos. Brand "imagery" is the logo mark (a stylized house roof made
of two flat-shaded triangles in white over orange, with a dropped
pin), an OG image, and the mobile app icon — all flat geometric SVG,
warm (orange), no grain, no gradients beyond the brand ones. If you
need imagery, use a branded placeholder or the orange-glow gradient
container.

**Never generate stock-photo-looking scenes.**

---

## Iconography

**Lucide** is the only icon library used. Both web (`lucide-react`) and
mobile (`lucide-react-native`) pull from the same set — matching stroke
weight (2px), matching geometry. Icon sizes are usually
`14 / 16 / 18 / 20 / 22 / 24` px. Icons inherit `currentColor` from
their container — never hardcode hex on an icon except the brand
orange in brand moments.

**Commonly used icons:**

- **Core product**: `MapPin` (addresses), `Zap` (services), `Truck`
  (moving), `Bell` (reminders), `DollarSign` (budget), `FileText`
  (documents), `CheckSquare` / `CheckCircle2` (tasks), `Shield`
  (security/trust).
- **Dashboard / UI**: `ArrowRight`, `ChevronDown`, `TrendingUp`,
  `Trophy`, `Star`, `Clock`, `AlertTriangle`, `Quote`.
- **No emoji.** Except two narrow mobile exceptions: `CategoryIcon`
  passes an emoji through (for state-rule step icons it gets from the
  API) and a `✦` sparkle glyph inside the "Premium" pill. Treat both
  as special-case glyphs, not part of the icon system.

### SVG assets

Located at `apps/web/public/` and `apps/mobile/assets/` — canonical
copies in `docs/design-system/assets/`:

- `logo.svg` — horizontal wordmark + mark
- `logo-mark.svg` — mark only, for favicon / compact headers
- `favicon.svg` — compact favicon variant
- `og-image.svg` — Open Graph sharing card
- `app-icon.svg` — mobile app tile

No icon font. No sprite sheet.

---

## Content checklist — before shipping any user-facing string

1. **Is it second-person and possessive?** ("your" / "you")
2. **Does it name concrete categories** instead of "providers"?
3. **Is the casing correct** (Title Case in headers, sentence case in
   body, Title Case in buttons)?
4. **Is it free of emoji, exclamation marks, and hype words**?
5. **Does it pass the mid-move-at-11pm test** — does the reader
   understand in one beat what to do next?
6. **Is it specific?** Trust markers mention exact numbers, durations,
   or compliance names — no vague "industry-leading" language.
7. **Three-beat formula** for marketing headlines? Middle beat orange.
8. **Does it ship in both EN and ES** (Sprint 3)? Never hardcode
   English once the i18n layer lands.

---

## Related canonical sources

- **Colors / type tokens** — `packages/shared/src/design-tokens.ts`
- **CSS variables** — `apps/web/src/styles/globals.css` (`--brand-*`,
  `--orange-*`, `--tone-*`, `--fs-*`)
- **Tailwind extension** — `apps/web/tailwind.config.ts` +
  `apps/admin/tailwind.config.ts` (`theme.extend.colors.brand`,
  `colors.tone`, `fontSize["brand-*"]`)
- **Mobile palette** — `apps/mobile/src/lib/theme.ts` (consumes shared
  tokens; `useAppTheme()` returns the active palette)
- **Full handoff bundle** — `docs/design-system/` (HTML prototypes,
  preview pages, UI kits, reference implementations)
