# Design ↔ Code Gap — Marketing (home, features, blog, why-free)

**Area:** marketing
**Design source (read in full):** `…/initial-check-requested/project/` — `Index.dc.html` (project map / hub), `Move Web.dc.html` (the actual marketing **home**), `Web.dc.html` (web router shell), `Web Features.dc.html`, `Web Blog.dc.html`, `Web Why-Free.dc.html`.
**Current source:** `apps/web/src/app/{page.tsx,features,blog,why-free,how-it-works,pricing}/`, `components/marketing/{marketing-header,marketing-footer,logo,public-page-shell}.tsx`, `styles/globals.css`, `styles/aurora.css`; inventory `docs/ui-renewal/10_WEB_PUBLIC_PAGES.md`.

> Note on file naming: `Index.dc.html` is **not** the marketing landing — it is the designer's internal "project map" hub linking every mockup. The marketing **home** is `Move Web.dc.html`, routed inside `Web.dc.html`. This report treats `Move Web.dc.html` as the home design and calls out `Index.dc.html` only as a non-shippable index.

---

## designSummary

The new design is a **dark-navy marketing site for "Move — Relocation Intelligence", positioned "100% free, no subscription, ever."** Palette: background `#070B14`, surface `#121B2D`, **gold accent `#CBA45E`** (gradient `#DCBC7C → #CBA45E → #B0852F`) as the dominant brand color, with teal `#37C2C9`, green `#54CB7E`, amber `#E0A85A`, red `#E25C5C` as **category/data-state accents**. Typography: **Playfair Display** (serif display, weights 800/900) for headings + **DM Sans** body + DM Mono. A **Raccoon mascot** (`dc-import name="Raccoon"`) is the logo lockup everywhere (nav, footer, "simple for anyone" band). Brand lockup reads "**Move**" with a small "**by LocateFlow**" byline in the footer only.

Pages:
- **Home (`Move Web.dc.html`):** sticky-less nav (Features / How it works / Always free + Log in + "Get the app"); hero with "Relocation Intelligence" pill, shimmering serif "Your entire move, **handled.**", dual CTA ("Start your move — free" / "See how it works"), trust line (★★★★★ 4.9 · FEMA·EPA·NWS); an **interactive phone demo** with a "😣 Rough home / 😎 Dream home" toggle that re-renders the embedded `Move` app dossier; "How Move works — in 3 steps"; a **Home Dossier band** showing 6 `DossierScene` data cards (Area/Weather/Water/Transit/Air/Housing) that react to rough/dream state; split "Never miss a utility transfer" + "Every address, mapped" (animated SVG route map); 3-up AI Briefing / Reminders / Budget; a mascot "No spreadsheets…" reassurance band; "Always free — Everything's included" feature checklist (9 items, fed from a `@SYSTEM-INTEGRATION` comment that says to wire the real free-feature registry); testimonials (3); FAQ (4); gold CTA banner ("Your move starts today", iOS/Android buttons); footer with Move mascot + "by LocateFlow".
- **Features (`Web Features.dc.html`):** centered hero "Everything your move needs — in one free app"; **2-col grid of 8 feature cards** with emoji tiles (Home Dossier, Service transfers, Real address maps, Daily AI briefing, Smart reminders, Move budget, Provider compare, Share your move); a full-width gold CTA card "All of it, free. Start today. → Download Move".
- **Why-Free (`Web Why-Free.dc.html`):** centered hero "Moving is stressful enough. The app shouldn't cost you." + **"100% free… small optional referral"** body; a 2-col grid of **4 check-points**; single gold CTA "Start your move — free".
- **Blog (`Web Blog.dc.html`):** "Moving guides" eyebrow + serif "Free guides to make your move effortless"; **wide featured card** (Featured · Planning, emoji `📦`); **3-col grid of 6 guide cards** with emoji thumbnail tiles, category pills, "N min read · date" meta.

## currentSummary

Current implementation is **"LocateFlow"** (Sapphire-blue in light mode / navy+gold in dark mode), a Next 16 token-driven marketing site. Dark theme `--background: 218 43% 6%` (≈#0A0E14 navy, very close to design `#070B14`) and `--primary: 38.53 51% 58%` (≈#CBA45E **gold — already matches the design accent in dark mode**); **light mode primary is `217 58% 43%` sapphire blue.** Font display is Playfair Display (matches). The logo is a raster `logo-mark.svg` + wordmark text "**LocateFlow**" — **no raccoon mascot in the brand lockup** (a separate `RaccoonReading` illustration exists, used decoratively on home how-it-works + blog only).

Pages:
- **Home (`page.tsx`):** much **larger** than the design — hero (matches design copy/structure: "Relocation Intelligence" pill, "Your entire move, handled." shimmer, dual CTA, trust chips, `HeroPhoneShowcase`); **scope strip**; `RecognitionChipStorm`; `HardStats`; **5-card risk grid** ("what goes to your old address"); `MovingMomentMock`; 6-card features grid; `DossierShowcase`; how-it-works (3 steps, with RaccoonReading); flag-gated connector + family/workspace sections; `BilingualShowcase`; `SocialProof`; `PricingSection` (Free + Concierge/Business); `LatestBlogPosts`; scope coverage (3); FAQ `<details>`; `EarlyAccessCapture`; mobile-app CTA + `MobileMockup`; gold final CTA. Copy still says "**LocateFlow** tracks every utility…".
- **Features (`features/page.tsx`):** `PublicPageShell`, **3 grouped sections × 3 cards = 9 features** (lucide icons, not emoji), grouped Plan/Track/Operate; Sparkles CTA + a "Trust boundary" disclaimer section.
- **Why-Free (`why-free/page.tsx`):** `PublicPageShell`; **3 principle cards** ($0 core / optional partner economics / no hidden account action) + a 4-item "what users should know" check list + Sparkles CTA. Copy is conservative/legalistic, **no "100% free" headline**.
- **Blog (`blog/page.tsx`):** already **reskinned to the design** — "Moving guides" eyebrow, serif "Free guides to make your move effortless", featured split card, 3-col grid with emoji-gradient fallback tiles, category pills, "N min read · date". Data-driven (real posts) + RSS + pagination + empty state.
- **How-it-works** and **Pricing** exist in code but have **no design counterpart** in the marketing handoff (design folds how-it-works into the home "3 steps" band and replaces pricing with the "Always free" band).

---

## Gap table

| ID | Type | Title | Design evidence | Code evidence | Severity | Decision? |
|----|------|-------|-----------------|----------------|----------|-----------|
| marketing-01 | rebrand | Product name "Move" vs "LocateFlow" | `Move Web.dc.html:45` wordmark "Move"; footer ":265" "Move **by LocateFlow**"; all pages headline "Move" | `logo.tsx:50` Wordmark text "LocateFlow"; `footer:23,69`; `seo.ts:3` `SITE_NAME="LocateFlow"`; home hero copy `page.tsx:228` "LocateFlow tracks…" | High | Yes |
| marketing-02 | new | Raccoon mascot as the logo mark | `Move Web.dc.html:44,197,265` `dc-import name="Raccoon"` in nav/footer/reassure band; dedicated `Raccoon.dc.html` | `logo.tsx:14-24` LogoMark = raster `/logo-mark.svg`; `RaccoonReading` exists but only as decorative illustration (home/blog), not the brand mark | High | Yes |
| marketing-03 | theme | Light-mode palette is Sapphire, design is navy-only | Design has a single dark navy theme (`#070B14`), gold accent, no light variant | `globals.css:380-390` `.light` `--background:220 23% 96%`, `--primary:217 58% 43%` (sapphire); `aurora.css:507-514` | High | Yes |
| marketing-04 | different | Home page is far larger / different section set than design | `Move Web.dc.html`: ~11 sections (hero, 3-step, dossier band, services+map split, AI/Reminders/Budget trio, reassure, Always-free checklist, testimonials, FAQ, CTA) | `page.tsx`: ~16 sections incl. scope strip, RecognitionChipStorm, HardStats, 5-card risk grid, MovingMomentMock, DossierShowcase, connector/family flag sections, BilingualShowcase, SocialProof, PricingSection, LatestBlogPosts, EarlyAccessCapture, MobileMockup | Medium | Yes |
| marketing-05 | missing | "Always free — Everything's included" feature checklist band | `Move Web.dc.html:207-223` "Always free" eyebrow + "Everything's included — no subscription" + 9-item check grid (`freeFeatures`) | Home has `PricingSection` (Free + Concierge/Business tiers) instead; no equivalent "always free 9-item checklist" band | Medium | No |
| marketing-06 | missing | Rough-home / Dream-home interactive demo toggle | `Move Web.dc.html:75-83,287-312` pill toggle "😣 Rough home / 😎 Dream home" re-renders embedded `Move` dossier + hero cards | `HeroPhoneShowcase` exists (`page.tsx:264`) — needs verification it has the rough/dream toggle; not visible in page.tsx props | Medium | No |
| marketing-07 | missing | Animated address route-map SVG ("Every address, mapped") | `Move Web.dc.html:165-175` SVG with animated dashed gold route, Austin→NYC pins | No equivalent on `page.tsx`; features list a "Real address maps" tile but no animated map mock | Low | No |
| marketing-08 | different | Features page: 8 emoji cards (2-col) vs 9 lucide cards (3 grouped sections) | `Web Features.dc.html:48-57` flat 8-item array, emoji tiles, 2-col; hero "Everything your move needs — in one free app" | `features/page.tsx:26-51` 3 groups × 3 lucide-icon cards; hero "Everything tied to the move, finally in one place." + extra "Trust boundary" section | Medium | No |
| marketing-09 | different | Why-Free copy & structure: marketing "100% free" vs conservative legal framing | `Web Why-Free.dc.html:22-23` "Moving is stressful enough… **Move is 100% free** — no subscription, no trial, no credit card." + 4 plain check-points | `why-free/page.tsx:14-44` 3 principle cards (incl. "Optional partner economics", "No hidden account action") + 4 caveat-style checks; headline "Free because the move should start before the checkout page." | Medium | Yes |
| marketing-10 | rebrand | Hero & body copy say "LocateFlow", design says "Move" | `Move Web.dc.html:63` "Move tracks every utility…"; `:30` "Move — Relocation Intelligence" | `page.tsx:228` "LocateFlow tracks every utility, address and deadline" | Medium | Yes |
| marketing-11 | different | Features copy/order differs (Provider compare, Share your move, Daily AI briefing as 1st-class tiles) | `Web Features.dc.html:49-56` Home Dossier, Service transfers, Real address maps, **Daily AI briefing**, Smart reminders, Move budget, **Provider compare**, **Share your move** | `features/page.tsx` items: Moving command center, Guided task flow, Reminders, Addresses & services, Provider discovery, Dossier context, Global search, Exports, Household workspace — different naming & no "AI briefing" tile | Medium | No |
| marketing-12 | theme | Emoji feature/category tiles vs lucide icon tiles | Design uses emoji glyphs in colored tiles on Features (`✨🧭⚡📍🧠🔔💰🔎👥`) and Blog (`🔌🏛📦📱💰🗽`) | `features/page.tsx` lucide icons; `blog/page.tsx:36-47` already uses an emoji map for fallback tiles (blog matches; features does not) | Low | No |
| marketing-13 | missing | Footer "by LocateFlow" byline + Move mascot lockup | `Move Web.dc.html:265` Raccoon mark + "Move" + faint "by LocateFlow"; minimal footer (Privacy/Terms/Support/© 2024) | `marketing-footer.tsx`: LogoMark + "LocateFlow", large 4-column footer (Product/Legal/Help) — much bigger; no "Move by LocateFlow" lockup | Low | Yes |
| marketing-14 | different | Nav items: design = Features/How it works/Always free; code = Features/Why free/Pricing/Help/Blog/FAQ | `Web.dc.html:86` links `[Features, Why free, Guides]`; `Move Web.dc.html:324` navLinks `[Features, How it works, Always free]` | `marketing-header.tsx:15-22` 6 links incl. Pricing, Help, FAQ | Low | No |
| marketing-15 | different | Pricing surface: design replaces it with "Always free" band; code keeps a Pricing page + PricingSection with Concierge/Business | Design has no pricing page; home "Always free" band + Why-Free "100% free" copy | `pricing-section.tsx:368-407` Concierge + Business placeholder tiers; `pricing/page.tsx` exists | Medium | Yes |
| marketing-16 | new | "How Move works — in 3 steps" lives only on the home; design has no standalone how-it-works page | `Move Web.dc.html:106-120,331-335` 3-step band on home | `how-it-works/page.tsx` is a full standalone page (4 steps + pillars + "typical week"); home also has a 3-step section | Low | Yes |
| marketing-17 | missing | Home Dossier band with 6 reactive `DossierScene` cards | `Move Web.dc.html:122-143,298-312` "Home Dossier — Know your new home before you arrive" + 6 cards (Area/Weather/Water/Transit/Air/Housing) reacting to rough/dream | `DossierShowcase` component exists (`page.tsx:372`) — needs verification it renders the same 6-card reactive band | Low | No |
| marketing-18 | different | Theme-color meta navy matches, but design ships **dark-only**; code defaults can render light | `Web.dc.html:12` `<meta theme-color #070B14>` | `page.tsx` uses tokens; `next-themes` allows light → sapphire (see marketing-03) | Low | Yes |
| marketing-19 | wrong | Hero trust chip "Web, iOS and Android" added in code, not in design hero | Design hero trust line `Move Web.dc.html:69`: only "★★★★★ 4.9 on the App Store" + "FEMA · EPA · NWS data" | `page.tsx:255-258` adds a 3rd chip "Web, iOS and Android" | Low | No |
| marketing-20 | new | `Index.dc.html` is a designer project-map hub, not a shippable page | `Index.dc.html` whole file — links to every mockup, "Next integration step" note | No code equivalent (correctly — internal artifact) | Low | No |

**Stats:** High 3 · Medium 8 · Low 9 · decisionNeeded 9.

---

## Detail

### marketing-01 / -10 / -13 — Rebrand "LocateFlow" → "Move (by LocateFlow)" [DECISION]
The single biggest delta. Every design surface brands the product **"Move"** (Playfair serif wordmark) with the legacy "LocateFlow" demoted to a footer byline ("Move **by LocateFlow**"). Code is "LocateFlow" everywhere: `Wordmark` text (`logo.tsx:50`), footer (`footer:23,69`), `SITE_NAME`/`SITE_TITLE` (`seo.ts:3-4`), hero body copy (`page.tsx:228`), plus dozens of in-copy "LocateFlow" mentions across features/why-free/how-it-works/blog metadata and FAQ answers (`page.tsx:128-142`). **Decision needed:** is this a full product rename (legal name, domain, store listings, structured-data publisher, all copy, OG images) or marketing-surface only? This cascades into every marketing page, SEO metadata, JSON-LD `Organization`/`SoftwareApplication`, and the mobile app.

### marketing-02 — Raccoon mascot becomes the logo [DECISION]
Design uses the `Raccoon` component as the **brand mark** in nav, footer, and the "simple for anyone" band (`Move Web.dc.html:44,197,265`); there's a dedicated `Raccoon.dc.html`. Code has a generic raster `logo-mark.svg` (`logo.tsx`) and only uses `RaccoonReading` as a decorative illustration on the home how-it-works section and the blog. Decision: adopt the raccoon as the official logo mark across web (and mobile/PWA icons `icon-192/512`)?

### marketing-03 / -18 — Theme: drop Sapphire light mode? [DECISION]
Design is **dark-navy only** (`#070B14` + gold `#CBA45E` + teal/green/amber/red data accents). Code's **dark** theme already matches well (`--background:218 43% 6%`, `--primary` ≈ gold #CBA45E). But code ships a **light mode** whose `--primary` is **sapphire `217 58% 43%`** (`globals.css:389`, `aurora.css:513`), and `next-themes` lets users land there. The "Sapphire/Gold" brand the task references is the **light-mode** identity. Decision: does the rebrand remove light mode entirely (design implies dark-only), or keep light mode but recolor its primary from sapphire to the gold/teal family? Note: the brief's stated rebrand accents `#168E9C/#1C8A63/#2A8E66` (teal/green) do **not** appear literally in the design files — the design's dominant accent is gold `#CBA45E`, with teal `#37C2C9` / green `#54CB7E` as secondary. Confirm the intended primary accent before retokenizing.

### marketing-04 / -05 / -15 — Home composition & "Always free" vs Pricing [DECISION]
The design home is leaner and **monetization-free**: it ends the pricing conversation with an "Always free — Everything's included" 9-item checklist band (`Move Web.dc.html:207-223`) and a gold "Your move starts today · 100% free" CTA. The code home is a much denser funnel that **keeps a `PricingSection`** (Free + Concierge + Business tiers, `pricing-section.tsx:368-407`) and adds many sections absent from the design (RecognitionChipStorm, HardStats, 5-card risk grid, MovingMomentMock, BilingualShowcase, SocialProof, EarlyAccessCapture, MobileMockup, flag-gated connector/family). The design's own `@SYSTEM-INTEGRATION` comment (`Move Web.dc.html:208`) explicitly says to feed the real free-feature registry into the checklist and only re-introduce a paid grid "if the product ever adds a paid tier." **Decision:** does the rebrand drop the Pricing page + Concierge/Business positioning in favor of pure "100% free," and prune the extra home sections — or keep them and just retheme? This is a product-positioning call.

### marketing-06 / -17 — Interactive rough/dream demo + reactive dossier band
The design's signature interaction is a **"Rough home / Dream home" toggle** that re-renders both the embedded phone app and the 6-card Home Dossier band with opposite data states (`Move Web.dc.html:75-83,287-312`). Code has `HeroPhoneShowcase` and `DossierShowcase` components that appear to cover these, but `page.tsx` doesn't expose the toggle props — **verify** both client components implement the rough/dream switch and the 6 scene types (area/weather/water/transit/air/housing/cost) the design enumerates.

### marketing-07 — Animated address route map
Design "Every address, mapped" card embeds an animated dashed-gold SVG route between Austin and NYC pins (`Move Web.dc.html:165-175`). No equivalent mock on the code home; the address feature is only a text tile. Low severity (decorative).

### marketing-08 / -11 / -12 — Features page divergence
Design Features = a flat **8-card, 2-col, emoji-tile** grid with consumer-friendly names (Home Dossier, Service transfers, Real address maps, Daily AI briefing, Smart reminders, Move budget, Provider compare, Share your move) and a single gold "All of it, free" CTA. Code Features = **9 cards in 3 grouped `PublicSection`s** with lucide icons, more operational naming (Moving command center, Guided task flow, Global search, Exports…), plus an extra "Trust boundary" legal section. The copy, grouping, iconography, and CTA styling all differ. (Blog, by contrast, already matches the design — see below.)

### marketing-09 — Why-Free tone [DECISION]
Design leads with an emotional consumer promise: **"Move is 100% free — no subscription, no trial, no credit card"** + 4 plain reassurances (`Web Why-Free.dc.html:22-23,40-45`). Code leads with a cautious, legal-leaning explanation ("Optional partner economics", "No hidden account action", caveats that guides are "not legal, tax, insurance… advice"). Both are defensible; the rebrand's "100% free" voice favors the design's framing. Decision: align Why-Free copy/voice (and headline) to the design, balancing against compliance language the current copy was written to satisfy.

### marketing-14 / -16 / -19 — Nav, how-it-works, trust chips
Minor: design nav is 3 items (Features / How it works / Always free); code nav is 6 (adds Pricing, Help, FAQ). Design has no standalone how-it-works/pricing pages (folds into home). Code added a third hero trust chip ("Web, iOS and Android") not in the design hero. These are small alignment items; how-it-works/pricing retention is tied to the marketing-15/-16 product decisions.

### Blog — already aligned (no gap beyond rebrand/theme)
`blog/page.tsx` was explicitly reskinned to `Web Blog.dc.html`: matching "Moving guides" eyebrow, serif "Free guides to make your move effortless", featured split card, 3-col grid, emoji-gradient fallback tiles, category pills, "N min read · date" meta. The only residual deltas are the global rebrand (RSS title "LocateFlow Blog", metadata `siteName:"LocateFlow"`) and theme (covered by marketing-01/-03), plus the known `#37C2C9` info-fallback hex noted in the inventory.

---

## Open questions
1. **Rename scope:** full product rename to "Move" (legal/domain/store/SEO/mobile) or marketing-surface only? (marketing-01/-10/-13)
2. **Light mode:** does the rebrand go dark-only, or keep a light theme retokened off sapphire? And is the intended accent gold `#CBA45E` (per design files) or the teal/green `#168E9C/#1C8A63` set named in the brief? (marketing-03/-18)
3. **Monetization:** drop the Pricing page + Concierge/Business tiers for a pure "100% free" story, or retain them? (marketing-04/-05/-15)
4. **Home pruning:** keep the extra code-only sections (RecognitionChipStorm, HardStats, risk grid, MovingMomentMock, BilingualShowcase, SocialProof, EarlyAccessCapture, MobileMockup, flag-gated connector/family) or trim toward the leaner design? (marketing-04)
5. **Raccoon as logo:** promote the raccoon mascot to the official brand mark across web + PWA icons? (marketing-02)
6. **Verify** `HeroPhoneShowcase` + `DossierShowcase` implement the rough/dream toggle and 6 reactive dossier scenes. (marketing-06/-17)
</content>
</invoke>
