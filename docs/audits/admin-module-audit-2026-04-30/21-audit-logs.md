# Audit Logs Audit

## Baglanti Durumu

- Admin: `/api/logs`
- Admin audit ve user audit tablolarini okuyor.
- Web/mobile user actions `AuditLog` ve `UserEvent` ile dolayli bagli.

## Guvenlik

- `audit_logs canRead` + ADMIN, fallback `settings`.
- Admin logs include admin email/name. User logs user email/name ile enrich
  ediliyor.
- IP address ve changes JSON raw gelebilir; PII/secret masking garanti degil.

## Mantik ve Eksik

- `perPage` helper max 100 ile clamp ediyor; iyi.
- Search sadece belirli alanlarda; changes icinde arama yok.
- Export yok veya auditli server export gorunmedi.
- Changes JSON icin merkezi redaction yoksa upstream log yazan route secret/PII
  kacirabilir.

## Oneriler

- Central audit redaction helper zorunlu hale getirilmeli.
- IP/user email masking VIEWER/ADMIN ayrimi.
- Server-side audited export.
- Entity detail deep-linkleri ve immutable retention policy.
