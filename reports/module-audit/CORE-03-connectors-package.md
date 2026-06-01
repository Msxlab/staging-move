# CORE-03 Connectors Package

## Kapsam

Connector manifests, USPS implementation, egress allowlist, PKCE, retry planner, rate limiting, dispatch semantics.

## Olumlu Gozlemler

- Connector package saf ve iyi izole edilmis.
- Egress allowlist, PKCE, retry planner ve connector tests mevcut.
- USPS connector submitted/confirmed/error durumlarini unit seviyesinde ele aliyor.

## Riskler ve Bulgular

- P2: `SUBMITTED` dispatch sonrasinda reconciliation yoksa pending kalici hale gelebilir.
- P2: Sync-now/primary-address auto-sync `requiresOrigin` nedeniyle USPS'i skip edebilir.
- P2: `perConnectorPerMinute` declare ediliyor ama enforce edilmiyor; `perUserDay` count/create race'e acik.
- P2/P3: OAuth config registry/manifest allowlist'e yeterince bagli degil.
- P2/P3: Token refresh failure consent'i `GRANTED` birakabilir.
- P2/P3: Admin bulk revoke queued/in-flight isleri cancel etmeyebilir.
- P3: Circuit breaker in-memory; multi-instance ve DB gorunurlugu zayif.

## Test/Task Listesi

- Submitted reconciliation job.
- RequiresOrigin auto-sync behavior.
- Rate-limit atomic enforcement.
- OAuth config allowlist.
- Token refresh failure state.
- Bulk revoke cancels queue.
- Circuit breaker shared state.

## Oncelik

P2: Submitted reconciliation ve connector rate-limit enforcement.
