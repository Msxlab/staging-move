# Modül Denetimi: Admin

## 1. Modülün Amacı
Operasyon, user/provider/billing/content/security/runtime config ve support yönetimi.

## 2. Ana Dosyalar
- `apps/admin/src/app/*`
- `apps/admin/src/app/api/*`
- `apps/admin/src/lib/auth.ts`
- `apps/admin/src/middleware.ts`
- Prisma admin modelleri.

## 3. Bağlantılar
Tüm ana DB modelleri, audit logs, runtime config, backups, connectors, billing.

## 4. Veri Akışı
Admin UI -> admin API -> permission/auth -> DB mutation/read -> audit log.

## 5. UI/UX Denetimi
Kapsamlı admin panel. Sensitive operations için backend confirmations önemli.

## 6. API/Backend Denetimi
`requireAdmin`, `requirePermission`, MFA/password confirmation mevcut.

## 7. Database Denetimi
`AdminUser`, `AdminSession`, `AdminPermission`, `AdminAuditLog`, `RuntimeConfigEntry`.

## 8. Permission/Auth Denetimi
Strong pattern. Health route public.

## 9. Edge Case Denetimi
Session inactive, MFA setup, IP deny, password confirmation.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-007: Admin rate limit process-local.
- AUD-008/AUD-013: Admin route test gaps.

## 11. Mantık Hataları
Distributed deploymentte rate limit semantics değişir.

## 12. Öneriler
Shared limiter, permission tests, admin readiness dashboards.

## 13. Test Senaryoları
Admin login/MFA, permission denied, content CRUD audit, backup download auth.

## 14. Sonuç
⚠️ Riskli
