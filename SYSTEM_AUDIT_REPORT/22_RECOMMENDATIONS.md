# Recommendations

## Product Recommendations

## Öneri: Canlı copy'yi current capability ile kilitle

- Kategori: Product
- Neden gerekli: Documents, snap bill ve automatic USPS copy uyumsuz.
- Etki: Trust/legal/support riskini azaltır.
- Öncelik: P1
- İlgili dosyalar/modüller: Homepage, how-it-works, about, AI discovery, pricing.
- Uygulanabilir aksiyon: Forbidden claims list ve copy tests.
- Test yöntemi: Feature flag false iken automatic/capture copy görünmemeli.

## UX Recommendations

## Öneri: Unavailable feature state göster

- Kategori: UX
- Neden gerekli: Push/SMS/connector capability env ve config'e bağlı.
- Etki: Kullanıcı beklentisi netleşir.
- Öncelik: P2
- Aksiyon: Notification/connector settings içinde availability reason.
- Test: Env disabled state UI.

## UI Recommendations

## Öneri: Documents UI kırıntısını kaldır veya tamamla

- Kategori: UI
- Neden gerekli: Pasif `service.documents` kartı feature sinyali veriyor.
- Etki: Confusion azalır.
- Öncelik: P1
- Test: Service detail documents feature flag.

## Backend Recommendations

## Öneri: Webhook idempotency reservation standardı

- Kategori: Backend
- Neden gerekli: Processing marker işlem sonunda.
- Etki: Duplicate side effect riskini düşürür.
- Öncelik: P2
- Test: Concurrent duplicate webhook.

## Database Recommendations

## Öneri: Notification dedupe key normalize et

- Kategori: Database
- Neden gerekli: JSON contains query ve no unique.
- Etki: Correctness/performance.
- Öncelik: P2
- Test: Concurrent duplicate create.

## Security Recommendations

## Öneri: Admin distributed rate limit

- Kategori: Security
- Neden gerekli: Process-local Map.
- Etki: Multi-instance abuse protection.
- Öncelik: P2
- Test: Multi-instance/shared limiter.

## Payment Recommendations

## Öneri: Payment concurrency testleri

- Kategori: Payment
- Neden gerekli: Webhook duplicate/race.
- Etki: Subscription correctness.
- Öncelik: P2
- Test: Same event id concurrent POST.

## Notification Recommendations

## Öneri: Cron notification test matrix

- Kategori: Notification
- Neden gerekli: Duplicate/preference/push disabled cases.
- Etki: Delivery reliability.
- Öncelik: P2
- Test: Preference combinations and reruns.

## Admin Panel Recommendations

## Öneri: Admin route permission tests

- Kategori: Admin Panel
- Neden gerekli: 31 adjacent route test gap.
- Etki: Permission regression riskini düşürür.
- Öncelik: P2
- Test: requireAdmin/requirePermission assertions.

## Mobile Recommendations

## Öneri: Mobile emulator smoke suite

- Kategori: Mobile
- Neden gerekli: Mobile tests lib ağırlıklı.
- Etki: Native regressions yakalanır.
- Öncelik: P2
- Test: Login/IAP/push/export.

## Testing Recommendations

## Öneri: Route coverage inventory CI artifact

- Kategori: Testing
- Neden gerekli: Route yüzeyi hızlı büyüyor.
- Etki: Test boşlukları görünür kalır.
- Öncelik: P2
- Test: CI fails/warns on high-risk route without test.

## Performance Recommendations

## Öneri: Cron queue/backpressure

- Kategori: Performance
- Neden gerekli: Long-running HTTP cron riski.
- Etki: Reliability/scaling.
- Öncelik: P2
- Test: Large dataset cron.

## Maintainability Recommendations

## Öneri: Current architecture doc üret

- Kategori: Maintainability
- Neden gerekli: `RELOCATION_MANAGER_SPEC.md` drift yaratıyor.
- Etki: Onboarding/audit accuracy.
- Öncelik: P3
- Test: Docs/current schema consistency checklist.
