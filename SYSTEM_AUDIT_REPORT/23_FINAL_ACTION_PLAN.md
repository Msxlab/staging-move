# Final Aksiyon Planı

## 1. İlk Düzeltilmesi Gereken Kritikler

1. AUD-001: Documents feature copy/UI mismatch.
2. AUD-002: "Snap a bill" mobile promise mismatch.
3. AUD-003: Automatic USPS/provider update copy mismatch.
4. AUD-004: Stripe webhook idempotency reservation risk.
5. AUD-005: Notification dedupe unique constraint eksikliği.

## 2. Modül Bazlı Düzeltme Sırası

1. Product copy / Homepage / Public docs.
2. Payments webhook idempotency.
3. Notifications cron/dedupe.
4. Admin security/rate limiting.
5. Testing backlog.
6. Mobile E2E and release readiness.
7. Documentation cleanup.

## 3. Hızlı Kazanımlar

- "Snap a bill" ve "USPS forwarding setup, automatically" copy düzeltmesi.
- Documents copy'nin kaldırılması veya "coming soon" değilse tamamen gizlenmesi.
- Admin rate limit shared limiter task'ının açılması.
- Route test gap inventory'nin CI raporu yapılması.
- Push/SMS availability copy'si.

## 4. Derin Teknik Borçlar

- Webhook processing state/idempotency framework.
- Notification dedupe schema migration.
- Cron queue/backpressure architecture.
- Document storage/access-control feature tasarımı.
- Current architecture documentation.

## 5. Test Planı

- Auth: Public/private route allowlist, expired session, verified email gate.
- Payment: Stripe checkout config, webhook duplicate/concurrent, App Store/Play Store sandbox.
- Notifications: Cron duplicate, preference matrix, push disabled, read/unread.
- Workspace: Role matrix and IDOR.
- Admin: Permission, password confirmation, audit log.
- Mobile: Login, IAP purchase/restore, push register, export, offline/expired session.
- Product copy: Forbidden claims tests.

## 6. Yayına Alma Öncesi Kontrol Listesi

- Stripe price IDs and webhook secrets configured.
- App Store/Google Play webhook and product IDs verified.
- Resend and Expo push readiness confirmed.
- `FEATURE_API_CONNECTORS` and connector configs verified.
- Public copy contains no unsupported automation/document/capture claim.
- Admin shared rate limit enabled.
- Cron jobs have batch limits and monitoring.
- Route/E2E smoke tests pass.

## 7. Ürün Vaadi Temizliği

- Documents: remove or complete.
- Snap bill: remove or complete.
- USPS/provider update: guided-only unless API_SYNC live.
- SMS: do not promise until provider live.
- Connector network: "supported partners only" everywhere.

## 8. Sonuç

Sistemin genel sağlık durumu:

- Güvenilir mi? **Çekirdek akışlarda büyük ölçüde evet; async/idempotency ve copy uyumu iyileştirilmeli.**
- Yayına hazır mı? **Kısmen hazır.**
- Ödeme/auth/data açısından güvenli mi? **Temel kontroller güçlü; webhook idempotency ve tests güçlendirilmeli.**
- Kullanıcıya verdiği vaatleri karşılıyor mu? **Adres/servis/reminder/export/subscription için evet; documents/snap bill/automatic provider update için hayır veya kısmen.**
- En büyük 5 risk:
  1. Documents promise mismatch.
  2. Mobile bill snap promise mismatch.
  3. Automatic USPS/provider update copy.
  4. Webhook/notification duplicate idempotency.
  5. Test/E2E gaps.
