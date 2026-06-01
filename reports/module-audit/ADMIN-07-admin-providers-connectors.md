# ADMIN-07 Admin Providers/Connectors

## Kapsam

Provider governance, coverage data, connector registry/admin controls, logo/assets, revoke/disable.

## Olumlu Gozlemler

- Provider data governance urun sinirlariyla beraber ele alinmis.
- Connector package ve web consent moduluyle admin operasyonu ayrilmis.

## Riskler ve Sorular

- Admin provider edit public recommendation cache ve mobile cache'e dogru yansimali.
- Provider/logo asset fetch SSRF ve file validation acisindan hassas.
- Connector admin revoke queued/in-flight isleri iptal etmeyebilir.
- Coverage duplicate/seed drift core/db tarafiyla beraber izlenmeli.

## Test/Task Listesi

- Provider create/update/disable audit.
- Coverage update recommendation impact.
- Logo upload/fetch SSRF guard.
- Connector disable/revoke.
- Cache invalidation.
- Public/mobile reflection.

## Oncelik

P2: Provider governance -> public recommendation E2E.
