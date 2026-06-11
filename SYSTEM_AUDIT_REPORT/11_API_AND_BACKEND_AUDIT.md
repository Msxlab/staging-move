# API ve Backend Denetimi

## Genel Backend Durumu

Backend, Next.js App Router route handler modeliyle web ve admin uygulamalarının içinde yer alıyor. API yüzeyi çok geniş; route'ların önemli kısmında auth, validation, rate limit, audit ve DB scoping kontrolleri mevcut. Node_modules hariç test inventory 323 test/spec dosyası gösterdi.

## Endpoint Grup Envanteri

### Web API Grupları

- Auth: `/api/auth/login`, register, logout, me, verify-email, password reset/change, MFA, OAuth Google/Apple.
- Mobile auth/IAP: `/api/mobile/auth/*`, `/api/mobile/iap/products`, `/api/mobile/iap/verify`.
- Stripe: `/api/stripe/checkout`, portal, cancel, change plan/switch cycle, webhook.
- Store webhooks: `/api/webhooks/appstore`, `/api/webhooks/playstore`.
- Product data: `/api/addresses`, `/api/services`, `/api/moving`, `/api/move-tasks`, `/api/budget`, `/api/providers`, `/api/custom-providers`.
- Notifications: `/api/notifications`, feed, preferences, push register.
- Workspace: `/api/workspaces`, members, invitations, transfer, sync, restore/delete/rename.
- Connectors: catalog, changes, dispatch, partner consents, connector webhooks.
- Privacy/export/account: export CSV/JSON/PDF, account delete/restore, consent/GDPR/CCPA.
- Cron/internal: reminders, trial-check, checkout cleanup, data retention, connector dispatch, stripe reconcile, provider stats, blog publish/cleanup.
- Content/support: blog posts/view/revalidate/image, help, tickets, waitlist, tracking.

### Admin API Grupları

- Auth/security: login/logout/me/sessions/MFA/password/login-history/security dashboards.
- Users/billing/subscriptions: users, export, impersonate, subscription actions, billing.
- Providers/governance/state rules/connectors.
- Blog/content/uploads/categories/tags/help-center/FAQ.
- Support tickets, waitlist, reports, analytics.
- Runtime config, feature flags, settings, backups, logs.
- Internal/cron security events and cleanup routes.

## Endpoint: POST `/api/stripe/checkout`

- Dosya: `apps/web/src/app/api/stripe/checkout/route.ts`
- Kullanım amacı: Web checkout session oluşturmak.
- Kullanılan alanlar: Pricing, subscription settings.
- Auth gerekli mi: Evet, `requireDbUserId`.
- Role kontrolü: User subscription status/plan checks.
- Request validation: Plan/billing interval allowlist; accepted terms; mobile client rejection.
- Response: Stripe Checkout session/client secret/url.
- Error handling: 400/401/403/409/503/rate limit cases.
- DB işlemleri: Subscription/user/campaign redemption checks.
- Dış servisler: Stripe.
- Riskler: Runtime price config readiness.
- Sonuç: ✅ Doğru
- Öneriler: Price config smoke test.

## Endpoint: POST `/api/webhooks/stripe`

- Dosya: `apps/web/src/app/api/webhooks/stripe/route.ts`
- Kullanım amacı: Stripe subscription/payment lifecycle sync.
- Auth gerekli mi: Public webhook path; Stripe signature zorunlu.
- Request validation: Raw body size, signature, event age, livemode guard.
- DB işlemleri: Subscription, webhook processed event, acquisition redemption, workspace seats.
- Dış servisler: Stripe.
- Riskler: AUD-004 idempotency race.
- Sonuç: ⚠️ Riskli
- Öneriler: Atomic event reservation.

## Endpoint: POST `/api/mobile/iap/verify`

- Dosya: `apps/web/src/app/api/mobile/iap/verify/route.ts`
- Kullanım amacı: Mobile successful purchase receipt validation.
- Auth gerekli mi: Evet.
- Request validation: Store/product/receipt transaction validation helpers.
- DB işlemleri: Subscription entitlement update.
- Dış servisler: Apple/Google.
- Riskler: Store sandbox/prod env readiness.
- Sonuç: ✅ Doğru
- Öneriler: Store smoke tests.

## Endpoint: POST `/api/export/pdf`

- Dosya: `apps/web/src/app/api/export/pdf/route.ts`
- Kullanım amacı: Address/full/tax PDF export.
- Auth gerekli mi: Evet, `requireDbUserId`.
- Request validation: POST required; step-up verification; type allowlist.
- DB işlemleri: Account snapshot, address/tax data reads.
- Dış servisler: Yok.
- Riskler: Large export response size/latency.
- Sonuç: ✅ Doğru
- Öneriler: Async export if large accounts.

## Endpoint: `/api/services/[id]`

- Dosya: `apps/web/src/app/api/services/[id]/route.ts`
- Kullanım amacı: Service view/update/delete.
- Auth gerekli mi: Evet.
- Role kontrolü: Workspace/user scoped action checks.
- Request validation: Zod service schema, provider/custom provider mutual exclusion.
- DB işlemleri: Service read/update/soft delete, audit log, task sync.
- Riskler: Document UI expects `service.documents`, route does not include such relation.
- Sonuç: ⚠️ Riskli
- Öneriler: Remove document field or implement Document relation.

## Endpoint: `/api/notifications/feed` ve `[id]`

- Dosya: `apps/web/src/app/api/notifications/feed/*`
- Kullanım amacı: Notification list/read.
- Auth gerekli mi: Evet.
- DB işlemleri: Notification read/update scoped by user.
- Riskler: Underlying dedupe is weak, not feed ownership.
- Sonuç: ✅/⚠️
- Öneriler: Dedupe key normalization.

## Endpoint: `/api/connector-dispatch`

- Dosya: `apps/web/src/app/api/connector-dispatch/route.ts`
- Kullanım amacı: Address change fanout to connected/enabled connectors.
- Auth gerekli mi: Evet.
- Role kontrolü: Feature flag, entitlement, consent/config in runtime.
- DB işlemleri: AddressChangeEvent, ConnectorDispatch.
- Riskler: Product copy overpromises automation.
- Sonuç: ✅/⚠️
- Öneriler: Capability-aware copy.

## Endpoint: Connector inbound webhook

- Dosya: `apps/web/src/app/api/connectors/[key]/webhook/route.ts`
- Kullanım amacı: Partner async confirmation/failure.
- Auth gerekli mi: Public webhook; per-connector HMAC signature.
- DB işlemleri: ConnectorDispatch status updates; ProcessedWebhookEvent.
- Riskler: Same idempotency helper marker at end pattern should be reviewed.
- Sonuç: ✅/⚠️
- Öneriler: Shared webhook idempotency reservation.

## Endpoint: Cron reminder routes

- Dosya: `apps/web/src/app/api/cron/*`
- Kullanım amacı: Email/in-app/push reminders.
- Auth gerekli mi: `guardCronRequest` with `CRON_SECRET`.
- DB işlemleri: Service/task/move/subscription queries, notifications.
- Riskler: Tests and batch standardization gaps.
- Sonuç: ⚠️ Riskli
- Öneriler: Queue/cursor batch tests.

## Backend Bulguları

| ID | Başlık | Öncelik | Etki |
|---|---|---|---|
| AUD-001 | Document API/model missing | P1 | Product/API mismatch |
| AUD-004 | Stripe webhook idempotency race | P2 | Duplicate side effects |
| AUD-005 | Notification dedupe weak | P2 | Duplicate feed/perf |
| AUD-006 | Cron tests/batch gaps | P2 | Reliability/perf |
| AUD-007 | Admin rate limit local | P2 | Security/scaling |

## Test Durumu

- Toplam test/spec: 323.
- Web: 179.
- Admin: 91.
- Mobile: 15.
- Packages: 38.
- Web API adjacent route test gap: 52.
- Admin API adjacent route test gap: 31.
- E2E: `apps/web/tests/e2e/public-pages.spec.ts`, `accessibility.spec.ts`.

## Öneriler

1. Route test gaps için risk-first backlog.
2. Public route allowlist snapshot test.
3. Payment/connectors idempotency concurrency tests.
4. Notification cron duplicate tests.
5. Admin analytics/content route permission tests.
