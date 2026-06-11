# Security ve Permission Denetimi

## Genel Sonuç

Auth ve permission mimarisi repo içinde güçlü görünüyor. Middleware seviyesinde güvenlik headerları, CSRF/body limit, public route allowlist ve JWT kontrolü mevcut. Route seviyesinde DB session, verified email, workspace scoping ve admin permission kontrolleri kullanılıyor. Kritik bir P0 güvenlik açığı kanıtlanmadı.

## Auth Middleware

### Web
- Dosya: `apps/web/src/middleware.ts`
- Kontroller: Public paths/API exact/prefix allowlists, CSRF checks, body size limits, rate limiting, JWT session check, CSP nonce/security headers, noindex for app/private paths.
- Not: Edge middleware JWT doğrular; DB session validation route handler'da `requireDbUserId`/`getUserSession` ile yapılır.

### Admin
- Dosya: `apps/admin/src/middleware.ts`
- Kontroller: Admin JWT secret length guard, public login/healthz, IP rules, CSP/security headers, CSRF/body limit, route rate limit, MFA setup gate.
- Not: DB `isActive` check `requireAdmin()` ile route seviyesinde uygulanır.

## Protected Route Denetimi

- Web API mechanical guard inventory'de public/auth/help/provider route'ları dışında guard patternleri yaygın.
- Admin API guard inventory'de public health route dışında route guard patterni mevcut.
- Workspace route'ları `requireWorkspaceContext`, `resolveWorkspaceDataScope`, `assertScopedRecordAction` helperlarıyla korunuyor.

## Role / Permission Kontrolü

- Admin: `requirePermission` ve `AdminPermission`.
- User: ownership/workspace scoping.
- Sensitive export: step-up verification.
- Admin sensitive operations: MFA/password confirmation.

## Payment Security

- Stripe checkout client fiyatına güvenmiyor.
- Stripe webhook signature doğrulanıyor.
- Livemode mismatch guard var.
- Mobile IAP receipt backend verify ve store webhooks mevcut.

## Security Riskleri

### Risk: AUD-004 Webhook idempotency race

- Severity: Medium/High
- Kanıt: `apps/web/src/app/api/webhooks/stripe/route.ts`, `webhook-idempotency.ts`.
- Etki: Duplicate payment event side effect riski.
- Öneri: Atomic reservation.

### Risk: AUD-007 Admin rate limit process-local

- Severity: Medium
- Kanıt: `apps/admin/src/middleware.ts` in-memory `Map`.
- Etki: Multi-instance brute-force/abuse protection zayıflar.
- Öneri: Shared limiter.

### Risk: Notification dedupe unique değil

- Severity: Medium
- Kanıt: `in-app-notifications.ts`.
- Etki: Duplicate user-visible notifications; audit/alert noise.
- Öneri: DB unique dedupeKey.

### Risk: Document feature yapılırsa security surface eksik

- Severity: High if launched
- Kanıt: Document copy/validator var ama model/API yok.
- Etki: Feature sonradan eklendiğinde storage access-control, content-type, malware scanning, signed URL, delete retention kritik olur.
- Öneri: Document security design olmadan launch etmeyin.

## Kontrol Listesi

| Kontrol | Durum | Kanıt |
|---|---|---|
| Auth middleware var mı? | ✅ | `apps/web/src/middleware.ts`, `apps/admin/src/middleware.ts` |
| Protected route korunuyor mu? | ✅ | `requireDbUserId`, `requireVerifiedUser`, `requireAdmin` |
| Admin route sadece admin mi? | ✅ | `requireAdmin`, `requirePermission` |
| Backend authorization var mı? | ✅ | Workspace data scope helpers |
| IDOR riski var mı? | Düşük/Orta | Scoping iyi; eksik route tests risk |
| Payment webhook signature doğrulanıyor mu? | ✅ | Stripe constructEvent |
| API input validation var mı? | ✅/⚠️ | Zod yaygın; eksik route testleri var |
| Rate limit var mı? | ✅/⚠️ | Web shared, admin process-local |
| Client secret sızıntısı görüldü mü? | Kanıt yok | Runtime/env helperlar server side |
| CORS/security headers var mı? | ✅ | Middleware security headers |
| File upload güvenli mi? | ❓ | Blog image/R2 var; document upload yok |
| XSS/HTML sanitization | ✅/⚠️ | Blog sanitize tests var |
| CSRF kontrolü | ✅ | Middleware |
| Refresh/session yönetimi | ✅ | DB session + cookies/bearer |
| Logging hassas veri | ⚠️ | Auth diagnostics dikkatli; düzenli review önerilir |

## Öneriler

1. Public route allowlist'i testle.
2. Admin rate limit'i shared store'a taşı.
3. Payment/connectors webhook idempotency reservation patternini atomik hale getir.
4. File/document feature launch edilirse security design review zorunlu yap.
5. Route test boşluklarında özellikle ownership/permission regression testleri ekle.
