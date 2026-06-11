# Modül Denetimi: Payments

## 1. Modülün Amacı
Web Stripe ve mobile store subscription ödeme/entitlement yönetimi.

## 2. Ana Dosyalar
- `apps/web/src/app/api/stripe/checkout/route.ts`
- `apps/web/src/app/api/webhooks/stripe/route.ts`
- `apps/web/src/app/api/mobile/iap/verify/route.ts`
- `apps/web/src/app/api/webhooks/appstore/route.ts`
- `apps/web/src/app/api/webhooks/playstore/route.ts`
- `packages/shared/src/billing.ts`
- `apps/web/src/lib/plan-limits.ts`

## 3. Bağlantılar
Stripe, Apple/Google, Subscription DB, acquisition campaigns, workspaces, notification emails.

## 4. Veri Akışı
Pricing/mobile purchase -> checkout/IAP -> provider -> webhook/verify -> Subscription -> profile/limits/admin.

## 5. UI/UX Denetimi
Pricing terms, mobile store billing disclosure ve account delete subscription warning olumlu.

## 6. API/Backend Denetimi
Server-side price resolution, auth, mobile web checkout guard, webhook signature var.

## 7. Database Denetimi
`Subscription`, `ProcessedWebhookEvent`, campaign redemption modelleri var.

## 8. Permission/Auth Denetimi
Checkout auth gerektirir; webhooks signature ile public.

## 9. Edge Case Denetimi
Duplicate webhook için idempotency var ancak marker sonda. Store cancellation/refund authority ayrımı copy'de iyi.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-004: Webhook idempotency reservation sonda.

## 11. Mantık Hataları
P0 fiyat manipülasyonu kanıtı yok.

## 12. Öneriler
Atomic webhook reservation, concurrent tests, runtime price readiness health.

## 13. Test Senaryoları
Checkout plan allowlist, missing price 503, duplicate webhook concurrent, store purchase/restore/revoke.

## 14. Sonuç
⚠️ Riskli
