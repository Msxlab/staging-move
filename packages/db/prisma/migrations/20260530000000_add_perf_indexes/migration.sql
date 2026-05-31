-- Performance indexes (additive — no data change, no column change).
-- Reminder crons (bill-reminders, contract-reminders) scan active Services by
-- their billing/contract windows across all users; the security/settings
-- admin dashboards filter the append-only AdminAuditLog primarily by `action`.
-- Without these, those hot paths full-scan as the tables grow.

CREATE INDEX `Service_isActive_contractEndDate_idx` ON `Service`(`isActive`, `contractEndDate`);
CREATE INDEX `Service_isActive_billingDay_idx` ON `Service`(`isActive`, `billingDay`);
CREATE INDEX `AdminAuditLog_action_createdAt_idx` ON `AdminAuditLog`(`action`, `createdAt`);
