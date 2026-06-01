# Partner Connector Onboarding

This runbook is the launch-safe path for adding a partner such as USPS, UPS, FedEx, a utility, bank, insurer, or subscription provider.

## Product Promise

Use this promise everywhere:

> For supported partners you authorize, LocateFlow can submit your new address on your behalf; when no approved API connection exists, LocateFlow guides you to the right open-and-update flow.

Do not promise blanket auto-sync. A partner is API-backed only when legal approval, partner approval, sandbox tests, production credentials, and rollout controls are all complete.

## Partner Modes

### Guided Update

Use this by default.

- The app opens the partner's update page.
- LocateFlow prepares the old address, new address, and any user-provided account fields.
- The user reviews and submits on the partner site.
- LocateFlow tracks `opened`, `done`, `failed`, or `skipped`.

This mode is appropriate when the partner has no approved write API, identity verification is required on the partner side, or the contract does not allow us to submit.

### API Sync

Use only for approved partners.

- The user grants partner-specific consent.
- LocateFlow stores scoped tokens encrypted at rest.
- Address updates are queued as `ConnectorDispatch` rows.
- The worker sends updates with an idempotency key.
- Failures retry where safe and degrade to guided/manual action.

## Approval Checklist

Before enabling API sync for a partner:

- Partner contract explicitly permits address update submission by LocateFlow.
- OAuth or API credentials are issued for sandbox and production.
- Allowed hosts are listed in the connector manifest.
- OAuth authorize and token URLs are HTTPS and match the manifest allowlist.
- Required scopes are least-privilege and documented.
- Sandbox test covers consent, update submit, retry, revoke, and fallback.
- Admin `ConnectorConfig` starts `enabled=false`, `stage=SHADOW`, `rolloutPercent=0`.
- `FEATURE_API_CONNECTORS` remains false until product/legal approve launch.
- Production rollout starts with one internal account, then small percentage rollout.
- Incident plan is ready: disable connector, open circuit, bulk revoke consents.

## Implementation Steps

1. Add an isolated connector package folder, for example `packages/connectors/src/ups`.
2. Define a manifest with `key`, `allowedHosts`, `auth.scopes`, capabilities, rate limits, and `fallbackActionKey`.
3. Add the connector to `apps/web/src/lib/connector-registry.ts`.
4. Add runtime config keys using this pattern:

```text
CONNECTOR_UPS_OAUTH_CLIENT_ID
CONNECTOR_UPS_OAUTH_CLIENT_SECRET
CONNECTOR_UPS_OAUTH_AUTHORIZE_URL
CONNECTOR_UPS_OAUTH_TOKEN_URL
CONNECTOR_UPS_OAUTH_SCOPES
CONNECTOR_UPS_WEBHOOK_SECRET
```

These keys may be supplied through deployment env or Runtime Config. Deployment env wins when both are set.

5. Register the connector in Admin -> Connectors.
6. Keep it disabled or `SHADOW` until sandbox and canary are green.
7. Enable with low rollout, monitor dispatch health, then graduate to GA.

## Security Rules

- Every partner requires separate consent.
- The user can disconnect at any time.
- Owner/admin never sees member tokens.
- On-behalf sync requires active member status, explicit managed-sync consent, and same-workspace addresses.
- Token responses must not follow redirects.
- Connector HTTP can only reach manifest allowlisted HTTPS hosts.
- Dispatch payloads contain PII and must be encrypted and retention-limited.
- API failures must never block the move; fall back to guided action.

## Partner Fit Notes

- USPS change-of-address is fraud-sensitive and may require USPS-side identity verification or authorized-agent status. Treat API submit as disabled until contract and identity flow are approved.
- UPS/FedEx public APIs commonly cover OAuth, rating, shipping, tracking, and address validation. Account address update rights must be confirmed in the partner agreement before API sync is enabled.
- If a partner only provides address validation, use it to improve address quality, not to claim account update sync.
