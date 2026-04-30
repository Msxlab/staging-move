# Tickets Audit

## Baglanti Durumu

- Sidebar label: Tickets -> `/support`
- Alias: `/tickets` sayfalari `/support`'a redirect ediyor.
- Admin API: `/api/tickets`, `/api/tickets/[id]`
- Web/mobile user support: `/api/tickets`, `/api/tickets/[id]`
- Mobile help ticket ekranlari bagli.

## Guvenlik

- Admin read `tickets canRead` + minimum ADMIN. Bu dogru; support mesajlari PII
  tasiyor.
- User tarafinda internal admin notes gizleniyor.
- Admin detail user subscription/moving/services/customProviders contextini de
  getiriyor; support icin faydali ama alan minimizasyonu gerektirir.

## Mantik ve Eksik

- Admin reply/status degisiklikleri kullaniciya notification/email tetikliyor
  gibi gorunmuyor; kullanici sadece sayfaya girerse gorur.
- `assignedTo` string olarak tutuluyor; aktif admin varligi/role validasyonu
  zayif.
- Kullanici ticket priority olarak `URGENT` secebilir; abuse/triage politikasi
  yok.
- SLA hesaplari runtime derived; policy configurability ve audit trail sinirli.

## Oneriler

- Admin reply/status update sonrasi in-app/email notification.
- Assignment icin admin id FK veya server-side active admin validation.
- User-created urgent priority icin rate/abuse guard veya moderator escalation.
