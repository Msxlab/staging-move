# Modül Denetimi: Settings

## 1. Modülün Amacı
Profile, subscription, notification preferences, export/privacy, connections, workspace ve account deletion ayarları.

## 2. Ana Dosyalar
- `apps/web/src/app/(app)/settings/*`
- `apps/mobile/app/settings/*`
- Settings-related API routes.

## 3. Bağlantılar
Profile, billing, notifications, export, connectors, workspace, privacy/account.

## 4. Veri Akışı
Settings UI -> API -> DB/external provider -> UI state.

## 5. UI/UX Denetimi
Kritik billing/delete/export copyleri iyi; notification/connector availability daha görünür olmalı.

## 6. API/Backend Denetimi
Auth required; export step-up; connectors feature flag.

## 7. Database Denetimi
User/Profile/Subscription/NotificationPreference/PartnerConsent/Workspace.

## 8. Permission/Auth Denetimi
User scoped; workspace roles.

## 9. Edge Case Denetimi
Store-managed subscriptions, push denied, connector disabled, export step-up fail.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-010 Channel readiness.
- AUD-003 Connector copy/availability.

## 11. Mantık Hataları
Settings accurate; marketing copy less accurate.

## 12. Öneriler
Availability badges and admin-config health.

## 13. Test Senaryoları
Update preferences, export PDF, subscription portal, connector disabled.

## 14. Sonuç
✅ Sağlam
