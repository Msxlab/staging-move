# ADMIN-10 Admin Privacy/Data Ops

## Kapsam

Admin backups, backup download/import/restore, user export, audit export, account deletion operations, GDPR workflows.

## Olumlu Gozlemler

- Backup create/download/import SUPER_ADMIN + password/MFA gibi sert kontrollerle korunuyor.
- Restore lock ve pre-restore backup mantigi var.
- Audit export, user export ve account deletion tarafinda step-up/rate-limit/audit kontrolleri mevcut.

## Riskler ve Bulgular

- P2: Offsite backup retention stored archives'i metadata olarak koruyor; cleanup tam uygulanmiyor.
- P2: Backup scope SupportTicket, TicketMessage, Workspace ve WorkspaceMember gibi tam recovery icin gerekli tablolari eksik birakabilir.
- P2: Grace deletion Stripe pause fail durumunda user lock/renewal uyumsuzlugu yaratabilir.
- P2/P3: User export maskeleri portability beklentisiyle celisebilir.
- P2/P3: Backup import dry-run/MERGE soft-delete client ile calistigi icin soft-deleted row duplicate tahminleri hatali olabilir.
- P3: `ALLOW_RESTORE_WITHOUT_SAFETY_BACKUP=true` bypass'i restore riskini artirir.
- P3: Final GDPRRequest update Stripe+hard-delete sonrasinda tek failure point.

## Test/Task Listesi

- Backup full scope inventory.
- Restore dry-run with soft-deleted rows.
- Offsite retention cleanup.
- Account deletion grace/purge/restore.
- Export masked/unmasked policy.
- Restore without safety backup blocked in prod.

## Oncelik

P2: Backup scope + account deletion/restore drill.
