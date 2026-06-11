# Modül Denetimi: Mobile

## 1. Modülün Amacı
Native mobile kullanıcı deneyimi: auth, domain CRUD, subscription, push, export.

## 2. Ana Dosyalar
- `apps/mobile/app/*`
- `apps/mobile/src/lib/api.ts`
- `apps/mobile/src/lib/auth.ts`
- `apps/mobile/src/lib/iap.ts`
- `apps/mobile/src/lib/push.ts`

## 3. Bağlantılar
Web API, IAP stores, Expo push, secure/local stores.

## 4. Veri Akışı
Mobile UI -> API lib -> backend -> secure/local state.

## 5. UI/UX Denetimi
Native screens geniş. Bill snap copy mismatch web tarafında.

## 6. API/Backend Denetimi
Mobile-specific auth/IAP routes mevcut.

## 7. Database Denetimi
Backend shared DB.

## 8. Permission/Auth Denetimi
Bearer/session auth backendde doğrulanır.

## 9. Edge Case Denetimi
Offline, expired auth, IAP restore, push denied.

## 10. Hata/Eksik/Yanlış Listesi
- AUD-002 Snap bill yok.
- AUD-010 Push readiness.
- AUD-014 Mobile E2E sınırlı.

## 11. Mantık Hataları
Marketing app capability ile mobile actual permission inventory çelişiyor.

## 12. Öneriler
Copy cleanup, emulator tests, push readiness.

## 13. Test Senaryoları
Login, purchase/restore, push register, notification prefs, export.

## 14. Sonuç
⚠️ Riskli
