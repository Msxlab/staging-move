# Auth / Login — Design ↔ Code Gap Analysis

**Area:** auth · GAP ANALYSIS ONLY (no code changes).

**Design sources (source of truth):**
- `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Auth.dc.html` — mobile auth (single screen, 3 states: signin / forgot / sent).
- `C:/Users/Windows/Downloads/New folder/Initial check requested-handoff (7)/initial-check-requested/project/Web Login.dc.html` — web sign-in (split brand panel + form).

**Current implementation:**
- Web: `apps/web/src/app/sign-in/page.tsx`, `sign-up/page.tsx`, `forgot-password/page.tsx`, `reset-password/[token]/`, `verify-email/page.tsx`.
- Mobile: `apps/mobile/app/(auth)/sign-in.tsx`, `sign-up.tsx`, `forgot-password.tsx`, `reset-password/[token].tsx`.
- Brand: `apps/web/src/components/marketing/logo.tsx` (`Wordmark`), mobile `MoveRaccoon`.
- Tokens: `packages/shared/src/design-tokens.ts`; copy in `apps/web/src/i18n/messages/en.json`, `apps/mobile/src/i18n/messages/en.json`.
- Inventory: `docs/ui-renewal/13_MOBILE_SCREENS.md`, `docs/design-sync/01_DESIGN_SYSTEM_DELTA.md`.

---

## designSummary

**Web Login** (`Web Login.dc.html`): full-height 2-column grid `1.05fr .95fr` on `#070B14`. LEFT brand panel (hidden < 820px) — gradient `#0E1828→#0a1120`, animated radial gold glow, Raccoon badge + "Move" wordmark (Playfair 900, 23px), big serif headline "Welcome back to your move.", sub "48 days to New York — your dossier, services and reminders are right where you left them.", footer "★★★★★ 4.9 · 100% free, no subscription". RIGHT form — "Sign in" (Playfair 30/800), "New here? Create a free account", email + password inputs, "Forgot password?", gold gradient CTA, "or" divider, two side-by-side OAuth chips (Apple = white, Google = navy surface). Accent = Gold `#CBA45E`.

**Mobile Auth** (`Auth.dc.html`): single 390×844 phone frame on `#0A0F1C`, status bar + home indicator, three swappable states:
- **signin** — Raccoon badge (78px rounded, gold ring), heading "Welcome back" (Playfair 900/30), sub "Sign in to pick up your move where you left off.", email+password, "Forgot password?", gold gradient "Sign in" CTA, "or" divider, **stacked full-width** OAuth ("Continue with Apple" white, "Continue with Google" navy), footer "New here? Create account".
- **forgot** — heading "Reset password", sub "Enter your email and we'll send a reset link.", single email input, "Send reset link" gold CTA, "Back to sign in" ghost button.
- **sent** — green envelope disc, "Check your inbox", "We sent a reset link to your email. It expires in 30 minutes.", "Back to sign in" gold CTA.

Both: Playfair Display + DM Sans, inputs `#121B2D` w/ `rgba(110,150,225,.12)` border radius 14, gold gradient CTAs `#DCBC7C→#CBA45E→#B0852F`.

## currentSummary

The current auth is already **strongly aligned** with this handoff (the reskin appears to have been done against an earlier cut of the same Move design). 

- **Web sign-in** (`sign-in/page.tsx`): identical 2-column `lg:grid-cols-[1.05fr_0.95fr]`, left brand `aside` (hidden < lg) with gradient `from-card to-background`, radial `bg-primary/10` glow, Wordmark, `font-display` headline + sub from `auth.signIn_title/subtitle`, "Sign in" form, "New here? / Sign Up", OAuth, gold `bg-primary` CTA. Adds production features absent from mockup: **MFA step**, OAuth provider-readiness notes, error alerts, legal footer links, i18n.
- **Web sign-up / forgot-password / verify-email / reset-password**: present with matching navy/gold styling, card layouts, success states.
- **Mobile sign-in** (`(auth)/sign-in.tsx`): Raccoon badge 62px in 78px gold-ring tile, Playfair title, gold gradient `Button variant="gradient"`, "or" divider, OAuth (native Apple + Google), forgot/sign-up links, MFA. Forgot-password and reset-password are **separate routed screens** (not the 3-state single screen of the mockup).

Deltas are therefore mostly **rebrand (LocateFlow wordmark)**, **copy** (subtitles / value-prop), and **layout-detail** differences, not structural.

---

## Gap table

| ID | Type | Title | Design evidence | Code evidence | Severity | Decision? |
|---|---|---|---|---|---|---|
| auth-1 | rebrand | Web wordmark still renders "LocateFlow" | `Web Login.dc.html:20` wordmark text "Move" | `apps/web/src/components/marketing/logo.tsx:49` renders `LocateFlow` | High | Yes |
| auth-2 | different | Web left-panel headline/sub copy differs from value-prop | `Web Login.dc.html:23-24` "Welcome back to your move." + "48 days to New York — your dossier…" | `sign-in/page.tsx:149-154` uses `auth.signIn_title`="Welcome back" / `signIn_subtitle`="Sign in to your account" (`en.json`) | Medium | Yes |
| auth-3 | missing | "100% free, no subscription" trust line absent on web | `Web Login.dc.html:26` "★★★★★ 4.9 · 100% free, no subscription" | `sign-in/page.tsx:156-159` shows `ShieldCheck` + "Secure access" instead | Medium | Yes |
| auth-4 | different | "Create a free account" vs "Sign Up" link copy | `Web Login.dc.html:32` "New here? Create a free account" | `sign-in/page.tsx:168-171` `auth.noAccount`+`common.signUp` ("Don't have an account? Sign Up") | Low | No |
| auth-5 | wrong | Mobile sign-in title/subtitle swapped vs design | `Auth.dc.html:66-67` heading="Welcome back", sub="Sign in to pick up your move where you left off." | `(auth)/sign-in.tsx:206-207` title=`auth.signIn`("Sign In"), subtitle=`auth.signIn_title`("Welcome back") — heading shows "Sign In", sub shows "Welcome back" | Medium | No |
| auth-6 | missing | Mobile value-prop subtitle copy not present | `Auth.dc.html:67` "Sign in to pick up your move where you left off." | `apps/mobile/src/i18n/messages/en.json` has no equivalent string; `signIn_subtitle` not defined for mobile | Low | No |
| auth-7 | different | Mobile OAuth buttons stacked full-width vs web side-by-side | `Auth.dc.html:32-35` stacked "Continue with Apple"/"Continue with Google"; `Web Login.dc.html:40-43` side-by-side "Apple"/"Google" | `(auth)/sign-in.tsx:277-304` stacked (matches mobile); web `sign-in/page.tsx:182-225` stacked full-width labels "Continue with…" (design web uses 2-up short labels) | Low | No |
| auth-8 | different | Mobile OAuth order: design Apple-first, current already Apple-first; web design 2-up vs current stacked | `Web Login.dc.html:40` Apple then Google, side-by-side compact | web `sign-in/page.tsx` Google first, then Apple, both full-width | Low | No |
| auth-9 | different | Forgot-password is a separate web route vs design's same-surface state | `Auth.dc.html:39-54` forgot+sent are in-place states of one screen | `apps/web/src/app/forgot-password/page.tsx` + `reset-password/[token]/` are distinct routes; mobile `(auth)/forgot-password.tsx` separate screen | Low | No |
| auth-10 | different | "Sent" confirmation copy & expiry differ | `Auth.dc.html:50-51` "Check your inbox" / "…It expires in 30 minutes." | `forgot-password/page.tsx:39-42` `auth.forgotPassword_sent`="Reset link sent" / generic "If an account exists…" (no 30-min expiry line) | Low | No |
| auth-11 | new | "Create a free account" / free-product framing on auth | `Web Login.dc.html:32` "free account"; `:26` "100% free" | sign-up shows `landing.noCreditCard`="Checkout terms shown before purchase" (`sign-up/page.tsx:192`) — paid/checkout framing contradicts "100% free" | Medium | Yes |
| auth-12 | theme | Accent confirmed Gold (NOT brief's teal/green) | Design accent Gold `#CBA45E` (`Web Login.dc.html:38`, `Auth.dc.html:30`); per `01_DESIGN_SYSTEM_DELTA.md` Emerald/teal are non-default | `design-tokens.ts:35,41` `primary`→Gold `#CBA45E`; `--primary` in web already gold | Low | Yes |
| auth-13 | different | Mobile forgot/sent uses ghost "Back to sign in"; web reset success uses bordered link | `Auth.dc.html:44` ghost surface button; `:52` gold CTA on sent | `(auth)/forgot-password.tsx` (separate screen) — verify ghost back button matches; web `forgot-password/page.tsx:43-48` bordered link | Low | No |
| auth-14 | different | Web design hides brand panel < 820px; current hides < lg (1024px) | `Web Login.dc.html:12` `@media(max-width:820px){.login-brand{display:none}}` | `sign-in/page.tsx:143` `hidden … lg:flex` (Tailwind `lg`=1024px) | Low | No |

---

## Detail notes

**auth-1 (rebrand, High, decision):** The single highest-impact gap. The web `Wordmark` component literally outputs the string `LocateFlow` and its doc comment says "Full wordmark lockup for LocateFlow." The design wordmark everywhere is "Move" in Playfair 900. This is a product-naming decision that cascades across all surfaces (PWA manifest, marketing, emails) — flagged decisionNeeded. Mobile already uses the Raccoon mascot + "Move" identity per inventory, so the web wordmark is the laggard.

**auth-2 / auth-3 / auth-11 (copy + free framing, decision):** The design's brand panel sells a personalized, *free* product ("Welcome back to your move.", "48 days to New York…", "100% free, no subscription", "Create a free account"). Current copy is generic ("Welcome back" / "Sign in to your account" / "Secure access") and — critically — sign-up surfaces `landing.noCreditCard` = "Checkout terms shown before purchase", which directly contradicts the "100% free" positioning. Whether Move is truly free (drop checkout/subscription copy) is a product decision (decisionNeeded), and the localized strings must change to match.

**auth-5 (wrong, Medium):** Real defect. In `(auth)/sign-in.tsx` the `title` style renders `t("auth.signIn")` ("Sign In") and the `subtitle` style renders `t("auth.signIn_title")` ("Welcome back"). The design wants the big serif heading to be "Welcome back" and the muted sub to be the value-prop sentence. As written, the prominent heading is the terse "Sign In" and the supposed value-prop slot just repeats "Welcome back" — the two strings are effectively swapped and the value-prop line (auth-6) is missing entirely.

**auth-12 (theme):** Confirms the cross-cutting correction in `01_DESIGN_SYSTEM_DELTA.md`: despite the task brief describing a "teal/green primary (#168E9C/#1C8A63/#2A8E66)", the auth mockups use Gold `#CBA45E` gradient CTAs and gold accents — identical to the current `--primary`. So auth requires **no accent recolor**; `#168E9C`/`#1C8A63` are light-mode semantic teal/green and `#2A8E66` is the optional Emerald accent ramp, none of which the auth screens use. The only theme decision that touches auth is *if* the org elects Emerald as the new default accent globally (decisionNeeded), which would then recolor the CTAs.

**Already-aligned (no gap):** split web layout, brand-panel radial glow, navy input styling (`#121B2D` + faint border, radius ~14), gold gradient CTA, Raccoon badge on mobile, "or" divider, OAuth brand marks (correctly kept brand-mandated white/multicolor), Playfair/DM Sans. The current build also adds production-grade features the mockup omits (MFA, OAuth provider-readiness notes, inline error alerts, legal footer, i18n, email-verification + reset-token routes) — these are net-positive and not gaps against the design.
