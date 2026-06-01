# WEB-03 Onboarding/Profile/Preferences

## Kapsam

Profile creation/update, legal consent gate, onboarding steps, skip/resume mantigi ve notification/profile preferences.

## Olumlu Gozlemler

- Onboarding progress mantigi profile, legal, address, services, moving ve explicit completion event kavramlarini ayri ele aliyor.
- Legal consent yoksa completion event'in bypass etmesine izin verilmiyor.
- Services/moving skipped eventleri persist edilip resume mantigina dahil ediliyor.

## Riskler ve Sorular

- Kullanici onboarding ekranini kapatirsa, refresh ederse veya yarida hata alirsa gercek browser akisi testli degil.
- Profile kaydi ile legal consent versiyonlari arasinda migration/yeniden kabul senaryosu izlenmeli.
- Preferences degisiklikleri email/push/unsubscribe moduluyle tutarli kalmali.
- Mobile onboarding ile web onboarding ayni canonical progress mantigini kullaniyor mu surekli kontrol edilmeli.

## Test/Task Listesi

- New user profile eksik -> profile step.
- Legal consent eksik -> legal gate.
- Address ekleme hatasi -> ayni stepte kalma ve retry.
- Services skipped -> moving step.
- Moving skipped -> onboarding complete.
- Completed user `/onboarding` acarsa dashboard redirect.

## Oncelik

P2: Onboarding close/resume/hata E2E senaryosu eklenmeli.
