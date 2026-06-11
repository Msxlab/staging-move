# Modül Denetimi: Services

## 1. Modülün Amacı
Kullanıcının/provider'ın adreslere bağlı servis, abonelik, fatura ve kontrat bilgilerini yönetmek.

## 2. Ana Dosyalar
- `apps/web/src/app/api/services/*`
- `apps/web/src/app/(app)/services/*`
- `apps/mobile/app/services/*`
- `packages/db/prisma/schema.prisma`: `Service`, `Reminder`

## 3. Bağlantılar
Address, provider catalog, custom providers, notifications, budget, moving task sync.

## 4. Veri Akışı
Service form -> API validation/encryption -> Service DB -> UI/dashboard/reminders/export.

## 5. UI/UX Denetimi
Service detail strong; Documents card mismatch.

## 6. API/Backend Denetimi
Auth, verified user, workspace scoping, duplicate guard, sensitive encryption, soft delete.

## 7. Database Denetimi
Service model rich; Document relation absent.

## 8. Permission/Auth Denetimi
Scoped record action helpers.

## 9. Edge Case Denetimi
Duplicate service, custom vs listed provider mutual exclusion, deleted address/provider.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-001 Documents missing.

## 11. Mantık Hataları
Document UI type expectation not backed by route/schema.

## 12. Öneriler
Document cleanup or implementation.

## 13. Test Senaryoları
Duplicate create, edit ownership, delete soft, documents absent.

## 14. Sonuç
⚠️ Riskli
