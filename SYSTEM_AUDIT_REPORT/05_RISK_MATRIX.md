# Risk Matrisi

| ID | Risk | Modül | Etki | Olasılık | Öncelik | Kanıt | Öneri |
|---|---|---|---|---|---|---|---|
| AUD-001 | Belgeler ürün vaadi gerçek DB/API upload akışıyla karşılanmıyor | Documents/Services | High | High | P1 | `how-it-works/page.tsx`, `service.documents`, schema'da Document modeli yok | Copy kaldır veya Document feature tamamla |
| AUD-002 | "Snap a bill" vaadi mobile capture/OCR olmadan gösteriliyor | Homepage/Mobile | High | High | P1 | `messages/en.json`, `MOBILE_DATA_INVENTORY.md` camera/photo yok | Copy değiştir veya capture/OCR ekle |
| AUD-003 | USPS forwarding automatic copy connector gerçekliğiyle çelişiyor | Homepage/Connectors | High | Medium | P1 | `mm_bullet_1`, `connector-runtime.ts`, catalog guided fallback | Guided/conditional copy kullan |
| AUD-004 | Stripe webhook global idempotency marker işlem sonunda yazılıyor | Payments | High | Medium | P2 | `hasProcessedWebhookEvent` önce, `markWebhookEventProcessed` sonda | Atomic reserve/status model |
| AUD-005 | In-app notification dedupe JSON contains ile yapılıyor | Notifications | Medium | High | P2 | `in-app-notifications.ts`, `Notification` dedupeKey yok | Dedicated dedupeKey unique index |
| AUD-006 | Reminder cron test/batch standardı tutarsız | Notifications/Cron | Medium | Medium | P2 | Cron route inventory, bazı route testleri eksik | Batch runner + tests |
| AUD-007 | Admin rate limit process-local | Admin Security | Medium | Medium | P2 | `apps/admin/src/middleware.ts` `Map` | Redis/Upstash shared limiter |
| AUD-008 | API/E2E/mobile test boşlukları | QA | Medium | High | P2 | 323 test/spec; 52 web + 31 admin adjacent route test gap; E2E public/accessibility | Risk-first test plan |
| AUD-009 | Spec/docs drift current system'i yanlış anlatıyor | Documentation | Low | High | P3 | `RELOCATION_MANAGER_SPEC.md`, current Prisma/app code ayrışması | Deprecated/current truth ayırımı |
| AUD-010 | Push/SMS delivery availability belirsiz | Notifications/Mobile | Medium | Medium | P2 | `sendNotification`, SMS fail-closed, push env flag | Readiness UI/admin health |
| AUD-011 | Connector public copy ve runtime flagleri aynı release guard altında değil | Integrations | Medium | Medium | P2 | landing connector gated, `mm_bullet_1` ungated | Copy feature flag audit |
| AUD-012 | Cron HTTP route'ları uzun request'e dönüşebilir | Performance | Medium | Medium | P2 | `bill-reminders`, `contract-reminders`, `move-reminders` route patterns | Queue/backpressure |
| AUD-013 | Admin content/analytics route testleri eksik | Admin QA | Medium | Medium | P2 | Admin missing adjacent route tests list | Permission + validation tests |
| AUD-014 | Mobile screen/E2E testleri sınırlı | Mobile QA | Medium | Medium | P2 | Mobile 15 lib tests; no emulator flow tests found | Auth/IAP/push/offline E2E |
| AUD-015 | Notification Queue modelinde dedupe var ama in-app feed ayrı dedupe yapıyor | Data Flow | Low | Medium | P3 | `NotificationQueue.dedupeKey @unique`, `Notification` no dedupe | Dedupe stratejisini birleştir |
