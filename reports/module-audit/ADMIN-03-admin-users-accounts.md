# ADMIN-03 Admin Users/Accounts

## Kapsam

Admin user search/detail, account status, sessions, roles/context, support/privacy/billing links.

## Olumlu Gozlemler

- User/account yonetimi billing, support, privacy ve workspace modulleriyle iliskili ele alinmis.
- Admin tarafinda hassas user islemleri audit/permission modeline baglanabilir durumda.

## Riskler ve Sorular

- User detail sayfasinda PII minimization ve role-based field masking kontrol edilmeli.
- Soft-deleted/grace-deleted user state yanlis aksiyonlara izin vermemeli.
- Admin tarafindan account state degisikligi billing/session/notification yan etkilerini tetiklemeli.

## Test/Task Listesi

- User search permission.
- PII field masking.
- Soft-deleted user badge/action limits.
- Session revoke.
- Account lock/unlock audit.
- Cross-link billing/workspace/support correct.

## Oncelik

P2/P3: Deleted user state ve PII masking.
