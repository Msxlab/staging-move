# Reports Audit

## Baglanti Durumu

- Admin: `/api/reports`
- DB aggregate olarak user/subscription/moving/provider/address verilerini okur.
- Web/mobile'a dogrudan yazmaz; onlarin urettigi veriyi raporlar.

## Guvenlik

- Permission `settings canRead` + VIEWER, fallback `audit_logs`.
- Reports modulu icin ayri permission yok. VIEWER seviyesinde growth, provider
  ve state aggregate'leri gorulebilir.

## Mantik ve Eksik

- Tarih parametreleri `new Date()` ile parse ediliyor; invalid date icin net
  validation yok.
- Sadece `overview/all` tipi destekleniyor; UI/roadmap genislerse API kontrati
  zayif kalir.
- State/provider aggregate'lerinde privacy floor yok; su an top-level count
  oldugu icin risk dusuk ama kucuk veri setlerinde dikkat gerekir.

## Oneriler

- `reports` veya `analytics` permission altina alin.
- Date range zod validation ve max range limiti.
- Kucuk count suppression/privacy floor.
