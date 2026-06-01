# WEB-15 Cron/Health/Internal Ops

## Kapsam

Cron endpoints, internal endpoints, readiness/health, cron guards, synthetic checks, operational jobs.

## Olumlu Gozlemler

- Middleware cron/internal yuzeylerini public routable ama handler-level secret gerektiren sekilde ayirmis.
- `/api/ready` public contract olarak middleware tarafinda korunuyor.
- Ofelia tarafinda billing reconcile ve checkout cleanup gibi operasyonel onarim joblari tanimli.

## Riskler ve Sorular

- Vercel cron manifesti ile Ofelia job listesi farkli; checkout cleanup ve stripe reconcile eksikliginde billing recovery calismayabilir.
- Health/readiness deploy healthcheck'e tam bagli degilse app ayakta gorunup DB/secret sorunlarini kacirabilir.
- Cron endpointleri secret guard ve idempotency acisindan her route icin tek tek dogrulanmali.
- Internal endpoints fail-open davranis gostermemeli.

## Test/Task Listesi

- Cron secret invalid/valid.
- Cron idempotency.
- Vercel/Ofelia parity test.
- `/api/ready` DB/runtime config readiness.
- Deleted user skip for notification/reminder crons.
- Billing cleanup/reconcile scheduled.

## Oncelik

P2: Scheduler parity ve readiness deployment wiring.
