# Waitlist Audit

## Baglanti Durumu

- Admin: `/api/waitlist`
- Web: `/api/waitlist`
- Mobile app icinden waitlist submit gorunmuyor; marketing/mobile interest web
  uzerinden geliyor.

## Guvenlik

- Permission `settings` altinda.
- Web submit zod validation, rate limit, lowercase email, IP hash ve
  idempotency kullaniyor; iyi.
- Admin GET full signup kayitlarini donduruyor. Email, note, userAgent,
  locale, userId ve muhtemelen ipHash gibi alanlar toplu gorunuyor.

## Mantik ve Eksik

- 500 kayit limiti ve client-side export var; server-side pagination/export
  yok.
- `notifiedAt`/`convertedAt` toggle ediliyor ama campaign/email automation
  baglantisi yok.

## Oneriler

- `waitlist` permission kaynagi ve PII masking.
- Server-side pagination + audited CSV export.
- Notify/convert aksiyonlarini email/CRM workflow ile baglayin.
