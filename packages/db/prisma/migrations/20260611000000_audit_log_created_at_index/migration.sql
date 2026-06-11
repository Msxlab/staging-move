-- Audit-log createdAt indexes (additive — no data change, no column change).
-- The admin logs page and the user-facing activity page both default to a
-- newest-first list with no filter (orderBy createdAt desc). Neither table had
-- a standalone createdAt index — the existing composite indexes lead with
-- adminUserId/userId/action/entityType, so the default unfiltered sort
-- full-scanned these append-only, high-volume tables and made the page
-- slow/unloadable. Index createdAt directly so the default page is index-backed.

CREATE INDEX `AdminAuditLog_createdAt_idx` ON `AdminAuditLog`(`createdAt`);
CREATE INDEX `AuditLog_createdAt_idx` ON `AuditLog`(`createdAt`);
