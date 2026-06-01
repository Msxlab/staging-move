# ADMIN-11 Admin Config/Feature Flags

## Kapsam

Runtime config, feature flags, IP rules, key rotation, state rules, sensitive config audit.

## Olumlu Gozlemler

- Runtime Config SUPER_ADMIN + MFA ile korunuyor; secret masking, audit ve deployment-only key reddi var.
- IP rule mutation password+MFA, whitelist break-glass ve self-lockout guard iceriyor.
- Key rotation SUPER_ADMIN+MFA ve distributed lock ile dusunulmus.

## Riskler ve Bulgular

- P2: Feature flag target validation eksik; invalid target global flag davranisina dusme riski tasiyor.
- P2: Feature flag writes ADMIN + settings/audit_logs fallback ve MFA'siz 1 saat grace ile fazla gevsek.
- P2: IP rule cache fail-open; DB hata durumunda internal endpoint bos rules dondurup middleware cache'leyebilir.
- P2: Key rotation soft-deleted encrypted records'i kacirabilir ve skip/take order'siz.
- P2/P3: Runtime Config `FEATURE_API_CONNECTORS` ve `WORKSPACE_MODEL_ENABLED` gibi kritik flagleri kapsamayabilir.
- P3: State Rules direct API normalization/validation eksik.
- P3: State Rules audit full updateData text saklayabilir.

## Test/Task Listesi

- Feature flag target validation.
- MFA-required flag writes.
- IP rules DB failure fail-closed.
- Key rotation soft-deleted data.
- Runtime config key catalog parity.
- State rules validation and audit redaction.

## Oncelik

P2: Feature flag target validation ve IP rule fail-closed.
