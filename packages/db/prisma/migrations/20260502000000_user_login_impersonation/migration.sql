-- Admin impersonation: mark user login sessions that a SUPER_ADMIN created
-- while acting-as the user. Time-bounded at the application layer (15 min
-- via UserLoginSession.expiresAt); this column exists so the web UI can
-- render a banner and so audit queries can separate real sessions from
-- impersonation sessions.

ALTER TABLE `UserLoginSession`
  ADD COLUMN `impersonatedByAdminId` VARCHAR(30) NULL;

CREATE INDEX `UserLoginSession_impersonatedByAdminId_idx`
  ON `UserLoginSession`(`impersonatedByAdminId`);
