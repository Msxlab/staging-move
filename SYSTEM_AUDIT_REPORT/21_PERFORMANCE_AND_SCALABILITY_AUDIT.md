# Performance ve Scalability Denetimi

## Genel Durum

Uygulama route handler ve Prisma tabanlı. Performans açısından en önemli riskler cron job batch standardı, notification dedupe query pattern'i, admin rate limit'in process-local oluşu ve büyük export/analytics/admin sorgularıdır.

## Performance Bulgusu: Reminder cron batch standardı tutarsız

- Alan: Notifications/Cron
- Dosya: `apps/web/src/app/api/cron/*`
- Mevcut davranış: `task-reminders` `take: 500` içeriyor; bazı reminder route'larında açık batch/cursor standardı görülmedi.
- Risk: Büyük kullanıcı/service tablosunda uzun request, timeout, duplicate retry.
- Etki: Notification gecikmesi veya cron failure.
- Ölçeklenince ne olur: Tek HTTP route iş yükü büyür.
- Öneri: Queue/cursor batch runner, per-run limits, retry jobs.
- Öncelik: P2

## Performance Bulgusu: In-app dedupe metadata contains

- Alan: Notifications/DB
- Dosya: `apps/web/src/lib/in-app-notifications.ts`
- Mevcut davranış: `metadata contains dedupeKey`.
- Risk: Indexsiz string scan, false-positive/duplicate race.
- Etki: Notification tablosu büyüdükçe latency.
- Öneri: Dedicated indexed dedupeKey.
- Öncelik: P2

## Performance Bulgusu: Admin rate limit process-local

- Alan: Admin/Security/Scaling
- Dosya: `apps/admin/src/middleware.ts`
- Mevcut davranış: In-memory Map.
- Risk: Multi-instance'da limit parçalanır; memory reset.
- Öneri: Shared Redis/Upstash limiter.
- Öncelik: P2

## Performance Bulgusu: Large exports synchronous olabilir

- Alan: Export/PDF
- Dosya: `/api/export`, `/api/export/pdf`
- Mevcut davranış: Request içinde snapshot/PDF üretiliyor.
- Risk: Büyük hesaplarda latency/memory.
- Öneri: Threshold sonrası async export job + notification.
- Öncelik: P3

## Performance Bulgusu: Admin analytics/report sorguları test boşluğu

- Alan: Admin Analytics
- Dosya: `apps/admin/src/app/api/analytics/*`, `reports`
- Mevcut davranış: Kapsamlı route yüzeyi; bazı route testleri eksik.
- Risk: Büyük data üzerinde yavaş query/regression.
- Öneri: Query plan/index review ve pagination tests.
- Öncelik: P2

## Image/Bundle/Lazy Loading

Bu audit statik kod ağırlıklı yapıldı; bundle size veya browser runtime ölçümü yapılmadı. Frontend performans için Playwright/Lighthouse veya Next bundle analyzer önerilir.

## Öneriler

1. Cronları queue/batch runner'a taşı.
2. Notification dedupe index.
3. Admin analytics query plans.
4. Large export async mode.
5. Browser performance smoke testleri.
