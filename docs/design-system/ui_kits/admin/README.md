# LocateFlow — Admin UI Kit

Editorial operations console. Matches the mobile + web dialect: warm off-black ground, Bodoni Moda display with italic terracotta emphasis, Geist Mono kickers, horizontal rule-separated data density.

## What's in here
- `index.html` — full admin overview (ops metrics, users table, live activity feed, top providers)

## Core screens this kit should cover
- Overview dashboard (✓ in index.html)
- Users detail (single-user profile, addresses, billing)
- Provider catalogue management
- Moderation queue
- Incidents / system health

Only the overview is implemented right now — the others follow the same layout rules: editorial header, horizontal-rule money/metric strip, dense typographic table, italic Bodoni section heads.

## Layout rules
- Sidebar: 240px, dark-warm gradient, terracotta 2px active indicator, mono counts right-aligned
- Top bar: 60px, breadcrumb left (mono uppercase), `Prod · US-East` env chip, ⌘K search
- Content max-width: 1400px
- Money/metric cells: Bodoni 40–72px, italic terracotta for "watch" values
- Table rows: 56px, divider-only (no card chrome), Bodoni name + mono email
