# Design ↔ Code Gap: Providers + Custom Providers

**Area:** providers
**Design sources:** `Providers.dc.html`, `CustomProviders.dc.html` (handoff `.../initial-check-requested/project/`)
**Current code:**
- Web: `apps/web/src/app/(app)/providers/providers-client.tsx` (+ `compare-view.tsx`, `[id]/detail-client.tsx`)
- Mobile: `apps/mobile/app/providers/index.tsx`, `apps/mobile/app/custom-providers/index.tsx`
- No dedicated **web** `/custom-providers` route page exists (custom providers handled inline in `services/new` + addresses/services clients).

---

## designSummary

**Providers.dc.html** — a single mobile screen (390×844 phone frame) titled **"Internet providers"** for "New York, NY 10036". It is a **focused single-category comparison picker**, not a full directory:
- Back-arrow header + category title + subtitle (location).
- Kicker: "`{count}` available · tap to compare".
- A vertical list of provider cards. Each card: emoji "logo" tile, name, type (e.g. "Fiber · no contract"), an optional **"Best pick"** badge (honey/gold), three inline stat columns — **Speed** (e.g. "940 Mbps"), **From** (price "$50/mo"), **Rating** (★ 4.6, gold) — and a circular **checkbox toggle** bottom-right to select for compare.
- A floating gradient CTA bar appears when **2+** are selected: "**Compare {n} →**".
- A **compare view** state: side-by-side cards (max 3 shown) of selected providers showing logo, name, Speed/From/Rating, with a "Back to all providers" button.
- Data is hardcoded sample (Verizon Fios, Spectrum, Optimum, AT&T Fiber) with speed/price/rating fields.

**CustomProviders.dc.html** — mobile screen titled **"Custom providers"**, subtitle "Track anything that isn't in our directory.":
- **List state:** cards with emoji icon, name, "`{cat} · {cost}`" meta, and a green **"Tracked"** pill. A dashed gold **"Add a custom provider"** button.
- **Add state:** form with "Provider name" text input, a **Category chip row** (Utilities / Home / Finance / Health / Other), an optional "Monthly cost" input, a gradient **"Save provider"** button + "Cancel".

**Theme (both files):** DARK navy surfaces (page `#06080f`, card `#0A0F1C`/`#121B2D`, tile `#18233A`), text `#EFF3FA`/`#8A99B6`/`#41526F`. **Accent = HONEY/GOLD gradient `#DCBC7C→#CBA45E→#B0852F`** with gold badges/ratings (`#CBA45E`) and one green "Tracked/success" tone (`#54CB7E`). Fonts: **Playfair Display** (serif titles), **DM Sans** (body), **DM Mono** (stat numbers).

> NOTE: These two design files do NOT use the teal/green accent (#168E9C/#1C8A63) called out in the brief — they use a **navy + honey/gold** palette. The accent delta vs. current is therefore smaller than the brief implies; the dark-navy surface shift is the dominant theme change. Flagged below as theme-T1.

## currentSummary

**Web (`providers-client.tsx`, 1111 lines)** is a far richer **full directory + recommendation engine**: address/state filter selectors, a "listed providers" warning banner, a "**Smart setup plan**" guide card (completion %, gaps, decision-model factors, setup-plan sections), an FTC-labeled **sponsored** slot, a "**Recommended for you / Top picks for {region}**" grid with dismiss + affiliate CTAs, search, category chips (with **Saved** filter), provider cards (logo, national/state-level badge, "Listed provider" badge, brand chip, coverage-confidence line, user count, website, phone, affiliate CTA), a floating **compare tray** (up to **4**), a `CompareView` modal, and state-rule info. Theme is current **LocateFlow Sapphire/Gold** light/dark via CSS vars (`tone-orange`, `tone-honey`, `tone-sky`, `primary`).

**Mobile providers (`providers/index.tsx`, 1308 lines)** mirrors web: a "PROVIDER COMMAND" hero with 4 stat tiles (catalog/matched/gaps/compare), search, truth banner, smart guide, category chips, address switcher, state-rules card, "still needed" gap chips, guided recommendation lanes, full provider cards, and a compare tray (max 4). Uses Move navy theme tokens already (`theme.colors.surface/primary/accentSoft`).

**Mobile custom providers (`custom-providers/index.tsx`)** is close to the design intent: back/title/add header, a Hero card with kicker + 3 stat tiles (saved/local/manual), search, provider cards (icon, name, category·location meta, caveat, **Tracked** pill colored by manual-tracking), a dashed **"Add a custom provider"** button. **Add/edit happens on a separate route** (`/services/new?mode=manual`), not an inline add form.

---

## Gap table

| ID | Type | Title | Design evidence | Code evidence | Severity | Decision? |
|----|------|-------|-----------------|----------------|----------|-----------|
| providers-T1 | theme | Navy + honey/gold palette, not Sapphire/Gold (and NOT teal) | `Providers.dc.html` bg `#0A0F1C`/`#121B2D`, accent gradient `#DCBC7C→#CBA45E→#B0852F`, gold ratings `#CBA45E`, mono stats DM Mono | Web uses CSS-var `primary`/`tone-orange`/`tone-honey` (LocateFlow Sapphire/Gold, light+dark) `providers-client.tsx:556,600,1088` | High | Yes |
| providers-R1 | rebrand | "Move" naming / no LocateFlow brand vs `@locateflow/shared` imports | Design copy is product-neutral ("Internet providers", "Custom providers") | `providers-client.tsx:38` imports `@locateflow/shared`; trust types `ProviderTrustSummary` | Medium | Yes |
| providers-D1 | different | Provider card shows Speed / Price / Rating stat trio + emoji logo | `Providers.dc.html:33-37` Speed `940 Mbps`, From `$50/mo`, Rating `★4.6` columns; logo = emoji tile | Web/mobile cards show category, coverage-confidence, user count, website, phone — **no speed/price/rating** fields; logo = real `logoUrl`/CategoryIcon `providers-client.tsx:988-1014` | High | Yes |
| providers-N1 | new | "Best pick" badge on top provider | `Providers.dc.html:31` gold "Best pick" pill (`p.rec`) | No "Best pick"/"Top pick" badge on provider cards; web has tier badges (Critical/Important) only on recs `providers-client.tsx:185-190` | Medium | No |
| providers-D2 | different | Compare entry = inline checkbox on card + floating "Compare {n} →" gradient bar | `Providers.dc.html:38-40` circular check toggle; `:66-70` gradient compare bar at 2+ | Web compare = separate "Compare" button per card → floating **tray** with chips → `CompareView` modal `providers-client.tsx:939-953,1046-1095`; mobile = long-press to add | Medium | No |
| providers-D3 | different | Compare cap: design shows ≤3 columns; code caps at 4 | `Providers.dc.html:92` `.slice(0,3)`; bar appears at `selCount>=2` | `MAX_COMPARE = 4` `providers-client.tsx:183`; mobile `compare-store` MAX_COMPARE 4 | Low | No |
| providers-M1 | missing | Single-category framing ("Internet providers" for one ZIP) | `Providers.dc.html:19` header "Internet providers" / "New York, NY 10036" — a per-category drilldown | Current providers screen is an **all-categories directory** with category chips; no per-category screen with this comparison layout | Medium | Yes |
| providers-M2 | missing | Inline emoji/glyph logo tiles | `Providers.dc.html:29` `font-size:20px` emoji in `#18233A` tile | Current uses `ProviderLogoMark` (real logo img or `CategoryIcon` fallback) `providers-client.tsx:215-246` | Low | No |
| providers-X1 | different | Design omits the heavy recommendation/guide chrome | `Providers.dc.html` has no smart-setup plan, sponsored slot, gaps, trust lines, affiliate CTAs | Web+mobile carry Smart setup plan, sponsored slot, recommended grid, trust/coverage lines, affiliate CTAs, state rules `providers-client.tsx:599-811` | Medium | Yes |
| providers-D4 | different | Compare CTA & primary buttons use gold gradient | `Providers.dc.html:68` `linear-gradient(135deg,#DCBC7C,#CBA45E,#B0852F)` gold; CustomProviders `:41` same | Web primary buttons use `from-primary to-primary/85` gradient (Sapphire) `providers-client.tsx:1088` | Medium | Yes |
| cprov-D1 | different | Custom-provider card meta = "{cat} · {cost}" with monthly cost | `CustomProviders.dc.html:26` `{p.cat} · {p.cost}` ($24/mo) | Mobile card meta = category · city/state + caveat; **no monthly cost** displayed `custom-providers/index.tsx:202-208` | Medium | No |
| cprov-N1 | new | Inline "Add custom provider" form (name / category chips / monthly cost) | `CustomProviders.dc.html:34-44` in-screen add form with category chip row + cost field | Mobile routes to `/services/new?mode=manual` (separate screen); no inline add form `custom-providers/index.tsx:101` | Medium | Yes |
| cprov-M1 | missing | No dedicated **web** Custom Providers page | `CustomProviders.dc.html` is a standalone screen | Web has **no** `/custom-providers` route UI; only API + inline handling in services clients (grep: no web page) | Medium | Yes |
| cprov-D2 | different | Category set in add form = Utilities/Home/Finance/Health/Other | `CustomProviders.dc.html:56` 5 fixed cats | Current uses the full merged category taxonomy (`getCategoryLabel`, many categories) `providers/index.tsx:276` | Low | No |
| cprov-D3 | different | "Tracked" pill always green | `CustomProviders.dc.html:27` green `#54CB7E` "Tracked" | Mobile pill tone = `warning` when `manualTrackingOnly`, else `success` `custom-providers/index.tsx:211-214` | Low | No |
| cprov-D4 | different | Hero stat tiles not in design | n/a (design has plain title + subtitle) | Mobile custom-providers has Hero card with saved/local/manual 3-stat block `custom-providers/index.tsx:146-159` | Low | No |
| providers-W1 | wrong | (verify) "Internet providers" name list may read as defect vs current category-agnostic copy | Design fixes one category | Current title is generic `tp("title")` — not a defect, but layout mismatch with the focused design | Low | No |

---

## Detail notes

### Theme & brand (providers-T1, providers-R1, providers-D4)
The two design files commit to a **dark navy** canvas (`#0A0F1C` surfaces, `#121B2D` cards) with a **honey/gold** accent gradient and gold ★ ratings — they do **not** use the teal/green (#168E9C) accent named in the project brief. The brand-level navy shift is real and large; the accent is closer to the existing Gold than to teal. Confirm with the design-system delta whether teal is the app-wide accent and these provider screens are an exception, or whether gold is retained for providers. Either way the current LocateFlow Sapphire `primary` and `tone-orange` focus rings need re-tokenizing. **Decision: confirm accent (teal vs gold) for provider surfaces.**

### Card information model (providers-D1) — biggest content gap
The design provider card is built around **Speed / From-price / Rating** — fields the current data model does not surface on the card. Current cards instead lead with coverage-confidence, "Listed provider"/national-vs-state badges, user counts, website, and phone. Adopting the design means either (a) sourcing speed/price/rating data per provider (likely not present for most non-internet categories) or (b) treating Speed/From/Rating as **internet-category-specific** fields. This is a product/data decision, not just styling. **Decision needed.**

### Scope mismatch (providers-M1, providers-X1)
`Providers.dc.html` is a **lean single-category comparison picker**; the current app is a **recommendation-engine-driven full directory** with smart-setup plans, sponsored slots, affiliate CTAs, trust/coverage lines, and state-rule guidance — none of which appear in the design. Treat the design as the visual target for the *card + compare interaction*, but confirm whether the rich recommendation chrome is being **kept** (most likely yes) or simplified. **Decision needed: keep current recommendation surfaces or move toward the lean design.**

### Compare interaction (providers-D2, providers-D3)
Design selects via an on-card circular checkbox and surfaces a single gradient "Compare {n} →" bar (≥2), comparing up to 3 side-by-side. Current web uses a per-card "Compare" pill → floating tray with removable chips → full `CompareView` modal (cap 4); mobile uses long-press. The current pattern is more capable; the design is simpler. Not a defect — a UX direction choice.

### Custom providers (cprov-*)
Mobile already matches much of the design (dashed add button, Tracked pill, list cards). Deltas: the design shows **monthly cost** in card meta and an **inline add form** (name + category chips + cost), whereas mobile routes to `/services/new?mode=manual`. The design's 5-chip category set is a simplification of the current taxonomy. **Web has no custom-providers page at all** — if the design implies a web equivalent, that is net-new work. **Decisions: inline add form vs route; build web custom-providers page?**

---

## openQuestions
1. Is the provider accent teal (#168E9C, per brief) or honey/gold (#CBA45E, per these design files)? The two design files use gold, conflicting with the brief.
2. Is the lean single-category comparison layout meant to **replace** the current full directory + recommendation engine, or only restyle the card/compare components within it?
3. Should provider cards surface Speed/Price/Rating (internet-specific) generally, or only for connectivity categories?
4. Should a dedicated **web** Custom Providers page be built (none exists today)?
5. Inline add-custom-provider form vs. keeping the separate `/services/new?mode=manual` route?
