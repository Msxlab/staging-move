# ADMIN-05 Admin Workspaces

## Kapsam

Admin workspace search/detail, members, ownership transfer, purge/recovery, seat limits.

## Olumlu Gozlemler

- Workspace model user/member/role ve subscription entitlement ile bagli.
- Workspace purge cron ayri operasyonel is olarak tanimli.

## Riskler ve Sorular

- Admin workspace actions user deletion ve workspace purge ile birlikte test edilmeli.
- Member/owner transfer admin tarafindan yapiliyorsa audit ve permission sert olmali.
- Workspace-scoped resources listelenirken soft-delete ve tenant isolation dikkat ister.

## Test/Task Listesi

- Workspace search/detail permission.
- Member list PII masking.
- Owner transfer audit.
- Seat limit view.
- Soft-deleted workspace restrictions.
- Purge eligibility.

## Oncelik

P2/P3: Workspace purge/admin transfer E2E.
