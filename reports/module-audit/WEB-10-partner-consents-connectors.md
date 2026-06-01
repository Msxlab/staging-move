# WEB-10 Partner Consents/Connectors

## Kapsam

Partner consent grant/revoke, OAuth/PKCE, connector queue, dispatch, retry, submitted/confirmed states, admin revoke.

## Olumlu Gozlemler

- Connector package saf/izole mantikla tasarlanmis; egress allowlist, retry planner ve PKCE gibi guvenlik parcalari mevcut.
- USPS connector unit testleri submitted/confirmed/failure durumlarini ele aliyor.
- Consent ve connector runtime ayri moduller olarak ayrilmis.

## Riskler ve Sorular

- Consent -> enqueue -> cron dispatch -> submitted -> verify/reconcile -> revoke akisi tek E2E'de yok.
- `SUBMITTED` durumunun sonradan verify/reconcile edilmemesi kalici ara durum yaratabilir.
- Admin bulk revoke queued/in-flight connector islerini iptal etmeyebilir.
- OAuth config registry/manifest allowlist ile yeterince bagli tutulmali.

## Test/Task Listesi

- Consent grant + token storage.
- Queue job create.
- Dispatch success/failure/retry.
- Submitted pending verify.
- User revoke ve admin revoke.
- Token refresh failure consent state.
- Rate limit per user/per connector.

## Oncelik

P2: Connector lifecycle E2E ve submitted reconciliation.
