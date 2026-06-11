# Modül Denetimi: Connectors

## 1. Modülün Amacı
Supported partner API sync or guided address update fallback.

## 2. Ana Dosyalar
- `packages/connectors/*`
- `apps/web/src/lib/connector-runtime.ts`
- `apps/web/src/app/api/connectors/*`
- `apps/web/src/app/api/connector-dispatch/route.ts`
- Prisma `PartnerConsent`, `ConnectorConfig`, `ConnectorDispatch`, `AddressChangeEvent`.

## 3. Bağlantılar
Workspaces, addresses, partner consents, notifications, admin connector config.

## 4. Veri Akışı
User consent/config -> address change event -> dispatch rows -> connector -> webhook/confirmation -> UI status.

## 5. UI/UX Denetimi
Settings copy good: supported partners/guided update. Homepage automatic copy mismatch.

## 6. API/Backend Denetimi
Feature flag, entitlement, rollout/circuit, HMAC inbound webhook, idempotencyKey.

## 7. Database Denetimi
Connector outbox tables present.

## 8. Permission/Auth Denetimi
User-triggered routes auth; webhooks signature.

## 9. Edge Case Denetimi
Connector disabled, no production agreement, token refresh failed, async failure -> NEEDS_USER.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-003 automatic copy.

## 11. Mantık Hataları
Product copy not fully tied to connector mode.

## 12. Öneriler
Capability-aware public copy and connector readiness panel.

## 13. Test Senaryoları
Feature flag off, entitlement false, guided fallback, bad webhook signature, terminal replay.

## 14. Sonuç
⚠️ Riskli
