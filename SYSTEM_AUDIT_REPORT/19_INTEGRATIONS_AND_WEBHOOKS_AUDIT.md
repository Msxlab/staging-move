# Integrations ve Webhooks Denetimi

## Integration: Stripe

- Kullanım amacı: Web subscriptions.
- Dosyalar: `/api/stripe/*`, `/api/webhooks/stripe`, `billing.ts`.
- Env değişkenleri: Stripe secret, webhook secret, price IDs via runtime config/env.
- API çağrıları: Checkout, portal, subscription retrieve.
- Webhook var mı: Evet.
- Signature doğrulama: Evet.
- Retry/idempotency: Var, ama global marker işlem sonunda.
- Error handling: Event age, livemode mismatch, captureException.
- Security risk: AUD-004.
- Öneriler: Atomic reserve.

## Integration: Apple App Store / Google Play

- Kullanım amacı: Mobile IAP.
- Dosyalar: `/api/mobile/iap/verify`, `/api/webhooks/appstore`, `/api/webhooks/playstore`, mobile `iap.ts`.
- Webhook var mı: Evet.
- Signature/OIDC doğrulama: Route'larda production-like runtime guardları ve tests mevcut.
- Risk: Env/capability readiness.
- Öneriler: Store sandbox E2E.

## Integration: Resend / Email

- Kullanım amacı: Auth, billing, reminders, admin/support email.
- Dosyalar: `apps/web/src/lib/notifications.ts`, email helper/templates/logging.
- Webhook var mı: `/api/webhooks/resend`.
- Risk: Delivery failure handling/outbox retry stratejisinin standardizasyonu.
- Öneriler: Email health admin + retry queue.

## Integration: Expo Push

- Kullanım amacı: Mobile push notifications.
- Dosyalar: `apps/web/src/lib/notifications.ts`, `/api/push/register`, `apps/mobile/src/lib/push.ts`.
- Env/capability: `NOTIFICATION_PUSH_ENABLED`, app push capabilities.
- Risk: Capability/env kapalıyken user preference açık olabilir.
- Öneriler: Readiness endpoint and UI unavailable state.

## Integration: SMS

- Kullanım amacı: Notification channel placeholder.
- Dosyalar: `apps/web/src/lib/notifications.ts`.
- Durum: Provider implementasyonu yok; fail-closed.
- Risk: UI veya copy SMS vaat ederse yanlış olur.
- Öneriler: SMS kanalını UI'da sakla veya provider ekle.

## Integration: Connectors / USPS / Partner APIs

- Kullanım amacı: Address change API sync/guided update.
- Dosyalar: `packages/connectors`, `connector-runtime.ts`, `/api/connectors/*`, `/api/connector-dispatch`, connector webhooks.
- Env değişkenleri: `FEATURE_API_CONNECTORS`, connector-specific credentials/secrets.
- Webhook var mı: Connector inbound webhook.
- Signature doğrulama: Per-connector HMAC.
- Retry/idempotency: Connector dispatch idempotencyKey ve status flow.
- Security risk: Product copy overpromises automatic sync.
- Öneriler: Capability-aware copy and connector readiness dashboard.

## Integration: Sentry

- Kullanım amacı: Error capture.
- Dosyalar: Sentry imports across routes/mobile.
- Risk: Sensitive context review.
- Öneriler: PII scrubbing policy review.

## Integration: Storage/R2

- Kullanım amacı: Blog image upload and possible future document storage.
- Dosyalar: `apps/web/src/lib/storage/r2-client.ts`, blog upload routes.
- Risk: Document storage not implemented; if added, separate content/security policy required.

## Genel Öneriler

1. Webhook idempotency reserve standardını Stripe, connector, store webhooks için ortaklaştır.
2. Integration readiness dashboard: Stripe price IDs, webhook secret, Resend, Expo push, connector configs.
3. Sandbox/production env ayrımını release checklist'e bağla.
4. Product copy sadece integration readiness true ise automation vaat etmeli.
