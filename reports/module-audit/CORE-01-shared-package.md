# CORE-01 Shared Package

## Kapsam

Shared product logic, entitlement, billing constants, validators, recommendation, migration/task lifecycle, sanitizer/redaction/encryption helpers.

## Olumlu Gozlemler

- Shared logic buyuk olcude pure ve test edilebilir tutulmus.
- Entitlement, billing/workspace feature, provider/recommendation, sanitizer/redaction/encryption gibi kritik mantiklar merkezi paket icinde.
- Shared test kapsami yuksek; `packages/shared/src` testleri ve lint basarili calisti.

## Riskler ve Bulgular

- P2: Unknown plan `getEffectiveEntitlement` icinde normalize edilmezse downstream `planFeatures` ile premium/free drift yaratabilir.
- P2: Canonical entitlement `index.mobile.ts` tarafinda eksik; mobile/web dashboard/budget ad-hoc premium checks drift yapabilir.
- P2/P3: Audit redaction key-based; `error/message/detail` gibi free text icinde token/email kalabilir.
- P2/P3: Recommendation API `getRecommendedProviders` filtrelerini bypass edip `buildRecommendationClusters` kullanabiliyor.
- P3: Backup encryption helpers null dondurerek caller policy'ye fazla guveniyor.
- P3: Runtime config catalog `FEATURE_API_CONNECTORS` ve `WORKSPACE_MODEL_ENABLED` gibi keyleri kaciriyor.
- P3: Move-task lifecycle reopen durumunda stale completed/dismissed timestamp temizlemeyebilir.

## Test/Task Listesi

- Unknown plan normalization.
- Mobile shared exports parity.
- Redaction payload fuzz tests.
- Recommendation API filter path.
- Encryption helper fail-closed policy.
- Move-task reopen timestamp tests.

## Oncelik

P2: Entitlement parity ve recommendation filter path.
