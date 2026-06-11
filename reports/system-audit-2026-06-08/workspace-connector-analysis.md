# Workspace Connector Analysis

Durum: Workspace modeli ile connector/sync akislari arasindaki baglanti haritasi.

## Workspace Modeli

- Flag: `WORKSPACE_MODEL_ENABLED`.
- Context/scope:
  - `apps/web/src/lib/workspace-context.ts`
  - `apps/web/src/lib/workspace-data-scope.ts`
  - `apps/web/src/lib/workspace-provisioning.ts`
- Permission/domain:
  - `packages/shared/src/permissions.ts`
  - `packages/shared/src/workspace-entitlements.ts`
  - `apps/web/src/lib/plan-limits.ts`
- API:
  - `apps/web/src/app/api/workspaces/**`
- UI:
  - Web: `apps/web/src/app/(app)/settings/workspace/page.tsx`
  - Mobile: `apps/mobile/app/settings/workspace.tsx`

Workspace off ise legacy user scope kullaniliyor. On ise `X-Workspace-Id` veya `lf_workspace_id` cookie uzerinden aktif workspace context cozuluyor.

## Connector Modeli

- Feature flag: `FEATURE_API_CONNECTORS`.
- Entitlement: `apps/web/src/lib/connector-oauth.ts` icindeki `userHasApiConnectorEntitlement`.
- Runtime/queue:
  - `apps/web/src/lib/connector-runtime.ts`
  - `AddressChangeEvent`, `ConnectorDispatch`, `ConnectorFallbackAction`.
- Catalog/OAuth/API:
  - `/api/connectors/catalog`
  - `/api/connectors/changes`
  - `/api/partner-consents`
  - `/api/partner-consents/oauth/initiate`
  - `/api/partner-consents/oauth/callback`
  - `/api/connector-dispatch`
  - `/api/cron/connector-dispatch`
  - `/api/workspaces/[id]/sync`
- Package:
  - `packages/connectors`: registry, dispatcher, HTTP client, mode resolver, USPS connector.

## Dogru Workspace-Aware Yol

`/api/workspaces/[id]/sync`:

- Session member'i workspace icinde dogrular.
- Entitlement'i workspace owner uzerinden kontrol eder.
- `toAddressId` ve opsiyonel `fromAddressId` adreslerinin ayni workspace'e ait oldugunu kontrol eder.
- `enqueueAddressChange({ userId: subjectUserId, toAddressId, fromAddressId, workspaceId: id })` kullanir.

Address update auto-sync de workspace varsa owner entitlement ve `workspaceId` kullaniyor.

## Legacy Drift

`/api/connector-dispatch`:

- Entitlement'i `session.userId` uzerinden kontrol eder.
- Primary address'i sadece user scope ile bulur.
- Queue event'e `workspaceId` gondermez.

Web ve mobile Connections ekranlari su anda legacy endpointi cagiriyor. Bu F-005 olarak kaydedildi.

## Onerilen Hedef Akis

```text
Connections UI
  -> aktif workspace var mi?
    -> evet: POST /api/workspaces/[id]/sync
       entitlement = workspace.ownerUserId
       queue.workspaceId = id
    -> hayir: POST /api/connector-dispatch
       entitlement = session.userId
       queue.workspaceId = null
```

Catalog/OAuth tarafinda da ayni context secimi uygulanmali.
