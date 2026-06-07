-- ADMIN INVITE + FORCED PASSWORD ROTATION
--
-- Additive & backward-compatible. Two changes, neither alters or drops any
-- existing column or data:
--
--   1. AdminUser.mustChangePassword — a NULLABLE boolean defaulting to false.
--      Existing rows get the DEFAULT (false) so every current admin keeps
--      logging in exactly as before. Only admins created via the new INVITE
--      flow are seeded with true; the login route + page-guard then force
--      them through /set-password/change before any admin surface loads.
--
--   2. AdminSetPasswordToken — a NEW table holding single-use, expiring
--      set-password tokens for the invite flow. The row stores ONLY
--      sha256(token) (tokenHash); the plaintext token is embedded in the
--      invite email link and never persisted. Deliberately has NO foreign
--      key to AdminUser (mirrors AdminActionOtp): it is a security artifact
--      verified by tokenHash with a fresh admin-row check at redeem time.
--
-- No data migration is required.

-- AlterTable (additive, nullable with default — existing rows backfill to false)
ALTER TABLE `AdminUser` ADD COLUMN `mustChangePassword` BOOLEAN NULL DEFAULT false;

-- CreateTable
CREATE TABLE `AdminSetPasswordToken` (
    `id` VARCHAR(30) NOT NULL,
    `adminUserId` VARCHAR(30) NOT NULL,
    `purpose` VARCHAR(20) NOT NULL DEFAULT 'INVITE',
    `tokenHash` VARCHAR(64) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdBy` VARCHAR(30) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdminSetPasswordToken_tokenHash_key`(`tokenHash`),
    INDEX `AdminSetPasswordToken_adminUserId_purpose_idx`(`adminUserId` ASC, `purpose` ASC),
    INDEX `AdminSetPasswordToken_expiresAt_idx`(`expiresAt` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
