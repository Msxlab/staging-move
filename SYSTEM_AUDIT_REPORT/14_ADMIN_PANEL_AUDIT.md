# Admin Panel Denetimi

## Sayfa/Screen Listesi

Admin panel; login, dashboard, users, providers, billing/subscriptions, analytics, logs, security, runtime config, feature flags, team, reports, backups, blog/content, support/tickets, state rules, connectors, acquisition campaigns, email templates/health ve notifications yüzeylerini içerir.

## Route Listesi

Admin API `apps/admin/src/app/api` altında geniş route yüzeyi içerir. Auth/security, users, billing, providers, analytics, content, backups, runtime config, connectors ve support route grupları mevcuttur.

## Component Listesi

Admin component inventory bu audit'te dosya bazlı ayrıntılandırılmadı; route/API/security yüzeyi önceliklendirildi.

## API Bağlantıları

- Admin auth/session/MFA/password.
- Users/subscription actions/impersonate.
- Provider CRUD/governance/logo.
- Blog/content CRUD/upload.
- Reports/analytics/logs/export.
- Runtime config/feature flags/settings.
- Connectors health/config/consents/fallbacks.
- Backup import/export/verify/download.

## Kullanıcı Akışları

1. Admin login -> MFA setup/verification -> dashboard.
2. User inspect/update/subscription action/impersonation.
3. Provider and state rule governance.
4. Billing/subscription review.
5. Content/blog publish.
6. Security/log review.
7. Runtime config and feature flag update.
8. Backup/export operations.

## UI Bulguları

- Sensitive admin operations backend password confirmation/MFA patternine bağlı.
- Admin UX için route-level test boşlukları content/analytics/support alanlarında regression riskidir.

## UX Bulguları

- Operational admin panel kapsamlı.
- Çok geniş admin yüzeyi için role-specific navigation/permission hidden state'leri backend tests ile desteklenmeli.

## Hata/Eksik/Yanlış Bulguları

| ID | Alan | Öncelik | Durum |
|---|---|---|---|
| AUD-007 | Process-local admin rate limit | P2 | Riskli |
| AUD-008 | Admin route test gaps | P2 | Riskli |
| AUD-013 | Admin content/analytics route tests | P2 | Riskli |

## Permission Bulguları

- `apps/admin/src/lib/auth.ts` `requireAdmin`, `requirePermission`, `requirePasswordConfirm` içeriyor.
- Middleware MFA setup gate, IP rule ve session fingerprint kontrolleri içeriyor.
- Mechanical guard check'te public health dışında açık guard eksikliği kanıtlanmadı.

## Data Tutarlılığı

Admin panel tüm ana modelleri görme/değiştirme yetkisine sahip olduğundan audit log tutarlılığı kritik. `AdminAuditLog`, `AdminLoginLog`, `RuntimeConfigEntry`, `BackupRecord` modelleri mevcut.

## Öneriler

1. Admin rate limiting'i shared store'a taşı.
2. Content/analytics/support route'ları için permission/validation tests ekle.
3. Admin destructive actions için password confirmation coverage'ı artır.
4. Admin UI'da connector/payment/notification readiness health panelini görünür yap.
