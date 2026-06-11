# Modül Denetimi: Auth

## 1. Modülün Amacı
Kullanıcı kayıt, giriş, çıkış, session, email verification, password reset/change, MFA ve mobile auth handoff akışlarını yönetir.

## 2. Ana Dosyalar
- `apps/web/src/lib/user-auth.ts`: user session/auth helperları.
- `apps/web/src/middleware.ts`: public route allowlist, JWT, CSRF, security headers.
- `apps/web/src/app/api/auth/*`: auth route'ları.
- `apps/web/src/app/api/mobile/auth/*`: mobile auth.
- `packages/db/prisma/schema.prisma`: `User`, `UserLoginSession`, tokens.

## 3. Bağlantılar
DB session, email notification, mobile secure storage, OAuth providers, protected app routes.

## 4. Veri Akışı
Auth form/mobile request -> auth route -> user/session/token DB -> cookie/bearer -> protected route helper.

## 5. UI/UX Denetimi
Sign-in/sign-up/reset/verify pages mevcut. Error/empty/loading stringleri i18n içinde geniş.

## 6. API/Backend Denetimi
`requireDbUserId`, `requireVerifiedUser`, diagnostics ve cookie expiry patterni güçlü.

## 7. Database Denetimi
Session ve token modelleri ayrılmış. Soft delete user kontrolleri auth helperlarda dikkate alınıyor.

## 8. Permission/Auth Denetimi
Backend authorization var; middleware tek başına güven kaynağı değil, route-level DB validation kullanılıyor.

## 9. Edge Case Denetimi
Expired session, unverified email, reset token, mobile exchange ve OAuth state için dosyalar mevcut. Eksik route testleri regression riski.

## 10. Hata/Eksik/Yanlış Listesi
Kanıtlı P0/P1 auth açığı bulunmadı.

## 11. Mantık Hataları
Public allowlist genişlerse regression riski.

## 12. Öneriler
Public/private route snapshot tests ve workspace role matrix tests.

## 13. Test Senaryoları
Login/logout, expired session, email unverified write block, reset token reuse, mobile exchange.

## 14. Sonuç
✅ Sağlam
