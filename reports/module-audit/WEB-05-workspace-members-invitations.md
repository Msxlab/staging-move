# WEB-05 Workspace/Members/Invitations

## Kapsam

Workspace ownership, member roles, invitations, token accept/revoke, seat limit, transfer, member removal.

## Olumlu Gozlemler

- Invitation accept route testleri session yok, expired/revoked invite, email mismatch, seat limit, happy path ve idempotency konularini kapsiyor.
- Workspace feature gate ve entitlement baglantisi tasarimda mevcut.
- Role/owner/member ayrimi route mantiginda dusunulmus.

## Riskler ve Sorular

- Invite kabul testleri buyuk olcude mock'lu; gercek DB unique/transaction davranisi ve race condition test edilmeli.
- Seat limit check ile member create arasinda concurrency riski izlenmeli.
- Workspace transfer ve owner silinmesi account deletion/purge ile birlikte uctan uca dogrulanmali.
- Workspace-scoped data ile user-scoped data ayrimi her resource icin ayni sertlikte olmayabilir.

## Test/Task Listesi

- Owner workspace olusturur.
- Invite token accepted/revoked/expired.
- Email mismatch 403.
- Seat limit 409.
- Already member idempotent.
- Owner transfer.
- Member removal sonrasi data access engeli.
- Workspace deletion/purge cascade.

## Oncelik

P2: Multi-user DB-backed workspace E2E ve seat-limit race testi.
