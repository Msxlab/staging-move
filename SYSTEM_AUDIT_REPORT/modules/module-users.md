# Modül Denetimi: Users

## 1. Modülün Amacı
Kullanıcı profili, subscription snapshot, preferences, account deletion/restore ve admin user operations.

## 2. Ana Dosyalar
- `packages/db/prisma/schema.prisma`: `User`, `Profile`, `DataConsent`, `GDPRRequest`.
- `apps/web/src/app/api/profile/route.ts`
- `apps/web/src/app/api/account/*`
- `apps/admin/src/app/api/users/*`

## 3. Bağlantılar
Auth, subscription, export, notifications, admin audit, workspace.

## 4. Veri Akışı
Auth user -> profile/settings -> profile API -> User/Profile DB -> admin user views.

## 5. UI/UX Denetimi
Settings/profile/privacy/delete-account ekranları var; account delete store-managed subscriptions konusunda uyarıyor.

## 6. API/Backend Denetimi
Profile/account routes user auth gerektirir. Admin user routes requireAdmin/permission patterniyle korunur.

## 7. Database Denetimi
Soft delete, deletion scheduled fields, consent/GDPR request modelleri mevcut.

## 8. Permission/Auth Denetimi
User kendi datasına scoped; admin permission gerekli.

## 9. Edge Case Denetimi
Deleted user, account restore, subscription cancellation edge'leri route seviyesinde ele alınmış.

## 10. Hata/Eksik/Yanlış Listesi
Admin route test gapleri users dışında daha çok content/analytics alanında; user core tests mevcut.

## 11. Mantık Hataları
Kanıtlı ciddi user data leak bulunmadı.

## 12. Öneriler
Account deletion/export için E2E smoke tests.

## 13. Test Senaryoları
User update, delete restore, admin impersonate audit, GDPR export/delete.

## 14. Sonuç
✅ Sağlam
