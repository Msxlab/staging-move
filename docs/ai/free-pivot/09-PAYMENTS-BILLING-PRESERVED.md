# 09 · Payments & Billing — DO NOT TOUCH (preserve dormant)

The pivot's hard rule: **preserve all monetization infrastructure.** It becomes unreachable (no one can purchase) but stays correct so that (a) a real legacy/paid subscription still resolves, (b) admin sees true state, and (c) Concierge/Business can be switched on later. The "all accounts full" override must sit **after** provider-paid resolution so it only upgrades the free/unknown outcome.

## Entitlement engine (interpretation stays exact)
- `getEffectiveEntitlement` provider-paid lifecycle (TRIALING/ACTIVE/CANCEL_AT_PERIOD_END/GRACE_PERIOD/PAST_DUE/CANCELED), admin-manual branch, consistency warnings — [entitlement.ts:248,453,178](packages/shared/src/entitlement.ts). Only the **free/unknown** path is post-processed (flag on).
- `buildUnifiedEntitlementSnapshot` — [billing.ts:134](apps/web/src/lib/billing.ts). Keep provider/expiresAt/management fields.
- `requestHasPlanFeature` / `getRequestEntitlement` — [request-entitlements.ts](apps/web/src/lib/request-entitlements.ts). Pure pass-through.
- `requireAppMutationUser` + `SUBSCRIPTION_CODES` — [api-gates.ts:101](apps/web/src/lib/api-gates.ts).

## Stripe (web)
- Webhook — [api/webhooks/stripe/route.ts](apps/web/src/app/api/webhooks/stripe/route.ts); checkout/cancel/portal routes; `cron/stripe-reconcile`.
- Price mapping/resolution — [billing.ts:48](apps/web/src/lib/billing.ts) (`getStripePriceIdForPlanAndInterval`, `mapStripePriceIdToPlanAndInterval`, `ensureSubscriptionDefaults`).
- `BILLING_PLAN_DEFINITIONS` + `BILLING_PRODUCT_CONFIG_KEYS` + prices — [packages/shared/src/billing.ts:59,153](packages/shared/src/billing.ts). **Never rename DB plan keys** (INDIVIDUAL/FAMILY/PRO) — breaks Stripe metadata + persisted `Subscription.plan`. Display-name copy changes are separate ([11](11-COPY-I18N.md)).

## Apple / Google IAP
- Verify — [api/mobile/iap/verify/route.ts](apps/web/src/app/api/mobile/iap/verify/route.ts); `iap-apple.ts`, `iap-google.ts`, `iap-common.ts`, `iap-status.ts`; `webhooks/appstore`, `webhooks/playstore`; `api/mobile/iap/products`.
- Mobile: `iap.ts`, `iap-offers.ts`, `billing-flags.ts`, `subscription-visible-plans.ts`, `subscription-app-review.ts`. Dormant via store flags ([07](07-APPLE-APP-STORE.md)/[08](08-GOOGLE-PLAY.md)).

## Lifecycle emails (dormant — fire only on real purchases)
PRESERVE senders + seeds; they can't fire while purchases are impossible:
- `sendSubscriptionActivated/Canceled/Resumed/Updated/PaymentFailed` — [email-service.ts:1169](apps/web/src/lib/email-service.ts); seeds [email-templates.ts:277](packages/db/prisma/seed-data/email-templates.ts).
- `sendAdminPurchaseAlert` / `sendAdminSignupAlert` — [admin-alerts.ts:181,143](apps/web/src/lib/admin-alerts.ts). (Signup alerts still valid.)
- Push transport + Android `billing` channel — [notifications.ts:176](apps/web/src/lib/notifications.ts), [push.ts:79](apps/mobile/src/lib/push.ts).

> **Exception — actively deactivate (these CONTRADICT free):** `trial-expiring` email + `trial-check` cron notices + acquisition trial→annual funnel. These are *outbound copy* that says "you'll be charged." See [11-COPY-I18N](11-COPY-I18N.md) and [10-ANALYTICS-FLAGS](10-ANALYTICS-FLAGS.md). They are gated/dormant, NOT deleted.

## Admin billing (must stay truthful)
- Admin billing dashboard (MRR/ARR, churn, IAP ops) — [apps/admin/src/app/(admin)/billing/billing-client.tsx:50](apps/admin/src/app/(admin)/billing/billing-client.tsx), `/api/billing`, `billing-metrics.ts`. Read-only; gates nothing.
- Admin plans + user-detail manual grant — [apps/admin/.../plans/page.tsx](apps/admin/src/app/(admin)/plans/page.tsx), user-detail selects.
- **Admin MUST read raw entitlement (`fullAccess:false`)** so grants/expiries/warnings/real tiers remain visible. The override applies only on consumer read paths (`getUserPlan`, `/api/profile`, mobile).
