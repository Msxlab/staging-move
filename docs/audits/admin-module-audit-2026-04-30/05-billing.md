# Billing Audit

## Baglanti Durumu

- Admin: `/api/billing`
- Web Stripe checkout, Stripe webhook ve subscription management verilerini
  okuyor.
- Mobile IAP kayitlari `Subscription` modeline bagli oldugu icin genel billing
  snapshot'ina karisabilir.

## Guvenlik

- Endpoint `subscriptions canRead` + minimum ADMIN istiyor. VIEWER kapali, iyi.
- Donen `trialExpiring` ve `recentCancellations` kisimlari raw subscription
  kayitlarini tasiyabiliyor; payment/store identifiers icin field projection
  eksik.

## Mantik ve Eksik

- MRR hesabi sabit Individual monthly fiyat mantigina yaslaniyor; annual,
  free access, mobile IAP ve kampanya fiyatlari icin finansal olarak yaklasik.
- `mobileOps` stale validation sinyali faydali ama aksiyon listesi net degil.

## Oneriler

- Billing API'de explicit safe view-model dondurun.
- MRR/churn hesaplarini provider, interval, currency ve status bazli ayirin.
- Stripe/App Store/Google Play id'lerini maskeli dondurun.
