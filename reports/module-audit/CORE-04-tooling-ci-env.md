# CORE-04 Tooling/CI/Env

## Kapsam

Tooling, pnpm scripts, CI, env examples, Docker/deploy config, scheduler config, readiness, audit.

## Olumlu Gozlemler

- Node 22 hedeflenmis; CI least privilege/gitleaks gibi kontroller var.
- Docker secret bake avoidance ve `/api/ready` gibi deploy guvenlik parcalari mevcut.
- Root verify scripts typecheck/test icin merkezi giris sagliyor.

## Riskler ve Bulgular

- P1/P2: CI Prisma validate `DATABASE_URL` yoksa fail ediyor.
- P2: CI root verify kadar genis degil; db/connectors typecheck/tests eksik kalabilir.
- P2: Scheduler drift var; Vercel crons Ofelia job listesindeki checkout cleanup/stripe reconcile gibi isleri kaciriyor.
- P2: Readiness deploy healthcheck/docs ile tam wired degil.
- P2/P3: Main push migration deploy testlerden bagimsiz calisabilir.
- P3: Prod compose required env mismatch.
- P3: Admin env example stale SQLite.
- P3: Docker images latest tag kullanimi reproducibility risk.

## Test/Task Listesi

- CI with fake DATABASE_URL for Prisma validate.
- Root verify parity.
- Cron manifest diff check.
- Healthcheck uses `/api/ready`.
- Migration deploy after tests only.
- Env example parity.
- Pinned image versions.

## Oncelik

P1/P2: CI Prisma env fix ve scheduler parity.
