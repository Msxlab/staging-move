# CORE-02 DB/Prisma/Migrations

## Kapsam

Prisma schema, migrations, indexes, constraints, soft-delete extension, data integrity, migration validation.

## Olumlu Gozlemler

- Prisma schema ve migrations duzenli; soft-delete helper/extension mevcut.
- Indexler ve unique constraintler bircok kritik tabloda dusunulmus.
- Fake DATABASE_URL ile Prisma validate basarili; db build ve ilgili web route testleri basarili.

## Riskler ve Bulgular

- P2: Cross-user/workspace ownership invariant'lari DB tarafinda her yerde enforce edilmiyor.
- P2: Workspace purge cascade MovingPlan Address `Restrict` iliskisiyle cakisabilir.
- P2: Budget unique index workspaceId icermiyor.
- P2: Workspace invitation pending invite race condition riski var.
- P2/P3: Soft-delete extension nested include iliskilerini otomatik filtrelemeyebilir.
- P2/P3: String pseudo-enum alanlarinda DB check constraint eksik.
- P3: Provider coverage duplicate kayit riski var.

## Test/Task Listesi

- DB-backed tenant isolation.
- Workspace purge with moving plans.
- Budget workspace collision.
- Invitation concurrent accept/create.
- Nested include soft-delete regression.
- Enum/check constraints.

## Oncelik

P2: DB-backed ownership ve workspace budget uniqueness.
