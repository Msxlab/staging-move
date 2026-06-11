# Modül Denetimi: Integrations

## 1. Modülün Amacı
Stripe, stores, email, push, connectors, storage ve monitoring entegrasyonlarını yönetmek.

## 2. Ana Dosyalar
- Payment/webhook routes.
- `apps/web/src/lib/notifications.ts`
- `apps/web/src/lib/connector-runtime.ts`
- `packages/connectors/*`
- `apps/web/src/lib/storage/r2-client.ts`

## 3. Bağlantılar
External services and internal DB models.

## 4. Veri Akışı
Internal event/request -> external provider -> webhook/callback -> DB update -> notification/UI.

## 5. UI/UX Denetimi
Connector UI accurate; homepage automatic copy risk.

## 6. API/Backend Denetimi
Webhook signature controls present for Stripe/connector; store route guards present.

## 7. Database Denetimi
ProcessedWebhookEvent, PartnerConsent, ConnectorDispatch, EmailLog, PushDevice.

## 8. Permission/Auth Denetimi
External callbacks use signatures/secrets; user-triggered routes use auth.

## 9. Edge Case Denetimi
Provider down, webhook retry, connector disabled, push capability disabled.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-003 connector copy.
- AUD-004 webhook idempotency.
- AUD-010 push/SMS readiness.

## 11. Mantık Hataları
Capabilities not always tied to public copy.

## 12. Öneriler
Integration readiness dashboard and shared webhook idempotency.

## 13. Test Senaryoları
Bad signature, duplicate webhook, connector disabled, push disabled.

## 14. Sonuç
⚠️ Riskli
