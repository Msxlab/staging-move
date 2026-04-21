# LocateFlow — Web UI kit

Next.js 15 App Router + Tailwind + shadcn/ui. Dashboard layout is a fixed-left sidebar (`#0f172a`), topbar with search + bell + primary CTA, and a centered content column capped at ~1280px.

`index.html` recreates the logged-in dashboard — stat grid, plan banner, addresses list, upcoming charges. Colors/tokens come from `apps/web/src/styles/globals.css` (in `reference/codebase/`). Cards are `hsl(222 47% 8%)` with a 1px `rgba(255,255,255,0.08)` border — no heavy shadows. The plan banner is the only place a gradient is used.

Patterns:
- **Primary action** is always filled orange; secondary is outline/ghost against the dark surface.
- **Stat card** = small tinted icon tile + label + 32px value + tiny delta line.
- **Rows** (addresses, upcoming charges) use a 44×44 lead icon, two-line body, right-aligned numeric meta.
- The **orange dot on the bell** is the notification indicator. Don't use a number badge on the web — that's mobile-only.
