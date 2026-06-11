# API and Data Flow

Durum: 2026-06-08 ilk full-pass veri/akis haritasi.

## Auth Akislari

- Web:
  - Web session cookie: `user_session`.
  - JWT + DB-backed `UserLoginSession`.
  - Middleware JWT imzasini edge'de kontrol eder; route/layout DB row, user soft-delete, fingerprint, expiry ve email/legal durumlarini kontrol eder.
- Mobile:
  - Web API tarafindan verilen JWT bearer token olarak saklanir.
  - Token SecureStore'da tutulur.
  - Mobile fingerprint User-Agent/`x-client-*` basliklariyla uyumlu tutulur.
- Admin:
  - `admin_session` httpOnly cookie.
  - JWT + DB-backed `AdminSession`.
  - Admin role DB'den tekrar okunur.
  - Sensitive ops password/MFA step-up ister.

## DB Ana Model Gruplari

Prisma schema basliklarindan gorulen ana gruplar:

- Kullanici/auth: `User`, `OAuthAccount`, `MobileOAuthCode`, `UserLoginSession`, `OAuthState`, `PasswordResetToken`, `EmailVerificationToken`.
- Billing: `Subscription`, `AcquisitionCampaign`, `AcquisitionRedemption`.
- User domain: `Profile`, `Address`, `Service`, `MovingPlan`, `Budget`, `Reminder`, `MoveTask`, `UserCustomProvider`.
- Provider domain: `StateRule`, `ServiceProvider`, `ServiceProviderCoverage`, `ProviderLogoCandidate`, `ProviderGovernanceIssue`.
- Admin: `AdminUser`, `AdminSession`, `AdminLoginLog`, `AdminPermission`, `AdminAuditLog`, `AdminActionOtp`, `AdminSetPasswordToken`.
- Ops/content: `RuntimeConfigEntry`, `Notification*`, `EmailTemplate`, `EmailLog`, `HelpArticle`, `FAQ`, `FeatureFlag`, `IPRule`, `RateLimitLog`, `ProcessedWebhookEvent`, `GDPRRequest`, `BackupRecord`, `SupportTicket`, `BlogPost` ve iliskili blog modelleri.
- Connectors/workspace: `PartnerConsent`, `ConnectorConfig`, `ConnectorDispatch`, `AddressChangeEvent`, `ConnectorFallbackAction`, `Workspace`, `WorkspaceMember`, `WorkspaceInvitation`, `WorkspaceAuthChallenge`.

## Soft Delete

- `packages/db/src/soft-delete.ts` soft-delete modelleri icin read query'lere `deletedAt: null` uygular.
- Soft-delete modelleri: `User`, `Address`, `Service`, `MovingPlan`, `Budget`, `ServiceProvider`, `MoveTask`, `UserCustomProvider`, `BlogPost`, `Workspace`.
- Web default Prisma client soft-delete extension ile gelir; raw client yalniz retention/restore/backup gibi amaclarla kullanilmali.

## User Domain Akisi

```text
Web/Mobile UI
  -> web API route
    -> requireDbUserId / requireAppMutationUser
    -> workspace scope resolver
    -> plan/permission gate
    -> Prisma soft-delete client
    -> shared domain helpers
```

- Address/service/move/budget/move-task route'lari workspace context varsa workspace scope uygular.
- Email/legal verification gates mutation yollarinda daha sert.
- Move-task sync, address/service/move degisikliklerinden tetiklenir.

## Billing/IAP/Webhook Akisi

```text
Stripe Checkout / Mobile IAP
  -> Subscription row
  -> shared entitlement resolver
  -> plan limits + workspace seat reconciliation
  -> web/mobile profile snapshot
```

- Stripe webhook: signature + idempotency + event order guard.
- App Store: Apple signed payload/JWS verification, notification UUID idempotency.
- Play Store: Pub/Sub OIDC + package check + message id idempotency.
- IAP verify: store-side refresh, product id runtime-config mapping, receipt ownership guard.

## Workspace + Connector Akisi

```text
Address change
  -> connector entitlement check
  -> AddressChangeEvent
  -> cron connector-dispatch
  -> connector package dispatcher/executor
  -> partner API / fallback action
```

- Workspace-aware path must include `workspaceId` and owner entitlement.
- Legacy `/api/connector-dispatch` currently personal-scope only behaves; F-005 tracks drift.
- Connector webhooks are public middleware-wise but route handler checks feature flag and per-connector signature secret.

## Cron / Internal

- Web cron route'lari generally `guardCronRequest()` ile `CRON_SECRET` + route rate limit kullanir.
- Internal route'lar `verifyInternalAuth(..., "internal")` veya impersonation icin `"impersonation"` secret kind kullanir.
- Admin internal route'lar da `verifyInternalAuth` kullanir.
- F-001 outlier: partner consent refresh route cron/system intent tasiyor ama `/api/cron` altinda degil.

## Env / Runtime Config

- Runtime-config katalogu 103 anahtar iceriyor.
- `.env.example` ile kaynak/runtime-config drift'i F-006 olarak kaydedildi.
- Admin runtime config route secret values'i response/audit'e yazmiyor; sadece masked/status metadata donuyor.
