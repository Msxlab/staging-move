# CLIENT-03 Mobile Billing/IAP

## Kapsam

Mobile IAP products, purchase verify, App Store/Play Store webhooks, entitlement sync, web Stripe conflict.

## Olumlu Gozlemler

- Mobile IAP API/webhook testleri mevcut.
- Web checkout route aktif app-store subscription varken Stripe checkout'u engelleyecek mantiga sahip.
- Entitlement modeli shared/core tarafinda merkezi hale getirilmeye calisilmis.

## Riskler ve Sorular

- IAP purchase -> webhook -> entitlement -> mobile UI refresh E2E yok.
- Web Stripe ve mobile IAP ayni hesapta conflict/restore purchase senaryolari kapsamli test edilmeli.
- Offline/stale entitlement UI paid ozelligi fazla acabilir veya haksiz kapatabilir.

## Test/Task Listesi

- Product list public mobile API.
- Purchase verify invalid/valid.
- App Store/Play Store webhook idempotency.
- Restore purchases.
- Web Stripe conflict.
- Entitlement refresh after app resume.

## Oncelik

P2: IAP entitlement E2E ve web/mobile conflict senaryolari.
