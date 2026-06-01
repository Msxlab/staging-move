# WEB-14 Privacy/Consent/Export/Account Deletion

## Kapsam

Privacy consent, data export, account deletion request, grace deletion, restore token, purge, session invalidation.

## Olumlu Gozlemler

- Account deletion logic Stripe cancellation failure durumunda hard delete yapmayacak sekilde testlenmis.
- Grace window icinde purge erteleniyor; grace deletion soft-delete ve session kill ile modellenmis.
- Export/deletion hassas islemlerinde step-up/MFA konsepti admin ve web tarafinda mevcut.

## Riskler ve Sorular

- Full export -> deletion -> grace restore -> final purge -> backup restore drill yok.
- Stripe pause/cancel ile user deletion arasindaki failure durumlari daha fazla operasyonel test istiyor.
- Export maskeleri portability beklentisiyle celisebilir; hangi alanin masked/unmasked olacagi politika olarak net olmali.
- Soft-deleted user verisi search, recommendation, support, notification ve admin listelerinde gorunmemeli.

## Test/Task Listesi

- Export request with step-up.
- Delete account request.
- Grace restore token valid/expired/invalid.
- Stripe cancel fail -> no hard delete.
- Final purge and session rejection.
- Backup/import restore smoke.

## Oncelik

P2: Account deletion/export/restore cross-module drill.
