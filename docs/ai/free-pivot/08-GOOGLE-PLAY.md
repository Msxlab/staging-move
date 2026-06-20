# 08 · Google Play

Same model as Apple: ship a **free build with Android purchases dormant**, keep subscription products configured. Package `com.locateflow.mobile`.

## Code changes (in-repo)
Same EAS flag flip as [07-APPLE-APP-STORE](07-APPLE-APP-STORE.md):
- [apps/mobile/eas.json:69](apps/mobile/eas.json) — `EXPO_PUBLIC_MOBILE_ANDROID_STORE_PURCHASES_ENABLED` (+ the shared `_STORE_PURCHASES_ENABLED`) = **"false"** in `production` / `play-internal`. Preserve keys.
- Android purchase path is gated by the same `billing-flags.ts` / `iap.ts` (Play Billing) — **PRESERVE**, dormant when flags off.
- `iap-google.ts` verify + `webhooks/playstore/route.ts` — **PRESERVE** (only run on real purchases). See [09](09-PAYMENTS-BILLING-PRESERVED.md).

## Manual — Google Play Console (NOT in repo)

1. **Subscriptions / base plans** (`locateflow_{individual,family,pro}_{monthly,annual}`): **do NOT delete.** Keep configured for future; ensure the production build ships with Android purchases disabled so nothing is advertised.
2. **Store listing** (description, short/long, graphics, "what's new"): remove trial/subscription/Pro selling copy → free positioning; optionally note Concierge/Business coming soon.
3. **Data safety** form: while purchases are disabled, review/adjust any **purchase/financial info** declarations to match a free build. Re-enable when monetization resumes.
4. Coordinate release timing with the listing edits (in-app names ↔ store).

## Verify
- Internal-testing build: subscription screen read-only; no price/Subscribe; no Play purchase sheet reachable.
