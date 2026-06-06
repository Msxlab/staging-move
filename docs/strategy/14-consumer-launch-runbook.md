# Consumer Launch Runbook — gerçek para + store yayını

> Altyapı canlı, riskli switch'ler kapalı. Bu runbook **gerçek gelir**i ve **store yayını**nı açmanın adımları.
> Her biri ayrı karar; sırayla + geri-alınabilir şekilde aç.
> Gerçek kart charge/refund, iOS manuel release ve Android production rollout adımları açık owner onayı olmadan yapılmaz.

---

## A) Stripe — test-mode → LIVE
1. **Live ürün/fiyat (6 SKU):** Stripe Dashboard **Live mode** → 6 ürün (Individual/Family/Pro × Monthly/Annual), fiyatlar canlı kataloğunla aynı. App Review'ın sorduğu **Pro Annual** tutarını netleştir ($199 mu $199.99 mu) ve store ile aynı tut.
2. **Env:** her `price_...` (live) → ilgili `STRIPE_PRICE_*` (prod). Live `STRIPE_SECRET_KEY` + `STRIPE_PUBLISHABLE_KEY` + **live webhook** `STRIPE_WEBHOOK_SECRET`.
3. **Webhook endpoint (live):** Stripe → Webhooks → prod URL `/api/webhooks/stripe`, gerekli event'ler (checkout.session.completed, customer.subscription.*, invoice.*).
4. **Tek gerçek E2E (sonra refund):** açık owner onayıyla gerçek kartla 1 ucuz plan checkout → abonelik ACTIVE, webhook geldi, subscription sayfası doğru → **refund + cancel**. (Tercihen önce %100 indirim kuponuyla no-charge doğrulama.)
5. **Plan matrisi (live):** en az 1 upgrade (anında) + 1 downgrade (scheduled) + 1 cancel.

## B) Mobil — store yayını
**iOS (App Store Connect):**
- [ ] Build yükle (TestFlight → App Review)
- [ ] **App Privacy** formu (veri toplama beyanı) — manuel
- [ ] Demo hesap + şifre (out-of-band, commit etme)
- [ ] App Review notları (subscription davranışı, hesap silme)
- [ ] IAP ürünleri (6 SKU) "Ready to Submit" + review
- [ ] Manuel release (otomatik değil; ayrı açık owner onayı)

**Android (Play Console):**
- [ ] Production track rollout (önce internal → düşük yüzdeli staged prod; ayrı açık owner onayı)
- [ ] **Data safety** formu
- [ ] IAP ürünleri aktif + **RTDN** (real-time developer notifications) prod
- [ ] License testing → gerçek satın alma testi

## C) Son go-live kapıları (kod değil)
- [ ] `QA_RESETTABLE_ACCOUNT_EMAIL` prod env'de doğru
- [ ] Sentry/observability prod'da event alıyor
- [ ] Legal (terms/privacy/contact AXTRA SOLUTIONS LLC) — ✅
- [ ] Cron secret'ları + schedule'lar prod'da aktif (✅ cron 401 doğrulandı)

## D) Açma sırası (geri-alınabilir)
1. Stripe live ürün + env + webhook → açık onayla **1 gerçek E2E + refund** (en küçük risk).
2. Doğrulandıktan sonra public "gerçek checkout" aç.
3. Açık owner onayıyla Android production rollout (internal → staged %).
4. Açık owner onayıyla iOS manuel release.
5. İzle: ilk gerçek charge'lar, webhook health, refund/dispute oranı.

---

## Rollback
- Stripe: live key'leri geri çek / checkout flag'i kapat → test-mode'a dön.
- Store: Android staged rollout'u durdur; iOS "Remove from sale" (geç ama mümkün).
