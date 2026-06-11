# Modül Denetimi: Budget

## 1. Modülün Amacı
Address-level budget tracking and monthly cost snapshots.

## 2. Ana Dosyalar
- `apps/web/src/app/api/budget/*`
- `apps/web/src/app/(app)/budget/*`
- `apps/mobile/app/budget/*`
- Prisma `Budget`.

## 3. Bağlantılar
Address, services, export/dashboard.

## 4. Veri Akışı
Budget form -> API -> Budget DB -> dashboard/export.

## 5. UI/UX Denetimi
Budget empty state and mobile screens exist.

## 6. API/Backend Denetimi
Route tests present for budget route.

## 7. Database Denetimi
Budget model with monthly fields/category breakdown.

## 8. Permission/Auth Denetimi
User/workspace scoping expected.

## 9. Edge Case Denetimi
Invalid costs, deleted address, large category breakdown.

## 10. Hata/Eksik/Yanlış Listesi
Kanıtlı kritik bug bulunmadı.

## 11. Mantık Hataları
No issue proven.

## 12. Öneriler
Budget mobile/web parity tests.

## 13. Test Senaryoları
Create/update/delete, invalid amount, ownership.

## 14. Sonuç
✅ Sağlam
