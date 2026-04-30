# Analytics Audit

## Baglanti Durumu

- Admin:
  - `/api/analytics`
  - `/api/analytics/activity-intelligence`
  - `/api/analytics/admin-activity`
  - `/api/analytics/user-spending`
- Web tracking: `/api/tracking/session`, `/api/tracking/event`
- Mobile tracking: `apps/mobile/src/components/SessionTracker.tsx` ve
  `apps/mobile/src/lib/analytics.ts`

## Guvenlik

- Main analytics `users canRead` + ADMIN istiyor.
- Admin activity `audit_logs canRead` + ADMIN.
- User spending endpoint `analytics canRead` + VIEWER istiyor; fakat
  `ADMIN_RESOURCES` icinde `analytics` yok. SUPER_ADMIN disindaki roller icin
  fail-closed olabilir.
- User spending aggregate k-anonymity floor (`MIN_USERS_PER_CELL = 5`) kullaniyor;
  bu iyi.

## Mantik ve Eksik

- Mobile analytics istekleri cookie consent kontrolune takilabilir. Mobile API
  bearer token kullaniyor ve web consent cookie'si yok; bu durumda session/event
  endpoint'leri `{ disabled: true }` dondurur.
- Web analytics consent cookie ile bagli; privacy acisindan iyi.
- Analytics resource isimlendirmesi permission sistemiyle eslesmiyor.

## Oneriler

- `analytics` resource'u permission matrix'e eklenmeli ve seed/backfill
  yapilmali.
- Mobile icin ayri analytics consent modeli/API header'i tanimlanmali.
- Analytics ekranlari icin PII-free default, drill-down icin daha yuksek
  permission modeli uygulanmali.
