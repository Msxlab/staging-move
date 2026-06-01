# CLIENT-02 Mobile Onboarding/Profile

## Kapsam

Mobile onboarding, profile, legal consent, preferences, web parity.

## Olumlu Gozlemler

- Mobile post-auth route ve onboarding parity icin unit test zemini mevcut.
- Web tarafindaki canonical onboarding progress mantigi mobile ile paylasilabilir durumda.

## Riskler ve Sorular

- Mobile onboarding close/resume/hata akisi gercek cihaz/emulator ile kanitli degil.
- Legal consent versiyonu mobile ekranlarinda web ile ayni zorunlulugu uygulamali.
- Profile/preferences mobile cache ile web server state arasinda drift riski var.

## Test/Task Listesi

- New mobile user legal/profile gate.
- App kill/reopen onboarding resume.
- Services/moving skip parity.
- Profile update sync.
- Validation errors and retry.

## Oncelik

P2: Mobile onboarding resume E2E.
