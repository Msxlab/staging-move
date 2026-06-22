# Onboarding — Design ↔ Code Gap Analysis

**Area:** onboarding (mobile + web) · **Type:** GAP ANALYSIS ONLY (no code changes).

**Sources**
- NEW design (source of truth):
  - `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Onboarding.dc.html` (mobile, 390×844 phone frame, 7 steps 0–6)
  - `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Web Onboarding.dc.html` (web, 520px card, 4 steps)
  - `Raccoon.dc.html` (parametric mascot used by both)
- CURRENT implementation:
  - Web: `apps/web/src/app/onboarding/onboarding-client.tsx` (2343 lines), `aurora-aside.tsx`, `layout.tsx`, `page.tsx`
  - Mobile: `apps/mobile/app/onboarding.tsx` (2733 lines), `apps/mobile/src/components/onboarding/*`
  - Inventory: `docs/ui-renewal/13_MOBILE_SCREENS.md`, `docs/design-sync/01_DESIGN_SYSTEM_DELTA.md`

> Brand/theme note (from `01_DESIGN_SYSTEM_DELTA.md`): the design's onboarding accent is **Gold `#CBA45E`** on navy `#0A0F1C/#070B14` — identical hue to current LocateFlow Gold. The brief's "teal/green primary (#168E9C/#1C8A63/#2A8E66)" is NOT used as the accent in either onboarding mockup; the gradient CTA, progress bar, and selection states are all Gold. So theme deltas here are mostly the rebrand wordmark + radius, not a color swap.

---

## designSummary

**Mobile (`Onboarding.dc.html`)** is a self-contained 7-step wizard inside a phone frame:
- **Step 0 — Welcome:** floating Raccoon mascot tile (104px, gradient navy chip), "Move" wordmark (Playfair 900, 42px) + "RELOCATION INTELLIGENCE" gold eyebrow, value prop subtitle, three blinking gold dots, CTA "Get started", and an "Already have an account? Sign in" link. No progress bar on this step.
- **Step 1 — Account:** "Create your account" + email/password inputs, "or" divider, **Continue with Apple** (white btn, Apple mark) + **Continue with Google** (navy btn, 4-color G), and an inline Terms/Privacy consent checkbox. This is INSIDE the onboarding flow.
- **Step 2 — Profile ("What's your move?"):** 4 large icon radio cards — Renting (🔑) / Buying (🏡) / Relocating for work (💼) / Student move (🎓). Single-select.
- **Step 3 — Addresses ("Where are you moving?"):** "Current home" (green dot) + "New home" (gold dot) address inputs with a down-arrow connector, and a gold "free dossier" info banner (flood, schools, air & more).
- **Step 4 — Services ("What should we track?"):** wrap of 8 gold pill toggles (Electric/Water/Gas/Internet/Mail-USPS/DMV/Insurance/Subscriptions), "N selected · you can change these later".
- **Step 5 — Move details ("When's the big day?"):** Move date row (calendar icon, "Sep 15, 2024") + Household size segmented control (1/2/3/4+).
- **Step 6 — Done:** "approved"-mood Raccoon, "You're all set", "48 days to New York", three result chips (48 days / N services / Dossier ✓).
- Chrome: status bar, **5-segment** progress bar (gold gradient) + back button shown only on steps 1–5, "{step}/5" counter, gradient gold footer CTA whose label changes per step (Get started / Continue×4 / Finish setup / Enter Move). Fonts Playfair + DM Sans; bg `#0A0F1C`; navy surfaces `#121B2D`.

**Web (`Web Onboarding.dc.html`)** is a centered 520px glass card, **4 steps**, dark navy `#070B14`:
- Header: small Raccoon chip + "Move" wordmark + "Step N of 4"; gold gradient progress bar.
- **Step 1:** "Create your free account" / "No subscription, ever." — Full name + Email inputs.
- **Step 2:** "Where are you moving?" — Current address / New address / Move date inputs.
- **Step 3:** "What should we track?" — 6 service pill toggles (Electric/Water/Gas/Internet/Mail/DMV).
- **Step 4:** "You're all set" — approved Raccoon, "48 days to New York".
- Footer: Back + gradient gold CTA (Continue / Finish / Enter Move). No OAuth, no plan picker, no household, no profile-type cards on web.

---

## currentSummary

**Web (`onboarding-client.tsx` + `layout.tsx` + `aurora-aside.tsx`):** 4-step wizard — **Profile → Address → Services → Moving** — rendered as a `max-w-2xl` centered column under a `Wordmark` header with subtitle "Let's set up your account". At ≥lg, a split-screen "Aurora" brand aside (`AuroraAside`) shows blobs, a per-step Raccoon illustration (`RaccoonHero`/`RaccoonReading`), an editorial serif quote, an ordered step list, and a "no billing in onboarding" footnote. Account creation is NOT here — it lives in separate `/sign-up` auth routes; onboarding assumes an authenticated user (`layout.tsx` `requireDbUserId`). Step 0 Profile is a rich form (names, age range, family status, children/pets/cars/senior/storage/motorcycle/boat, sensitive opt-in for disability/immigration, move type) plus an inline `LegalConsentPanel`. Step 1 Address uses Google autocomplete + state/ZIP validation. Step 2 Services has a "compiling your starter plan" ritual, recommended-provider engine, search, category filter, add-all-essentials, billing inputs. Step 3 Moving asks wantsToMove, destination autocomplete + date, then either a paid create-plan flow or a free `MoveTeaserCard` + `ObProShowcase`. Per-step `ObCoach` explainer. Completion routes to `/dashboard` or `/moving/plan/{id}`. Theme via shadcn tokens (`bg-foreground/5`, `border-border`, `text-primary`, `tone-orange-*`).

**Mobile (`apps/mobile/app/onboarding.tsx`):** Same 4 steps (`STEP_KEYS` = profile/address/services/moving). Header shows a `MoveRaccoon` (mood flips to "approved" on last step), step rail with dots/labels, `{step+1}/4` pill, `MoveProgressBar` (gold gradient), collapsing header on scroll. Account/auth is separate (`(auth)/sign-up.tsx`). Profile/Address/Services/Moving mirror web (rich profile fields, autocomplete, provider picker, teaser/ProShowcase). Adds a **`NotificationPrimingCard`** on the final step and a push soft-prompt before routing to the app. No in-flow Welcome hero or dedicated Done/celebration step. Theme via `useAppTheme()` tokens; raccoon mascot is the identity.

---

## Gap table

| ID | Type | Title | Design evidence | Code evidence | Severity | Decision? |
|---|---|---|---|---|---|---|
| onboarding-01 | rebrand | "Move" wordmark / "Relocation Intelligence" replaces LocateFlow | `Onboarding.dc.html:57-58` Playfair "Move" + gold "RELOCATION INTELLIGENCE"; `Web Onboarding.dc.html:17` | web `layout.tsx:47` `<Wordmark>` (LocateFlow); legal gate copy "Accept these before using **LocateFlow**" `onboarding-client.tsx:1222` | High | Yes |
| onboarding-02 | new | In-flow Welcome / hero step (step 0) | `Onboarding.dc.html:50-66` floating raccoon tile, wordmark, value prop, blinking dots, "Get started" | No current equivalent inside onboarding; web has the `AuroraAside` rail but no welcome step; mobile jumps straight to Profile | Medium | Yes |
| onboarding-03 | new | In-flow Account step (email/password + OAuth + consent) | `Onboarding.dc.html:69-90` Step 1 inputs + Apple/Google + inline Terms checkbox | Account creation is a SEPARATE route: web `/sign-up`, mobile `(auth)/sign-up.tsx`; onboarding requires an existing auth session (`layout.tsx:11-37`) | High | Yes |
| onboarding-04 | new | "Done / You're all set" celebration step | `Onboarding.dc.html:167-179` approved raccoon, "You're all set", "48 days to New York", result chips; `Web Onboarding.dc.html:38-42` | No dedicated success step; current flows route directly to `/dashboard` or `/moving/plan/{id}` (`onboarding-client.tsx:980/1023/1088`); mobile uses inline "moving_skipped" check, not a celebration screen | Medium | Yes |
| onboarding-05 | different | Profile step is a 4-card move-type picker vs a rich form | `Onboarding.dc.html:92-107` 4 icon radio cards (rent/buy/work/student) only | Current Profile = names + age + family + children/pets/cars/senior/storage/motorcycle/boat + sensitive opt-in + moveType + legal panel (`onboarding-client.tsx:317-327`, `1508-1700`) | High | Yes |
| onboarding-06 | different | Address step: dual "Current/New home" with dossier banner vs single primary address | `Onboarding.dc.html:109-128` current(green)+new(gold) inputs, connector arrow, free-dossier info banner | Current step 1 saves ONE primary address; destination is collected later in step 3 Moving (`onboarding-client.tsx:330-338`, `saveAddress`); no dossier teaser banner on the address step | Medium | No |
| onboarding-07 | different | Move details step (date + household segmented) absent as its own step | `Onboarding.dc.html:144-165` Move date row + Household size 1/2/3/4+ segmented | Move date lives in step 3 Moving form; household size is captured via profile children/pets toggles, not a 1–4+ segmented control (`onboarding-client.tsx:366-373`) | Low | No |
| onboarding-08 | different | Step count & order: design mobile=6 functional steps (welcome→account→profile→address→services→move→done), web=4 (account→address→services→done) vs current 4 (profile→address→services→moving) | `Onboarding.dc.html:223` labels array (7 entries); `Web Onboarding.dc.html:62` `s1..s4` | `onboarding-client.tsx:75-80` STEPS=[Profile,Address,Services,Moving]; mobile `STEP_KEYS` 115-120 same 4 | High | Yes |
| onboarding-09 | rebrand/different | Web onboarding has no profile/legal/coach/teaser; design web is a minimal 4-step. Current web is far richer. | `Web Onboarding.dc.html` whole file — name+email, address+date, 6 services, done | Current web step 0 includes `LegalConsentPanel`, `ObCoach`, sensitive fields, provider ritual, `ObProShowcase`, free `MoveTeaserCard` (`onboarding-client.tsx:1214-2343`) | Medium | Yes |
| onboarding-10 | theme | Big radius + gold gradient CTA + navy surfaces match, but token mapping differs | `Onboarding.dc.html:184` CTA `linear-gradient(135deg,#DCBC7C,#CBA45E,#B0852F)`, cards 14–16px radius, inputs `#121B2D` | Current uses shadcn tokens (`bg-foreground/5`, `tone-orange-*`, `rounded-xl/2xl`); mobile uses `theme.colors` + `MoveProgressBar`. Hue matches Gold; gradient CTA exists (mobile `variant="gradient"`) | Low | No |
| onboarding-11 | new | Service set differs: design lists Insurance + Subscriptions (mobile) as first-class onboarding pills | `Onboarding.dc.html:213-217` 8 services incl. 🛡 Insurance, 📺 Subscriptions; web 6 services | Current services are recommended-provider-driven (engine + categories), not a fixed 8-pill set; insurance/subscriptions exist as categories but the onboarding UI is a provider list, not emoji pills (`onboarding-client.tsx:478-535`, `1796` mobile) | Low | No |
| onboarding-12 | different | Progress chrome: design uses {step}/5 counter + single gradient bar + back button; current adds per-step dot rail + labels + collapsing header (mobile) and Aurora step list (web) | `Onboarding.dc.html:38-45` bar + "{step}/5"; `Web Onboarding.dc.html:18-20` "Step N of 4" + bar | mobile `onboarding.tsx:1424-1464` dot rail + labels + `MoveProgressBar` + collapse; web `aurora-aside.tsx:89-120` ordered step list | Low | No |
| onboarding-13 | new | "Free dossier" address-step teaser banner (flood/schools/air) | `Onboarding.dc.html:123-126` gold info banner | No equivalent on the address step; dossier value is surfaced later (dashboard / moving plan), not during address entry | Low | No |
| onboarding-14 | wrong/different | OAuth (Apple/Google) shown inside the onboarding Account step; current keeps OAuth only on the separate sign-up screen | `Onboarding.dc.html:79-82` Continue with Apple/Google | Current onboarding has no OAuth buttons (auth is pre-onboarding); OAuth lives in `(auth)/sign-up.tsx`/`sign-in.tsx` and web `/sign-up` | Medium | Yes |
| onboarding-15 | missing | Mobile `NotificationPrimingCard` / push soft-prompt has no analog in the design's onboarding | n/a — design ends at the "Done" step with result chips, no notification priming | `apps/mobile/app/onboarding.tsx:2321-2327` `NotificationPrimingCard`; push prompt `1076-1118` | Low | No |
| onboarding-16 | new | Result/summary chips on the Done step ("48 days", "N services", "Dossier ✓") | `Onboarding.dc.html:173-177` three tonal chips | No completion summary UI; current routes away on finish without a recap (`onboarding-client.tsx:983-1029`) | Low | No |

---

## Detail notes

**onboarding-01 (rebrand, decision):** Every onboarding surface carries the brand. Web `layout.tsx` renders `<Wordmark>` (LocateFlow) and the legal gate text literally says "before using **LocateFlow**" (`onboarding-client.tsx:1222`). Mobile uses `MoveRaccoon` + Playfair wordmark already labeled "Move" per the inventory, so mobile is closer to the design's wordmark than web. Decision: confirm "Move — Relocation Intelligence" wordmark + the gold "RELOCATION INTELLIGENCE" eyebrow as the onboarding identity, and scrub "LocateFlow" strings (incl. legal copy).

**onboarding-02/03/04/08 (flow shape, decision):** This is the central structural call. The design's MOBILE onboarding is a single guided wizard that INCLUDES Welcome, Account (email/password + OAuth + consent), and a Done celebration — 7 visual steps, counter "/5". The CURRENT product splits auth into dedicated `(auth)`/`/sign-up` routes and starts onboarding only once authenticated, with no welcome or celebration step. Adopting the design literally means folding sign-up INTO onboarding (or at least adding welcome + done bookends). Note `aurora-aside.tsx:22-24` and `onboarding-client.tsx:72-74` both document a DELIBERATE owner decision to keep the prototype's plan-picker OUT — so the team has already chosen to diverge from the prototype's step list before. The same product judgment is needed here.

**onboarding-05 (profile, decision):** The design reduces "profile" to a single 4-way move-type choice (rent/buy/work/student). The current Profile step collects far more (household composition, vehicles, sensitive disability/immigration with consent gating, move type). Dropping to 4 cards would discard data the checklist/recommendation engines consume (`buildOnboardingProfilePayload`, `generateChecklist`). Decision: treat the design's 4 cards as the move-type sub-control and keep (or relocate) the richer profile capture, OR accept reduced personalization.

**onboarding-06/07 (address & move details):** Design collects current+new address together early (step 3) and move date+household later (step 5); current collects one primary address in step 1 and destination+date in step 3, with no standalone household-size segmented control. Behavior differs but both reach the same data; this is a layout/sequence delta, not a defect.

**onboarding-09 (web richness):** The design's WEB onboarding is intentionally minimal (4 steps, no legal/coach/teaser/profile depth). The current web onboarding is the richest surface. If the design web mock is taken as target, a large amount of current web onboarding UX (legal panel, coach, provider ritual, Pro showcase, free teaser) would be out of scope — almost certainly NOT intended (those are owner-mandated compliance/monetization features). Flagged for decision so the design's minimalism isn't mistaken for a removal mandate.

**onboarding-10 (theme):** Accent hue matches (Gold `#CBA45E`, gradient `#DCBC7C→#CBA45E→#B0852F`), navy surfaces match (`#121B2D`). The deltas are radius (design 14–16px inputs / 16px cards vs current `rounded-xl`≈12px) and token plumbing (inline `--var` strings in the mock vs shadcn/`theme.colors` in code). Low severity — consistent with `01_DESIGN_SYSTEM_DELTA.md` finding that onboarding is not part of the teal/green swap.

**onboarding-14 (OAuth placement, decision):** Tied to onboarding-03 — only relevant if account creation moves into onboarding. The current OAuth marks (`BrandLogos`, brand-mandated colors) already exist on the auth screens and would be reused.

---

## Open questions
1. Fold account creation (email/password + Apple/Google + Terms consent) INTO onboarding as the design shows, or keep auth as separate pre-onboarding routes? (onboarding-03/14)
2. Add the in-flow Welcome hero (step 0) and Done/celebration step (result chips), or keep the current "route straight to dashboard" completion? (onboarding-02/04/16)
3. Reduce the Profile step to the design's 4 move-type cards, or keep the current rich profile capture (household/vehicles/sensitive fields) that the checklist & recommendation engines depend on? (onboarding-05)
4. Is the design's minimal 4-step WEB onboarding the target (implying removal of legal panel / coach / provider ritual / Pro showcase / free teaser), or is it just an abbreviated mock? Almost certainly the latter — confirm. (onboarding-09)
5. Keep the dual current+new address entry early (design) or the current single-primary-then-destination sequence? Add a standalone household-size segmented control? (onboarding-06/07)
6. Confirm full "LocateFlow → Move" wordmark + legal-copy rebrand for onboarding. (onboarding-01)
