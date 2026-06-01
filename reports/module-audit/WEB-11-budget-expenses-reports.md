# WEB-11 Budget/Expenses/Reports

## Kapsam

Budget CRUD, monthly scope, expenses/reports, workspace/user isolation, exports, notifications.

## Olumlu Gozlemler

- Budget modeli user, workspace, scopeKey ve month eksenleriyle ayrilmis.
- Budget/expense verisi raporlama ve notification modulleriyle baglanti kurabilecek sekilde modellenmis.

## Riskler ve Sorular

- DB unique index `userId, scopeKey, month` uzerinde; workspaceId unique'e dahil degil. Ayni kullanicinin farkli workspace'lerinde scope collision riski olabilir.
- Budget ownership ve workspace access DB-backed multi-user test edilmeli.
- Reports/export tarafinda deleted budget/expense filtreleri ve PII redaction izlenmeli.
- Billing entitlement free/paid farklari budget limitlerini etkiliyorsa shared entitlement drift riski var.

## Test/Task Listesi

- Budget create/update/delete.
- Same user different workspace same month/scope.
- Member access/owner access.
- Deleted budget reports disinda.
- Export format and redaction.
- Entitlement limit behavior.

## Oncelik

P2: Workspace-aware budget unique/invariant testi.
