# Dashboard Audit

## Baglanti Durumu

- Admin sayfa: `apps/admin/src/app/(admin)/page.tsx`
- Veri dogrudan server component icinde Prisma ile okunuyor; ayrica
  `HealthCard` sistem sagligi icin `/api/health` kullaniyor.
- Web/mobile'a dogrudan bagli bir dashboard API yok; admin dashboard, web ve
  mobile'in urettigi user, subscription, moving plan, session ve event
  verilerini okuyor.

## Guvenlik

- Sayfa admin layout korumasi altinda; ancak modul bazli permission kontrolu
  yok. Login olan her admin dashboard'u gorebilir.
- Recent users email alanlari maskelenmis. Upcoming moves kartlari user email'i
  maskeliyor ama move route/city/state bilgisini tum adminlere gosteriyor.
- `/api/health` `settings canRead` + minimum `ADMIN` istiyor; dashboard health
  karti VIEWER rolde calismayabilir.

## Mantik ve Eksik

- MRR hesabi shared billing plan tanimlarina dayaniyor; bu iyi. Ancak web
  monthly/yearly ve mobile IAP gelir ayrimi dashboard'da net degil.
- Churn proxy hesabi `createdAt/canceledAt` ile yaklasik hesap yapiyor; finansal
  raporlama icin yeterli degil.
- Dashboard route permission ayrimi olmadigi icin operasyonel hareket bilgisi
  VIEWER icin fazla genis olabilir.

## Oneriler

- Dashboard icin `dashboard` veya `analytics` resource'u eklenmeli.
- Revenue kartlari provider/platform/cycle ayrimli hale getirilmeli.
- Upcoming move verisi VIEWER icin sehir/state seviyesine indirilmeli veya
  hassas detay icin `moving_plans canRead` kontrolu eklenmeli.
