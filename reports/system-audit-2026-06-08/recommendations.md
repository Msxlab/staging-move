# Recommendations

Durum: 2026-06-08 onceliklendirilmis yol haritasi.

## Hemen

- F-001: Partner consent refresh endpointini middleware ile uyumlu hale getir:
  - Tercih: `/api/cron/partner-consents/refresh` altina tasi ve `guardCronRequest()` kullan.
  - Alternatif: middleware exact allowlist + `verifyInternalAuth(..., "cron")` + rate limit.
- F-002: `/api/providers/popular` icin minimum cohort ve response bucketing uygula.
- F-005: Connections UI'da aktif workspace varsa `/api/workspaces/[id]/sync` kullan.
- F-001/F-002/F-005 icin route contract testleri ekle.

## Kisa Vade

- F-006: `.env.example` dosyasini kaynak/runtime-config matrisiyle guncelle.
- Env drift CI check ekle:
  - kaynak `process.env.*`
  - runtime-config katalog anahtarlari
  - `.env.example`
  - platform-only allowlist
  - dynamic secret pattern allowlist
- API route test eksiklerini kritiklige gore kapat:
  1. auth/session/security
  2. billing/IAP/webhooks
  3. workspace/permission
  4. moving/move-tasks
  5. cron/internal
  6. provider public privacy
- Mobile'in kullandigi endpoint aileleri icin contract test matrisi olustur:
  - bearer token auth
  - 401 global logout davranisi
  - feature flag kapali response kodlari
  - entitlement/upgradeRequired response shape
- Admin rate limit altyapisini merkezi/shared rate limit helper ile uyumlu hale getir.

## Orta Vade

- Public API data classification dokumani olustur: public, authenticated, internal, cron, webhook.
- Middleware public API allowlist'i ile route handler security modelini otomatik test eden guard parity testi ekle.
- Provider popularitesi gibi community-derived endpointleri batch/agregasyon tablosuna tasiyip request-time user data join'ini kaldir.
- Workspace connector modelini tamamla:
  - Personal consent vs workspace consent scope.
  - Owner entitlement vs member action permission.
  - AddressChangeEvent/ConnectorDispatch history filtering by workspace.
- FCC bulk ingest scripti icin production acceptance criteria yaz ve placeholder'lari tamamla.

## Uzun Vade

- Web/mobile/admin API sozlesmeleri icin shared OpenAPI veya typed endpoint manifest uret.
- Route test coverage dashboard'u CI'da raporla.
- Feature flag lifecycle'i icin off/on/rollout test harness'i kur.
- Admin permission seed/backfill/readiness kontrolu ekle; fail-closed model operasyonel lockout'a donusmesin.
- Connector generator'u manifest validation, generated tests ve partner-specific request shape skeleton ile guclendir.

## Guclu Taraflar

- Billing/IAP/webhook guvenlik kontrolleri olgun: signature/JWS/OIDC, idempotency, event-order protection ve receipt ownership guard var.
- Admin kritik operasyonlarinda step-up, MFA, audit, encryption/signature/offsite policy yaygin.
- Mobile DB/connectors import etmiyor; API boundary temiz.
- Workspace scope address/service/moving/budget/task domainlerinde merkezi helperlar uzerinden uygulanmis.
