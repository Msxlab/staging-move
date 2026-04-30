# Users Audit

## Baglanti Durumu

- Admin liste/detail: `/api/users`, `/api/users/[id]`
- Impersonation: `/api/users/[id]/impersonate`
- Subscription actions: `/api/users/[id]/subscription-actions`
- Web/mobile user kaynaklari ayni DB `User`, `Subscription`, `Profile`,
  `Address`, `Service`, `MovingPlan`, `Ticket`, `Notification`, session ve
  audit modellerini besliyor.

## Guvenlik

- Liste okuma `users canRead` + VIEWER. Bulk delete ve single delete ADMIN +
  password step-up. Restore SUPER_ADMIN + step-up. Impersonation SUPER_ADMIN +
  step-up.
- Detail endpoint VIEWER icin cok genis PII donduruyor: adresler, services,
  moving plans, sessions, IP/user-agent, reset token zamanlari, OAuth hintleri,
  support ticket context, GDPR requestleri ve internal notes.
- Impersonation token JSON ile donuyor ve web internal endpoint gizli secret ile
  korunuyor; bu tasarim dogru.

## Mantik ve Eksik

- Delete path'lerinde `id === session.adminId` kontrolu var. App user id ile
  admin user id farkli domainler oldugu icin self-delete kontrolu anlamsiz.
- PATCH subscription alanlari string/date olarak geliyor; plan/status/accessType
  icin server-side enum validasyonu yetersiz. UI korusa bile direkt API
  bozuk deger yazabilir.
- Detail endpoint'te audit amaci olmayan alanlar icin maskeleme yok.

## Oneriler

- User detail'i `overview`, `security`, `billing`, `support`, `events` gibi
  alt endpoint'lere ayirin ve her biri icin minimum role/permission belirleyin.
- Billing/subscription yazmalarinda zod enum validasyonu kullanin.
- App user silmede self-delete kontrolunu kaldirin veya gercek hedefe uygun
  hale getirin.
- VIEWER icin IP, user-agent, reset token, OAuth ve full address detaylarini
  maskeleyin.
