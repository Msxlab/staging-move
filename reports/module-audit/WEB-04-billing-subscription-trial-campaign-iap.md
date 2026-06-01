# WEB-04 Billing/Subscription/Trial/Campaign/IAP

## Kapsam

Stripe checkout, subscription state, trial/campaign redemption, upgrade/downgrade, cancellation, webhook, portal, mobile IAP conflict.

## Olumlu Gozlemler

- Checkout route testleri `PENDING_CHECKOUT`, trial redemption, active paid conflict ve app-store subscription conflict gibi kritik durumlari ele aliyor.
- Stripe webhook testleri duplicate event ve pending redemption'in redeemed olmasini kontrol ediyor.
- Checkout cleanup cron stale pending checkout satirlarini restore/expire etmek icin tasarlanmis.

## Riskler ve Sorular

- En kritik kullanici sorusu: "paketi aldi ama odemedi" mantigi route seviyesinde var; fakat tek bir DB-backed E2E ile kanitli degil.
- Vercel cron listesinde checkout cleanup/stripe reconcile eksikse pending checkout temizligi deploy sekline gore calismayabilir.
- Upgrade/downgrade, trial, portal ve IAP/web subscription conflict tek entitlements truth source uzerinden E2E edilmeli.
- Client UI'nin pending/active/canceled/past_due durumlarini dogru gosterdigi ayrica kanitlanmali.

## Test/Task Listesi

- Checkout baslat -> `PENDING_CHECKOUT`.
- Odemeden cik -> cancel/cleanup -> tekrar checkout yapilabilir.
- Webhook tamamlandi -> entitlement paid/trial aktif.
- Duplicate webhook idempotent.
- Upgrade/downgrade/switch-cycle.
- Stripe subscription varken IAP veya IAP varken Stripe checkout engeli.
- Trial already redeemed ve pending redemption ayrimi.

## Oncelik

P1/P2: Billing lifecycle icin DB-backed E2E ve scheduler parity gerekli.
