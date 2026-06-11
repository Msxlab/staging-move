# Modül Denetimi: Homepage

## 1. Modülün Amacı
LocateFlow ürününü anlatmak, signup/pricing/app store CTA'larına yönlendirmek.

## 2. Ana Dosyalar
- `apps/web/src/app/page.tsx`
- `apps/web/src/i18n/messages/en.json`
- `apps/web/src/components/marketing/*`
- `apps/web/src/app/pricing/page.tsx`

## 3. Bağlantılar
Pricing, auth, app store CTA, connector feature flags, workspace feature flags.

## 4. Veri Akışı
Runtime config/feature flags -> conditional sections -> CTA -> auth/checkout.

## 5. UI/UX Denetimi
Strong marketing structure; copy riskleri yüksek.

## 6. API/Backend Denetimi
Pricing CTA backend checkout'a gider; price server-side çözülür.

## 7. Database Denetimi
Doğrudan DB yok; product claims DB/API ile uyumlu olmalı.

## 8. Permission/Auth Denetimi
Public.

## 9. Edge Case Denetimi
Feature flags disabled, connector unsupported, mobile app store purchase policy.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-001 Documents promise.
- AUD-002 Snap bill.
- AUD-003 USPS automatic.

## 11. Mantık Hataları
Manual coordination ve automatic update copy aynı yüzeyde çelişiyor.

## 12. Öneriler
Copy guardrail and product promise test.

## 13. Test Senaryoları
Feature flag false copy snapshot, pricing CTA route, no unsupported claims.

## 14. Sonuç
❌ Hatalı
