# 07 · Apple / App Store

Goal: ship a **free build with IAP dormant** while keeping the subscription products configured for future re-enable. The mechanism already exists — `billing-flags.ts` hides commerce when the store-purchase flags are off, satisfying Apple Guideline 3.1.1 ("don't advertise a subscription you can't buy in-app").

App identifiers: bundle `com.locateflow.mobile`, `ascAppId 6771878736` ([eas.json:88](apps/mobile/eas.json)).

## Code changes (in-repo)

| Area | File | Line | Change | Type |
|---|---|---|---|---|
| EAS production IAP master switches | [apps/mobile/eas.json:69](apps/mobile/eas.json) | 69-71 | Set `EXPO_PUBLIC_MOBILE_STORE_PURCHASES_ENABLED`, `_IOS_…`, `_ANDROID_…` = **"false"** in `production` (and `play-internal` which extends it). dev/preview/staging already false. **Preserve the keys.** | code |
| Commerce-advertisability gate | [billing-flags.ts:47](apps/mobile/src/lib/billing-flags.ts) | 47 | **PRESERVE** — this is the dormant-billing kill switch. Optional: update header comment so it no longer reads as a "flip IAP on" launch checklist | preserve |
| IAP bridge (StoreKit2) | [iap.ts:97](apps/mobile/src/lib/iap.ts) | 97 | **PRESERVE** — early-returns when flag off; dormant | preserve |
| IAP SKU/offer helpers | [iap-offers.ts:1](apps/mobile/src/lib/iap-offers.ts) | 1 | **PRESERVE** — transport only | preserve |
| IAP product/SKU map endpoint | [api/mobile/iap/products/route.ts:18](apps/web/src/app/api/mobile/iap/products/route.ts) | 18 | **PRESERVE** — client won't fetch with flags off. Optional: leave `MOBILE_IOS_PRODUCT_*` unset → `available:false` (belt-and-suspenders) | preserve |
| IAP verify + lifecycle email trigger | [iap-common.ts:143](apps/web/src/lib/iap-common.ts) | 143 | **PRESERVE** — only runs on a cleared purchase (impossible while disabled) | preserve |
| App identifiers / config | [apps/mobile/app.json:3](apps/mobile/app.json) | 3 | **PRESERVE** — same app/listing; no IAP/paywall refs here | preserve |
| Dormant SKU env examples | [.env.production.example:110](.env.production.example) | 110-121 | **PRESERVE** as docs of dormant SKUs; keep production `MOBILE_*_STORE_PURCHASES_ENABLED=false` | preserve |

## Manual — App Store Connect (NOT in repo)

1. **Subscription group & products** (`com.locateflow.mobile.{individual,family,pro}.{monthly,annual}`): **do NOT delete.** Keep configured for future. Ensure the shipped build has iOS IAP disabled so nothing is advertised. ("Remove from Sale" optional; simplest is leave configured but unsurfaced.)
2. **App Review notes**: state that purchases are **not currently offered** (free app) to avoid "advertises sub without IAP" rejection.
3. **Store listing** (description, promo text, "what's new", screenshots): remove "free trial" / "subscription" / "Pro/Family" selling copy → free positioning; optionally note Concierge/Business coming soon. (No `fastlane/`/metadata in repo — console only.)
4. **App Privacy labels**: while purchases are disabled, turn off **"Offers In-App Purchases"** and adjust any purchase/financial-data declarations. Re-enable when monetization resumes.
5. Coordinate the in-app copy release with the console edits so **in-app tier names match the store sheet** (mismatch = metadata-mismatch rejection risk).

## Verify
- New TestFlight/build: subscription screen is read-only, no price/Subscribe CTA, no purchase sheet reachable from any flow (onboarding/dashboard/settings).
