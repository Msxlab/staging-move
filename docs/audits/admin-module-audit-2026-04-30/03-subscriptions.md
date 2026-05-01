# Subscriptions Audit

## Baglanti Durumu

- Admin liste: `/api/subscriptions`
- Web billing/checkout/webhook tarafindaki `Subscription` modeliyle ayni veri
  yuzeyini okuyor.
- Mobile IAP subscription kayitlari da ayni modele yazildigi icin admin listede
  gorunebilir.

## Guvenlik

- Okuma `subscriptions canRead` + VIEWER.
- Endpoint full subscription kaydini user ile birlikte donduruyor. Model icinde
  `purchaseToken`, `originalTransactionId`, `latestTransactionId`,
  `stripeCustomerId`, `stripeSubscriptionId`, consent/campaign snapshot gibi
  hassas payment/store alanlari var.

## Mantik ve Eksik

- VIEWER'in payment identifiers ve purchase token turevi alanlari gormesi
  least-privilege ile uyumlu degil.
- Subscription status/provider/platform farklari UI'da gorunse bile API
  field-level projection yapmiyor.

## Oneriler

- Liste API'sinde explicit `select` kullanin; token, Stripe/App Store/Google
  Play id'lerini maskeli veya sadece ADMIN+ icin dondurun.
- Finansal/entitlement alanlari icin `billing` veya `subscriptions_sensitive`
  gibi ayri permission kaynagi ekleyin.
