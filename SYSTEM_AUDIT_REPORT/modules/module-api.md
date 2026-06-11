# Modül Denetimi: API

## 1. Modülün Amacı
Web, admin ve mobile clients için backend işlemlerini sağlamak.

## 2. Ana Dosyalar
- `apps/web/src/app/api/*`
- `apps/admin/src/app/api/*`
- `apps/web/src/middleware.ts`
- `apps/admin/src/middleware.ts`

## 3. Bağlantılar
Auth, DB, payments, notifications, connectors, admin, mobile.

## 4. Veri Akışı
Client request -> middleware -> route handler -> auth/validation/rate limit -> Prisma/external API -> response.

## 5. UI/UX Denetimi
Error responses structured in many routes.

## 6. API/Backend Denetimi
Route handler pattern kapsamlı; test gaps var.

## 7. Database Denetimi
Prisma as single data access layer.

## 8. Permission/Auth Denetimi
Strong helper usage; public allowlists must stay controlled.

## 9. Edge Case Denetimi
Validation, auth, forbidden/not found, rate limit, duplicate.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-004 webhook idempotency.
- AUD-006 cron batch/test.
- AUD-008 route test gaps.

## 11. Mantık Hataları
No global route test policy.

## 12. Öneriler
Route inventory CI, idempotency standard, cron runner standard.

## 13. Test Senaryoları
Adjacent route tests, public/private matrix, validation and rate-limit.

## 14. Sonuç
⚠️ Riskli
