# Runtime Config Audit

## Baglanti Durumu

- Admin: `/api/runtime-config`
- Admin/web runtime config helpers DB override + ENV fallback okuyor.
- Stripe, email, backup, R2, OAuth, mobile billing ve impersonation gibi
  kritik entegrasyonlar bu katalogdan besleniyor.

## Guvenlik

- GET/PUT/DELETE SUPER_ADMIN + `settings` permission.
- PUT/DELETE password step-up istiyor.
- Secret degerler encrypted storage + masked catalog ile sunuluyor.
- Unknown key reddediliyor; bu iyi.

## Mantik ve Eksik

- `key` ve `value` required; secret rotation workflow var ama validation daha
  cok "configured" seviyesinde. Gercek provider connectivity her key icin yok.
- `value` string trim disinda domain-specific validation yapilmiyor.
- Reset entry `isActive=false` yaparak ENV fallback'e donuyor; iyi ama operator
  etkisini onizleme olarak gormuyor.

## Oneriler

- Domain-specific validators: URL, email, Stripe key env/live, PEM format,
  Redis token, S3 endpoint.
- Change preview ve rollback history.
- `runtime_config` permission resource'u; `settings` altindan ayirin.
