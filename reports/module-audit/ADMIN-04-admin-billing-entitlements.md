# ADMIN-04 Admin Billing/Entitlements

## Kapsam

Admin subscription view, entitlement override/free access, billing context, Stripe/IAP state, audit.

## Olumlu Gozlemler

- Free access/admin-granted access ile Stripe paid ayrimi checkout mantiginda dusunulmus.
- Billing entitlement kritik admin yuzeyi olarak threat modelde yuksek oncelikli.

## Riskler ve Sorular

- Admin-granted entitlement ile shared canonical entitlement arasinda drift olabilir.
- Manual override audit, expiry ve revocation olmadan kalici yetki yaratmamalidir.
- Web Stripe, mobile IAP ve admin override birlikte oldugunda conflict matrix gerekir.

## Test/Task Listesi

- View subscription requires permission.
- Grant/revoke free access with MFA/audit.
- Override expiry.
- Stripe/IAP conflict display.
- User UI entitlement refresh.
- Audit logs no secret/PII leak.

## Oncelik

P2: Admin entitlement override lifecycle E2E.
