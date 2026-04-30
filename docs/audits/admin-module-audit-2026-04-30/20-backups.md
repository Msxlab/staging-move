# Backups Audit

## Baglanti Durumu

- Admin:
  - `/api/backup`
  - `/api/backup/import`
  - `/api/backup/verify`
  - `/api/backup/retention`
  - `/api/backup/[id]/download`
  - `/api/cron/backup`
- Web/mobile veri modellerini DB uzerinden yedeklemeyi hedefliyor.

## Guvenlik

- Create/download/import gibi hassas islemlerde password step-up var.
- Production policy encryption + signature + offsite storage gerektiriyor.
- Download sadece POST + password confirm ile calisiyor; GET kapali.
- Import signature verification istiyor; REPLACE/MERGE transaction kullaniyor.

## Kritik Eksikler

- "FULL" backup tum sistemi kapsamiyor. Eksik gorulen modeller:
  `PushDevice`, `MobileOAuthCode`, `UserLoginSession`, reset/email verification
  tokenlari, `AcquisitionCampaign`, `AcquisitionRedemption`, `Reminder`,
  `StateRule`, `UserSession`, `UserEvent`, `AdminSession`,
  `RuntimeConfigEntry`, `NotificationPreference`, `NotificationQueue`,
  `EmailTemplate`, `HelpArticle`, `FAQ`, `FeatureFlag`, `IPRule`,
  `RateLimitLog`, `ProcessedWebhookEvent`, `GDPRRequest`, `SupportTicket`,
  `TicketMessage`, `WaitlistSignup` ve yeni blog modelleri.
- Manual backup her tablo icin `take: 50000` kullaniyor; 50.000 ustu veri
  sessizce eksik kalir.
- Cron backup fetcher listesinde `providerLogoCandidates` yok; tablo listede
  ilan edildigi halde veri cekilmeyebilir.
- Retention DB backup recordlarini siliyor ama offsite object cleanup gorunmuyor.
- Browser fallback non-production'da full archive'i response ile dondurebilir;
  local icin kabul edilebilir ama boyut/PII riski yuksek.

## Oneriler

- Backup tablo listesini schema ile otomatik audit eden test ekleyin.
- Cursor/pagination ile tam yedek; truncation varsa backup FAILED olmali.
- Cron/manual table listeleri tek kaynaktan uretilmeli.
- Offsite object retention/delete implementasyonu.
- RuntimeConfigEntry icin secret-aware export politikasi belirlenmeli.
- Restore drill sonucu `backup_dr_proof` readiness kontrolune baglanmali.
