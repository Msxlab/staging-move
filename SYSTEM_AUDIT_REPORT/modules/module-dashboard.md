# Modül Denetimi: Dashboard

## 1. Modülün Amacı
Kullanıcıya address/service/move/budget/notification özetlerini göstermek.

## 2. Ana Dosyalar
- `apps/web/src/app/(app)/dashboard*`
- `apps/mobile/app/(tabs)/index.tsx`
- Profile/domain APIs.

## 3. Bağlantılar
Addresses, services, moving plans, budgets, subscription, notifications.

## 4. Veri Akışı
App shell -> domain APIs/profile -> dashboard cards/lists.

## 5. UI/UX Denetimi
Empty state mesajları i18n'de mevcut.

## 6. API/Backend Denetimi
Backend data source gerçek domain models.

## 7. Database Denetimi
Address/Service/MovingPlan/Budget/Notification.

## 8. Permission/Auth Denetimi
Authenticated route. Data scoped by user/workspace.

## 9. Edge Case Denetimi
Empty user, no services, subscription missing, network errors.

## 10. Hata/Eksik/Yanlış Listesi
Dashboard özelinde kanıtlı kritik bug bulunmadı.

## 11. Mantık Hataları
Documents promised but dashboard/doc nav copy current feature ile hizalanmalı.

## 12. Öneriler
Authenticated dashboard E2E.

## 13. Test Senaryoları
New user dashboard, data-loaded dashboard, expired session redirect.

## 14. Sonuç
✅ Sağlam
