# Providers Audit

## Baglanti Durumu

- Admin CRUD/import/logo: `/api/providers/*`
- Web public/auth API: `/api/providers`, `/api/providers/[id]`,
  `/api/providers/recommendations`
- Mobile hooks/screens ayni web API'lerini kullaniyor.
- Admin provider update/import sonrasi `revalidateTag("providers")` ile web
  cache baglantisi kurulmus.

## Guvenlik

- Read `providers canRead`, create/import/update MODERATOR+, delete ADMIN +
  password step-up.
- Logo upload content-type bazli PNG/JPEG/WEBP/GIF/ICO kabul ediyor, SVG yok;
  bu iyi. Ancak magic-byte validasyonu yok.
- Logo auto-fetch domaini provider website'den turetiliyor; SSRF riski dusuk.

## Mantik ve Eksik

- `ServiceProvider` modelinde `deletedAt` varken delete hard delete yapiyor.
  Catalog, services, move tasks ve governance iliskileri icin operasyonel risk.
- Bulk update optimistic locking kullanmiyor; category/score degisimlerinde
  kalite/duplicate validation tekrar calismiyor.
- Import icerik kalitesi daha iyi normalize ediliyor ama duplicate/governance
  sinyalleri operatore daha acik sunulmali.

## Oneriler

- Provider delete soft-delete yapilmali; public API zaten active/deleted filtre
  mantigina uyarlanabilir.
- Logo upload icin magic-byte ve image decode kontrolu ekleyin.
- Bulk update icin version veya conflict guard ekleyin.
