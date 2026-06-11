# Modül Denetimi: Database

## 1. Modülün Amacı
Tüm domain, auth, billing, admin, notification, connector ve workspace verilerini saklamak.

## 2. Ana Dosyalar
- `packages/db/prisma/schema.prisma`
- `packages/db/prisma/migrations/*`
- `packages/db/src/*`

## 3. Bağlantılar
Web/admin/mobile API route'ları, Prisma client.

## 4. Veri Akışı
Route handlers -> Prisma -> MySQL.

## 5. UI/UX Denetimi
DB kaynaklı empty/error states UI'da görünür.

## 6. API/Backend Denetimi
Model kapsamı geniş.

## 7. Database Denetimi
Soft delete, timestamps, indexes ve relations yaygın.

## 8. Permission/Auth Denetimi
DB-level row policy yok; authorization app-level.

## 9. Edge Case Denetimi
Duplicate constraints, webhook processed events, notification dedupe, soft delete filtering.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-001 Document model yok.
- AUD-005 Notification dedupeKey yok.
- AUD-004 ProcessedWebhookEvent status yok.

## 11. Mantık Hataları
Docs/spec bazı DB modellerini current schema dışında anlatıyor.

## 12. Öneriler
Notification and webhook migrations; Document model only if feature ships.

## 13. Test Senaryoları
Migration validation, unique constraints, soft delete scoped reads.

## 14. Sonuç
⚠️ Riskli
