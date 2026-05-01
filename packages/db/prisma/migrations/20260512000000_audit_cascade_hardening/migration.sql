-- Audit & cascade hardening (P0-2 in the audit remediation plan).
--
-- 1. AdminAuditLog.adminUser was ON DELETE CASCADE — deleting an admin
--    wiped the audit trail, defeating compliance. Switch to SET NULL
--    and make the column nullable so audit rows survive the operator
--    being deleted. Identity context is denormalized into the JSON
--    `changes` payload by the application's writeAdminAudit helper.
--
-- 2. MovingPlan.fromAddress / toAddress already enforce ON DELETE
--    RESTRICT at the DB layer (Prisma's default for required relations
--    on MySQL). This migration is a no-op for those FKs but their
--    schema.prisma annotations were updated in the same change so the
--    intent is now explicit and cannot drift on a future schema sync.

-- AdminAuditLog: relax FK + make column nullable
ALTER TABLE `AdminAuditLog` DROP FOREIGN KEY `AdminAuditLog_adminUserId_fkey`;
ALTER TABLE `AdminAuditLog` MODIFY COLUMN `adminUserId` VARCHAR(30) NULL;
ALTER TABLE `AdminAuditLog`
  ADD CONSTRAINT `AdminAuditLog_adminUserId_fkey`
  FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`)
  ON DELETE SET NULL ON UPDATE CASCADE;
