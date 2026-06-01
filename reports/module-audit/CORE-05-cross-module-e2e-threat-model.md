# CORE-05 Cross-Module E2E/Threat Model

## Kapsam

Tum modullerin birlikte calisma guvencesi, E2E kapsami, threat model, tenant/billing/privacy/connector akislari.

## Olumlu Gozlemler

- Mevcut threat model web, admin, mobile, db, shared, deploy/runbook yuzeylerini birlikte ele aliyor.
- Hassas varliklar dogru sayilmis: kimlik, adres, service/account alanlari, support tickets, notification preferences, move details, subscription/IAP, OAuth, TOTP, backup, runtime secrets.
- Unit/route test zemini guclu; auth, onboarding, billing, webhooks, middleware, account deletion, workspace, mobile OAuth/IAP gibi kritik parcalar testli.

## Riskler ve Bulgular

- P2: Browser E2E public/anonymous smoke seviyesinde; authenticated happy-path/failure-path E2E yok.
- P2: Billing lifecycle route/unit testli ama `PENDING_CHECKOUT -> paid/webhook -> entitlement -> cleanup/reconcile` tek DB-backed E2E'de yok.
- P2: Scheduler drift cross-module risk; Vercel cron listesi Ofelia'daki checkout cleanup/stripe reconcile guvencelerini kacirabilir.
- P2: Workspace/data isolation route testli ama DB-backed multi-user/workspace E2E eksik.
- P2: Connector consent -> enqueue -> dispatch -> submitted -> verify/reconcile -> revoke akisi tek senaryoda yok.
- P2/P3: Account deletion/export/backup restore drill gercek veri grafigiyle yok.
- P3: Threat model repo icinde versioned degil; `/tmp/codex-security-scans/move-main/threat_model.md` altinda duruyor.

## Ana E2E Task Listesi

- Auth + onboarding: sign-up/login, legal gate, onboarding close/resume, address/services/moving skip, mobile parity.
- Billing: unpaid checkout, cleanup, paid webhook, upgrade/downgrade, trial, IAP/web conflict.
- Workspace: owner, invite, seat limit, role change, transfer, purge.
- Tenant isolation: user A/B cross-resource IDOR.
- Connector: consent, enqueue, dispatch, submitted verify, retry, revoke.
- Privacy: export, deletion grace, restore token, final purge, backup restore smoke.
- Deployment: cron parity, `/api/ready`, required env, webhook/cron secret checks.
- Threat model regression: yeni public/admin/webhook/cron/file-network yuzeyleri PR checklist'e baglanmali.

## Oncelik

P2: Authenticated E2E temeli, billing lifecycle ve tenant isolation ilk sirada.
