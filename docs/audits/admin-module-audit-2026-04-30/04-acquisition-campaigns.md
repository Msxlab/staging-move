# Acquisition Campaigns Audit

## Baglanti Durumu

- Admin: `/api/acquisition-campaigns`, `/api/acquisition-campaigns/[id]`
- Web:
  - `/api/acquisition/redeem` free access redemption
  - `/api/stripe/checkout` paid/free trial checkout
  - `/api/webhooks/stripe` redemption finalization
  - public offer helpers in `apps/web/src/lib/acquisition-campaigns.ts`
- Mobile: ayni kampanya motoruna dogrudan bagli degil; mobile subscription IAP
  ayri akiyor.

## Guvenlik

- Admin yetki `subscriptions` resource'una bagli. Campaign yazmalari billing
  etkili oldugu halde ozel `acquisition_campaigns` permission yok.
- Stripe price validation aktif kampanyalarda iyi bir koruma.
- Kampanya aktivasyonu/paid offer degisikligi password step-up istemiyor.

## Mantik ve Eksik

- Web redeem akisi `redemptionCount >= maxRedemptions` kontrolunu transaction
  oncesi yapiyor; es zamanli taleplerde limit asimi olabilir.
- Stripe checkout akisi pending redemption olusturup sayaci webhook'ta
  arttiriyor. Cok sayida pending checkout ayni anda baslatilirsa max limit
  fiilen rezerve edilmiyor.
- Campaign input enum/number validasyonu UI'ya fazla guveniyor.
- Mobile parity yok: mobile IAP urunleri admin acquisition kampanyalarindan
  etkilenmiyor.

## Oneriler

- Kampanya create/update/activate icin ayri permission + password step-up.
- Max redemption icin conditional update veya reservation modeli.
- Mobile IAP kampanya desteklenecekse campaign access modelini provider/platform
  aware hale getirin.
- Direct API icin zod schema ve enum validasyonu ekleyin.
