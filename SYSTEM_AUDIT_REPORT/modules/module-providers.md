# Modül Denetimi: Providers

## 1. Modülün Amacı
Service provider catalog, recommendations, coverage, custom providers and governance.

## 2. Ana Dosyalar
- `apps/web/src/app/api/providers/*`
- `apps/web/src/app/api/custom-providers/*`
- `apps/admin/src/app/api/providers/*`
- `packages/db/prisma/schema.prisma`: `ServiceProvider`, `UserCustomProvider`, governance models.

## 3. Bağlantılar
Services, provider recommendations, admin governance, connectors/guided actions.

## 4. Veri Akışı
Catalog/admin seed -> provider APIs -> service selection/recommendations -> user service records.

## 5. UI/UX Denetimi
Provider directory and coverage disclaimers reduce verified-provider risk.

## 6. API/Backend Denetimi
Provider public endpoints and admin CRUD.

## 7. Database Denetimi
Provider model and coverage/governance records.

## 8. Permission/Auth Denetimi
Admin provider mutation guarded; public provider reads allowed where expected.

## 9. Edge Case Denetimi
Deleted provider, custom provider trust, duplicate custom providers.

## 10. Hata/Eksik/Yanlış Listesi
Automatic provider update copy is integration/homepage issue (AUD-003).

## 11. Mantık Hataları
Provider directory guidance correctly says verify details.

## 12. Öneriler
Provider public route tests and admin governance tests.

## 13. Test Senaryoları
Provider search/filter, custom provider CRUD, admin update permissions.

## 14. Sonuç
✅ Sağlam
