# Modül Denetimi: Privacy/Export

## 1. Modülün Amacı
Kullanıcı verisini CSV/JSON/PDF olarak dışa aktarmak, privacy/account deletion/restore süreçlerini yönetmek.

## 2. Ana Dosyalar
- `apps/web/src/app/api/export/route.ts`
- `apps/web/src/app/api/export/pdf/route.ts`
- `apps/web/src/app/api/account/*`
- `apps/web/src/app/(app)/settings/export/page.tsx`
- Prisma `GDPRRequest`, user/account deletion fields.

## 3. Bağlantılar
User, subscription, addresses, services, moving, support, notifications, PDF generators.

## 4. Veri Akışı
Settings export -> step-up verification -> DB snapshot -> CSV/JSON/PDF response.

## 5. UI/UX Denetimi
Export settings and PDF copy exist.

## 6. API/Backend Denetimi
Auth, rate limit, step-up, Pro-gated tax export.

## 7. Database Denetimi
Reads from many domain models; GDPR request model exists.

## 8. Permission/Auth Denetimi
Strong: require user and step-up for exports.

## 9. Edge Case Denetimi
Large account export may become long request.

## 10. Hata/Eksik/Yanlış Listesi
No direct bug; performance risk for large accounts.

## 11. Mantık Hataları
No issue proven.

## 12. Öneriler
Async export threshold if data grows.

## 13. Test Senaryoları
Step-up fail, tax export plan gate, PDF content type, large snapshot.

## 14. Sonuç
✅ Sağlam
