-- ADMIN MFA TRUSTED DEVICE
--
-- Additive trusted-device table for admin MFA convenience. The browser stores
-- only an httpOnly random token; the database stores a SHA-256 hash bound to
-- the admin and the same coarse request fingerprint used by admin sessions.

-- CreateTable
CREATE TABLE `AdminMfaTrustedDevice` (
    `id` VARCHAR(30) NOT NULL,
    `adminUserId` VARCHAR(30) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `fingerprintHash` VARCHAR(64) NOT NULL,
    `deviceLabel` VARCHAR(120) NULL,
    `ipAddress` VARCHAR(45) NULL,
    `userAgent` VARCHAR(500) NULL,
    `lastUsedAt` DATETIME(3) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `AdminMfaTrustedDevice_tokenHash_key`(`tokenHash`),
    INDEX `AdminMfaTrustedDevice_adminUserId_idx`(`adminUserId`),
    INDEX `AdminMfaTrustedDevice_fingerprintHash_idx`(`fingerprintHash`),
    INDEX `AdminMfaTrustedDevice_expiresAt_idx`(`expiresAt`),
    INDEX `AdminMfaTrustedDevice_revokedAt_idx`(`revokedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AdminMfaTrustedDevice` ADD CONSTRAINT `AdminMfaTrustedDevice_adminUserId_fkey` FOREIGN KEY (`adminUserId`) REFERENCES `AdminUser`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
