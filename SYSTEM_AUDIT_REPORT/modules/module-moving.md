# Modül Denetimi: Moving

## 1. Modülün Amacı
Taşınma planları, state-aware task generation ve move reminders.

## 2. Ana Dosyalar
- `apps/web/src/app/api/moving/*`
- `apps/web/src/app/api/move-tasks/*`
- `apps/web/src/app/api/cron/move-reminders/route.ts`
- `packages/db/prisma/schema.prisma`: `MovingPlan`, `MoveTask`, `StateRule`

## 3. Bağlantılar
Address, services, notifications, state rules, workspace.

## 4. Veri Akışı
Create moving plan -> task sync/generation -> reminders -> dashboard/mobile.

## 5. UI/UX Denetimi
Moving pages and mobile screens exist.

## 6. API/Backend Denetimi
Routes tested partially; cron tests need strengthening.

## 7. Database Denetimi
MovingPlan and MoveTask models.

## 8. Permission/Auth Denetimi
User/workspace scoped.

## 9. Edge Case Denetimi
Move date timezone, duplicate generated tasks, deleted addresses.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-006 Cron batch/test standard.

## 11. Mantık Hataları
No critical logic bug proven.

## 12. Öneriler
Move reminder timezone tests.

## 13. Test Senaryoları
Create plan, generate tasks, rerun sync idempotency, reminder duplicate.

## 14. Sonuç
⚠️ Riskli
