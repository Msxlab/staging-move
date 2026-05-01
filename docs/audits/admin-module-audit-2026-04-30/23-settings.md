# Settings Audit

## Baglanti Durumu

- Admin: `/api/settings`
- Runtime config summary, integration readiness, counts, current admin profile
  ve grant premium aksiyonunu kapsiyor.
- Web/mobile entegrasyonlari runtime config ve subscription modeli uzerinden
  dolayli bagli.

## Guvenlik

- GET `settings canRead` + ADMIN, fallback `audit_logs`.
- POST SUPER_ADMIN.
- `grant_premium` password step-up istiyor; iyi.
- `test_stripe` dogrudan `process.env.STRIPE_SECRET_KEY` okuyor; runtime config
  DB override'i kullanmiyor gibi gorunuyor.

## Mantik ve Eksik

- Settings cok genis bir catch-all permission haline gelmis: reports,
  notifications, help, waitlist, feature flags, security, backups gibi farkli
  risk seviyeleri bu resource'a yaslaniyor.
- Integration readiness bircok key'in configured olup olmadigini kontrol ediyor
  ama provider seviyesinde gercek health check sinirli.
- Grant premium plan/duration icin enum/range validasyonu daha siki olmali.

## Oneriler

- `settings` resource'unu parcalayin: security, runtime_config, backups,
  notifications, help_center, waitlist, feature_flags, reports.
- Stripe test runtime config helper ile ayni kaynak onceligini kullansin.
- Grant premium icin zod schema, max duration policy ve audit note required.
