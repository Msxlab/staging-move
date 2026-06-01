# WEB-02 Auth/Session/MFA/OAuth

## Kapsam

Sign-in/sign-up, email verification, password reset, OAuth, session cookie/JWT/DB session, MFA ve post-auth redirect mantigi.

## Olumlu Gozlemler

- Post-auth redirect mantigi legal consent, onboarding, password setup ve safe redirect konularini ayri fonksiyonlarla ele aliyor.
- Middleware ve route seviyesinde session gecerliligi iki katmanli dusunulmus.
- MFA/step-up konsepti hassas islemlerle baglantili tasarlanmis.

## Riskler ve Sorular

- Authenticated browser E2E yok; login olan kullanicinin gercek app akisina girdigi Playwright ile kanitlanmiyor.
- OAuth-only kullanicinin password setup, legal consent ve onboarding sirasi unit testli ama browser/API/DB beraber test edilmeli.
- Session invalidation; account deletion, password change, MFA change ve logout-all durumlarinda tek senaryoda dogrulanmali.
- Rate-limit ve enumeration kontrolleri her auth endpoint icin ayni sertlikte mi tekrar bakilmali.

## Test/Task Listesi

- Email/password sign-up -> verify -> onboarding.
- OAuth login -> password setup -> legal gate -> dashboard.
- Invalid/expired reset and verify tokens.
- MFA setup/confirm/disable ve step-up expiry.
- Deleted/soft-deleted user session reject.
- Open redirect ve unsafe redirect parametreleri.

## Oncelik

P2: Authenticated E2E setup ve session invalidation senaryolari eklenmeli.
