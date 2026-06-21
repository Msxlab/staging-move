# 06 · Mobile App (Expo / React Native)

Mobile has **no independent entitlement resolver** — `isPremium`/`planTier` come from the server snapshot, so the 3-point switch ([01](01-ENTITLEMENTS-AND-GATES.md)) makes mobile read full-access automatically. The remaining mobile work is **onboarding paywall removal + teaser/copy cleanup + read-only subscription screen**.

## Onboarding (4-step wizard) · [apps/mobile/app/onboarding.tsx](apps/mobile/app/onboarding.tsx)

| Area | Line | Current | Change | Type |
|---|---|---|---|---|
| `isPremium` gate | 348 | free vs paid branch (teaser vs create plan) | treat all as premium → always create real `MovingPlan`; teaser branch dead | code |
| Service-selection cap (hidden paywall) | 559 | `serviceLimitForPlan(planTier)` (free=10) blocks beyond limit | remove cap (or set to everything); free accounts add all providers | code |
| Service limit message | 560 | "Your plan includes N services. Upgrade to add more." | never fires; remove usage | copy |
| Essentials "Add" limited / "Limit reached" | 1817 | `essentialSelectionLimited` + "upgrade for the rest" hint (1850) | always add all; remove limit-reached label + hint | copy |
| `handleComplete` free teaser short-circuit | 995 | `if (!isPremium) return buildTeaser()` | remove short-circuit → `saveMovingPlan` for all | code |
| `handleTeaserPrimary` upgrade route | 1060 | else → `UPGRADE_CLICKED` + `completeWithoutPlan('subscription')` | action always `create_plan`; remove upgrade branch | code |
| `MoveTeaserCard` "Unlock with Individual" | 2081 | free path: lock CTA + "Continue with the free plan" ghost | pass neutral "Continue to your plan" props OR drop teaser; remove free-plan button | copy |
| `ProShowcaseCard` + See Pro→subscription | 2240 | `!isPremium` → showcase, `onSeePro`→`/settings/subscription` | never renders; remove or repurpose neutral coming-soon (no "Pro"/subscription route) | copy |
| Paid finish CTA labels | 2261 | premium vs free buildTeaser | single create-plan CTA for all | copy |

### Shared onboarding components / i18n
- `MoveTeaserCard` defaults — [MoveTeaserCard.tsx:239](apps/mobile/src/components/ui/MoveTeaserCard.tsx) "Unlock with Individual" / Lock. Reused on dashboard too → pass neutral props in onboarding; update defaults long-term.
- `ProShowcaseCard` — [ProShowcaseCard.tsx:85](apps/mobile/src/components/onboarding/ProShowcaseCard.tsx) "With Pro… Pro goes further" → retire or neutral coming-soon.
- i18n: `teaser.unlockCta/unlockHint` ([en.json:1041](apps/mobile/src/i18n/messages/en.json)), `proShowcase_*` ([:1112](apps/mobile/src/i18n/messages/en.json)), `moving_description` "preview" ([:1108](apps/mobile/src/i18n/messages/en.json)), `providers_limitHint`/`limitReached`. Mirror all in es.json. → [11-COPY-I18N](11-COPY-I18N.md)

## Dashboard & feature gates (auto-dead after server flip)
Covered server-side; verify these no longer render teasers: `FreeMoveUpsellCard` ([index.tsx:1331](apps/mobile/app/(tabs)/index.tsx)), `MoveBriefingCard` teaser ([:52](apps/mobile/src/components/ui/MoveBriefingCard.tsx)), `HomeDossierCard` teaser ([:199](apps/mobile/src/components/ui/HomeDossierCard.tsx)), service/address limit CTAs in [services/new.tsx:441](apps/mobile/app/services/new.tsx) / [addresses/new.tsx:201](apps/mobile/app/addresses/new.tsx) / [moving/new.tsx:290](apps/mobile/app/moving/new.tsx). `UPSELL_GATE_CODES` ([subscription-gate.ts:7](apps/mobile/src/lib/subscription-gate.ts)) become unreachable (server stops returning them).

## Subscription screen → read-only · [apps/mobile/app/settings/subscription.tsx](apps/mobile/app/settings/subscription.tsx)
Keep the IAP/purchase machinery intact but **dormant** (commerce hidden via store flags — see [07](07-APPLE-APP-STORE.md)/[08](08-GOOGLE-PLAY.md)). Present "You're on Free — everything included" + Concierge/Business coming-soon. Do NOT remove `iap.ts`, `iap-offers.ts`, `billing-flags.ts`, `subscription-visible-plans.ts`, `subscription-app-review.ts` (billing-keep → [09](09-PAYMENTS-BILLING-PRESERVED.md)).

## Plan-comparison mirror · [apps/mobile/src/lib/plan-comparison.ts:57](apps/mobile/src/lib/plan-comparison.ts)
`MAX_ADDRESSES/MAX_SERVICES/MEMBER_SEATS/PLAN_MATRIX` mirror web FEATURES (pinned by `plan-comparison.test.ts`). **PRESERVE for the core switch** (server already allows unlimited; mobile reads PRO once `planTier=PRO`). Showing "Free — everything included" instead of PRO numbers is an optional copy task (would require updating the test).

## Theming note
`auth-store.planTier` ([:52](apps/mobile/src/lib/auth-store.ts)) is **theming/display only**, not a gate. It becomes `PRO` and applies the Pro accent palette. Decide if "everyone gets the Pro gold theme" is desired or if Free should keep the base palette (separate cosmetic decision).
