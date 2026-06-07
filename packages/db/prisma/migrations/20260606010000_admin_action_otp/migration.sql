-- Single-use, attempt-limited, target-bound email OTP for the most
-- destructive admin operations (today: irreversible user HARD DELETE).
-- Additive only: one new table, no existing column is altered or dropped.
-- The row stores ONLY sha256(code) (codeHash) — the plaintext 6-digit code
-- is emailed to the acting admin and never persisted. Deliberately has NO
-- foreign key to AdminUser: like AdminAuditLog this is a security artifact
-- that must outlive the admin row, and verification matches on
-- (adminUserId, operation, targetId) rather than a relation.

-- CreateTable
CREATE TABLE `AdminActionOtp` (
    `id` VARCHAR(30) NOT NULL,
    `adminUserId` VARCHAR(30) NOT NULL,
    `operation` VARCHAR(40) NOT NULL,
    `targetId` VARCHAR(30) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `expiresAt` DATETIME(3) NOT NULL,
    `consumedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `AdminActionOtp_adminUserId_operation_targetId_idx`(`adminUserId` ASC, `operation` ASC, `targetId` ASC),
    INDEX `AdminActionOtp_expiresAt_idx`(`expiresAt` ASC),
    PRIMARY KEY (`id` ASC)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
