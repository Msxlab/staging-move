# CLIENT-01 App Shell/Auth/Session

## Kapsam

Mobile app shell, navigation, session persistence, auth exchange, token refresh/logout, protected screen gating.

## Olumlu Gozlemler

- Mobile auth exchange ve navigation icin testler mevcut.
- Web/mobile auth state ayrimi threat modelde dogru ele alinmis; mobile IP/fingerprint zayifligi tasarim varsayimi olarak belirtilmis.
- Secure storage/session persistence tasarimi mobile icin ayrilmis.

## Riskler ve Sorular

- Mobile app shell icin device/emulator E2E yok; unit/navigation testleri gercek runtime davranisini tam kanitlamiyor.
- Logout/account deletion sonrasi local token temizligi ve protected route gating uctan uca test edilmeli.
- Offline acilista stale entitlement/session gosterimi risk yaratabilir.

## Test/Task Listesi

- Fresh install no session -> auth stack.
- Login/exchange success -> app stack.
- Token expired -> reauth.
- Logout clears storage.
- Deleted account session reject.
- Deep link auth callback.

## Oncelik

P2: Mobile auth/session emulator E2E.
